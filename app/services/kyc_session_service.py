import re
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk import AuditLog
from app.models.tenant import (
    EventPublishStatus,
    KYCSession,
    KYCSessionStatus,
    KYCStepState,
    KYCStepStatus,
    Tenant,
    TenantStatus,
    WorkflowEvent,
)
from app.models.user import User


STEP_ORDER = {
    "account_type": 10,
    "profile": 20,
    "documents": 30,
    "selfie": 40,
    "checks": 50,
    "review": 60,
    "decision": 70,
}


STATUS_TO_STEP = {
    "REGISTERED": ("account_type", KYCSessionStatus.registered),
    "TYPE_SELECTED": ("profile", KYCSessionStatus.type_selected),
    "PROFILE_COMPLETED": ("documents", KYCSessionStatus.profile_completed),
    "DOCUMENTS_UPLOADED": ("selfie", KYCSessionStatus.documents_uploaded),
    "KYC_PENDING": ("checks", KYCSessionStatus.checks_in_progress),
    "AML_PENDING": ("checks", KYCSessionStatus.checks_in_progress),
    "UNDER_REVIEW": ("review", KYCSessionStatus.awaiting_manual_review),
    "APPROVED": ("decision", KYCSessionStatus.approved),
    "REJECTED": ("decision", KYCSessionStatus.rejected),
    "FROZEN": ("review", KYCSessionStatus.awaiting_manual_review),
}


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or f"tenant-{uuid.uuid4().hex[:8]}"


def build_onboarding_id(tenant_id: str, user_id: str) -> str:
    return f"ob-{tenant_id[:8]}-{user_id[:8]}-{uuid.uuid4().hex[:10]}"


async def ensure_tenant_for_user(db: AsyncSession, user: User) -> Tenant:
    if user.tenant_id:
        result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant:
            return tenant

    local_part = (user.email or "customer").split("@", 1)[0]
    base_slug = _slugify(local_part)
    slug = base_slug
    attempt = 1

    while True:
        existing = await db.execute(select(Tenant).where(Tenant.slug == slug))
        if existing.scalar_one_or_none() is None:
            break
        attempt += 1
        slug = f"{base_slug}-{attempt}"

    tenant = Tenant(
        slug=slug,
        display_name=f"{local_part.title()} Workspace",
        status=TenantStatus.active,
        settings={"provisioned_from": "otp_or_app_signup"},
    )
    db.add(tenant)
    await db.flush()
    user.tenant_id = tenant.id
    await db.flush()
    return tenant


async def get_active_kyc_session(db: AsyncSession, user_id) -> KYCSession | None:
    result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == user_id, KYCSession.is_active.is_(True))
        .order_by(KYCSession.started_at.desc())
    )
    return result.scalars().first()


async def ensure_active_kyc_session(db: AsyncSession, user: User) -> KYCSession:
    tenant = await ensure_tenant_for_user(db, user)
    session = await get_active_kyc_session(db, user.id)
    if session:
        session.last_activity_at = datetime.utcnow()
        await db.flush()
        return session

    session = KYCSession(
        tenant_id=tenant.id,
        user_id=user.id,
        onboarding_id=build_onboarding_id(str(tenant.id), str(user.id)),
        current_step="account_type",
        status=KYCSessionStatus.registered,
        is_active=True,
        session_context={"resume_supported": True},
    )
    db.add(session)
    await db.flush()

    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=user.id,
        step_code="account_type",
        status=KYCStepStatus.in_progress,
        payload_snapshot={"created_from": "ensure_active_kyc_session"},
    )
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=user.id,
        event_type="kyc_session_created",
        payload={"onboarding_id": session.onboarding_id},
    )
    return session


async def upsert_step_state(
    db: AsyncSession,
    *,
    tenant_id,
    session_id,
    user_id,
    step_code: str,
    status: KYCStepStatus,
    payload_snapshot: dict | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> KYCStepState:
    result = await db.execute(
        select(KYCStepState).where(
            KYCStepState.kyc_session_id == session_id,
            KYCStepState.step_code == step_code,
        )
    )
    step = result.scalar_one_or_none()
    if not step:
        step = KYCStepState(
            tenant_id=tenant_id,
            kyc_session_id=session_id,
            user_id=user_id,
            step_code=step_code,
            attempt_count=0,
        )
        db.add(step)

    step.status = status
    step.payload_snapshot = payload_snapshot
    step.last_error_code = error_code
    step.last_error_message = error_message
    step.attempt_count = (step.attempt_count or 0) + 1 if status in {KYCStepStatus.failed, KYCStepStatus.blocked} else step.attempt_count
    if status == KYCStepStatus.in_progress and step.started_at is None:
        step.started_at = datetime.utcnow()
    if status == KYCStepStatus.completed:
        step.completed_at = datetime.utcnow()
    step.updated_at = datetime.utcnow()
    await db.flush()
    return step


async def sync_session_progress(
    db: AsyncSession,
    session: KYCSession,
    *,
    current_status: str,
    context_patch: dict | None = None,
) -> KYCSession:
    step_name, session_status = STATUS_TO_STEP.get(current_status, ("account_type", KYCSessionStatus.draft))
    session.current_step = step_name
    session.status = session_status
    session.version = (session.version or 0) + 1
    session.last_activity_at = datetime.utcnow()
    if session_status in {KYCSessionStatus.approved, KYCSessionStatus.rejected, KYCSessionStatus.expired, KYCSessionStatus.abandoned}:
        session.is_active = False
        session.completed_at = datetime.utcnow()
    if context_patch:
        merged = dict(session.session_context or {})
        merged.update(context_patch)
        session.session_context = merged
    await db.flush()
    return session


async def emit_workflow_event(
    db: AsyncSession,
    *,
    tenant_id,
    session_id,
    user_id,
    event_type: str,
    payload: dict | None = None,
    correlation_id: str | None = None,
) -> WorkflowEvent:
    event = WorkflowEvent(
        tenant_id=tenant_id,
        kyc_session_id=session_id,
        user_id=user_id,
        event_type=event_type,
        event_status=EventPublishStatus.pending,
        correlation_id=correlation_id,
        payload=payload,
    )
    db.add(event)
    await db.flush()
    return event


async def write_audit_log(
    db: AsyncSession,
    *,
    tenant_id,
    session_id,
    actor_id,
    action: str,
    resource_type: str,
    resource_id,
    meta: dict | None = None,
    extra_metadata: dict | None = None,
) -> AuditLog:
    audit = AuditLog(
        tenant_id=tenant_id,
        kyc_session_id=session_id,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=(meta or {}).get("ip_address"),
        user_agent=(meta or {}).get("user_agent"),
        extra_metadata=extra_metadata,
    )
    db.add(audit)
    await db.flush()
    return audit
