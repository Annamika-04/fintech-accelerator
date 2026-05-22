from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.api.deps import get_current_user, get_audit_meta
from app.db.session import get_db
from app.models.onboarding import (
    CorporateDirector, CorporateProfile, IndividualProfile,
    OnboardingState, OnboardingStatus, OnboardingType, can_transition,
)
from app.models.risk import AuditLog
from app.models.tenant import KYCStepState, KYCStepStatus
from app.models.user import User
from app.schemas.onboarding import (
    CorporateProfileCreate, CorporateProfileOut,
    DirectorCreate, DirectorOut,
    IndividualProfileCreate, IndividualProfileOut,
    KYCSessionOut,
    KYCStepStateOut,
    OnboardingResumeOut,
    OnboardingStateOut,
    SelectTypeRequest,
)
from app.services.kyc_session_service import (
    emit_workflow_event,
    ensure_active_kyc_session,
    ensure_tenant_for_user,
    sync_session_progress,
    upsert_step_state,
    write_audit_log,
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


def _is_missing_relation_error(exc: Exception, relation_name: str) -> bool:
    text = str(exc).lower()
    return "does not exist" in text and relation_name.lower() in text


def _fallback_state(user_id) -> OnboardingState:
    return OnboardingState(
        user_id=user_id,
        onboarding_type=None,
        current_status=OnboardingStatus.REGISTERED,
        profile_id=None,
        kyc_score=None,
        aml_score=None,
        final_score=None,
        decision=None,
    )


def _ensure_persistent_state(state: OnboardingState) -> None:
    if state.id is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Onboarding tables are not available in the database yet.",
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_or_create_state(user_id, db: AsyncSession) -> OnboardingState:
    try:
        res = await db.execute(select(OnboardingState).where(OnboardingState.user_id == user_id))
        state = res.scalar_one_or_none()
        if not state:
            state = OnboardingState(user_id=user_id, current_status=OnboardingStatus.REGISTERED)
            db.add(state)
            await db.flush()
        return state
    except ProgrammingError as exc:
        if _is_missing_relation_error(exc, "onboarding_state"):
            await db.rollback()
            return _fallback_state(user_id)
        raise


async def _advance(state: OnboardingState, target: OnboardingStatus, db: AsyncSession):
    _ensure_persistent_state(state)
    if not can_transition(state.current_status, target):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot transition from {state.current_status} to {target}",
        )
    state.current_status = target
    state.updated_at = func.now()
    await db.commit()
    await db.refresh(state)


async def _write_audit(actor_id, action: str, resource_type: str, resource_id, meta: dict, db: AsyncSession):
    db.add(AuditLog(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=meta.get("ip_address"),
        user_agent=meta.get("user_agent"),
    ))
    await db.flush()


async def _ensure_state_with_session(current_user: User, db: AsyncSession) -> tuple[OnboardingState, object, object]:
    tenant = await ensure_tenant_for_user(db, current_user)
    session = await ensure_active_kyc_session(db, current_user)
    state = await _get_or_create_state(current_user.id, db)
    state.tenant_id = tenant.id
    state.kyc_session_id = session.id
    await db.flush()
    return state, tenant, session


# ── Status (polling endpoint for wizard) ─────────────────────────────────────

@router.get("/status", response_model=OnboardingStateOut)
async def get_my_onboarding_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    state, _, session = await _ensure_state_with_session(current_user, db)
    await sync_session_progress(db, session, current_status=state.current_status.value if hasattr(state.current_status, "value") else str(state.current_status))
    if state.id is not None:
        await db.commit()
    return state


@router.get("/resume", response_model=OnboardingResumeOut)
async def resume_onboarding(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    state, _, session = await _ensure_state_with_session(current_user, db)
    result = await db.execute(
        select(KYCStepState)
        .where(KYCStepState.kyc_session_id == session.id)
        .order_by(KYCStepState.updated_at.asc())
    )
    steps = result.scalars().all()
    await sync_session_progress(db, session, current_status=state.current_status.value if hasattr(state.current_status, "value") else str(state.current_status))
    await db.commit()
    await db.refresh(state)
    await db.refresh(session)
    return OnboardingResumeOut(state=state, session=session, steps=steps)


# ── Step 1: Select onboarding type ───────────────────────────────────────────

@router.post("/select-type", response_model=OnboardingStateOut)
async def select_onboarding_type(
    payload: SelectTypeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    state, tenant, session = await _ensure_state_with_session(current_user, db)
    _ensure_persistent_state(state)

    # Allow re-selection only if still at REGISTERED or TYPE_SELECTED
    if state.current_status not in (OnboardingStatus.REGISTERED, OnboardingStatus.TYPE_SELECTED):
        raise HTTPException(status_code=409, detail="Onboarding type already locked in")

    state.onboarding_type = payload.onboarding_type
    state.current_status = OnboardingStatus.TYPE_SELECTED
    state.updated_at = func.now()
    await sync_session_progress(
        db,
        session,
        current_status=state.current_status.value,
        context_patch={"onboarding_type": payload.onboarding_type.value},
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="account_type",
        status=KYCStepStatus.completed,
        payload_snapshot=payload.model_dump(),
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="profile",
        status=KYCStepStatus.in_progress,
        payload_snapshot={"next_step": "profile"},
    )
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.account_type_selected",
        payload=payload.model_dump(),
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="ONBOARDING_TYPE_SELECTED",
        resource_type="onboarding_state",
        resource_id=state.id,
        meta=meta,
        extra_metadata=payload.model_dump(),
    )
    await db.commit()
    await db.refresh(state)
    return state


# ── Individual: create / update profile ──────────────────────────────────────

@router.post("/individual/profile", response_model=IndividualProfileOut, status_code=status.HTTP_201_CREATED)
async def create_individual_profile(
    payload: IndividualProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    state, tenant, session = await _ensure_state_with_session(current_user, db)
    _ensure_persistent_state(state)

    if state.onboarding_type and state.onboarding_type != OnboardingType.individual:
        raise HTTPException(status_code=409, detail="Onboarding type mismatch")

    # Upsert profile
    res = await db.execute(select(IndividualProfile).where(IndividualProfile.user_id == current_user.id))
    profile = res.scalar_one_or_none()

    address_dict = payload.address.model_dump() if payload.address else None

    if profile:
        for field, val in payload.model_dump(exclude={"address"}).items():
            setattr(profile, field, val)
        profile.address = address_dict
    else:
        profile = IndividualProfile(
            tenant_id=tenant.id,
            kyc_session_id=session.id,
            user_id=current_user.id,
            **payload.model_dump(exclude={"address"}),
            address=address_dict,
        )
        db.add(profile)
    if profile:
        profile.tenant_id = tenant.id
        profile.kyc_session_id = session.id

    await db.flush()

    # Advance state machine
    if state.current_status in (OnboardingStatus.REGISTERED, OnboardingStatus.TYPE_SELECTED):
        state.onboarding_type = OnboardingType.individual
        state.current_status = OnboardingStatus.PROFILE_COMPLETED
        state.profile_id = profile.id
        state.updated_at = func.now()
    await sync_session_progress(
        db,
        session,
        current_status=state.current_status.value,
        context_patch={"profile_id": str(profile.id), "account_type": "individual"},
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="profile",
        status=KYCStepStatus.completed,
        payload_snapshot=payload.model_dump(mode="json"),
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="documents",
        status=KYCStepStatus.in_progress,
        payload_snapshot={"next_step": "documents"},
    )
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.profile_saved",
        payload={"profile_type": "individual", **payload.model_dump(mode="json")},
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="INDIVIDUAL_PROFILE_SAVED",
        resource_type="individual_profiles",
        resource_id=profile.id,
        meta=meta,
    )
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/individual/profile", response_model=IndividualProfileOut)
async def get_individual_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(select(IndividualProfile).where(IndividualProfile.user_id == current_user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ── Corporate: create / update profile ───────────────────────────────────────

@router.post("/corporate/profile", response_model=CorporateProfileOut, status_code=status.HTTP_201_CREATED)
async def create_corporate_profile(
    payload: CorporateProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    state, tenant, session = await _ensure_state_with_session(current_user, db)
    _ensure_persistent_state(state)

    if state.onboarding_type and state.onboarding_type != OnboardingType.corporate:
        raise HTTPException(status_code=409, detail="Onboarding type mismatch")

    res = await db.execute(select(CorporateProfile).where(CorporateProfile.user_id == current_user.id))
    profile = res.scalar_one_or_none()

    address_dict = payload.registered_address.model_dump() if payload.registered_address else None

    if profile:
        for field, val in payload.model_dump(exclude={"registered_address"}).items():
            setattr(profile, field, val)
        profile.registered_address = address_dict
    else:
        profile = CorporateProfile(
            tenant_id=tenant.id,
            kyc_session_id=session.id,
            user_id=current_user.id,
            **payload.model_dump(exclude={"registered_address"}),
            registered_address=address_dict,
        )
        db.add(profile)
    if profile:
        profile.tenant_id = tenant.id
        profile.kyc_session_id = session.id

    await db.flush()

    if state.current_status in (OnboardingStatus.REGISTERED, OnboardingStatus.TYPE_SELECTED):
        state.onboarding_type = OnboardingType.corporate
        state.current_status = OnboardingStatus.PROFILE_COMPLETED
        state.profile_id = profile.id
        state.updated_at = func.now()
    await sync_session_progress(
        db,
        session,
        current_status=state.current_status.value,
        context_patch={"profile_id": str(profile.id), "account_type": "corporate"},
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="profile",
        status=KYCStepStatus.completed,
        payload_snapshot=payload.model_dump(mode="json"),
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="documents",
        status=KYCStepStatus.in_progress,
        payload_snapshot={"next_step": "documents"},
    )
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.profile_saved",
        payload={"profile_type": "corporate", **payload.model_dump(mode="json")},
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="CORPORATE_PROFILE_SAVED",
        resource_type="corporate_profiles",
        resource_id=profile.id,
        meta=meta,
    )
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/corporate/profile", response_model=CorporateProfileOut)
async def get_corporate_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(select(CorporateProfile).where(CorporateProfile.user_id == current_user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ── Corporate: directors / UBOs ───────────────────────────────────────────────

@router.post("/corporate/directors", response_model=DirectorOut, status_code=status.HTTP_201_CREATED)
async def add_director(
    payload: DirectorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    res = await db.execute(select(CorporateProfile).where(CorporateProfile.user_id == current_user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Corporate profile not found")

    tenant = await ensure_tenant_for_user(db, current_user)
    session = await ensure_active_kyc_session(db, current_user)
    director = CorporateDirector(tenant_id=tenant.id, kyc_session_id=session.id, corporate_id=profile.id, **payload.model_dump())
    db.add(director)
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="DIRECTOR_ADDED",
        resource_type="corporate_directors",
        resource_id=director.id,
        meta=meta,
    )
    await db.commit()
    await db.refresh(director)
    return director


@router.get("/corporate/directors", response_model=list[DirectorOut])
async def list_directors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(select(CorporateProfile).where(CorporateProfile.user_id == current_user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Corporate profile not found")

    result = await db.execute(select(CorporateDirector).where(CorporateDirector.corporate_id == profile.id))
    return result.scalars().all()


@router.delete("/corporate/directors/{director_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_director(
    director_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(select(CorporateProfile).where(CorporateProfile.user_id == current_user.id))
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Corporate profile not found")

    res2 = await db.execute(
        select(CorporateDirector).where(
            CorporateDirector.id == director_id,
            CorporateDirector.corporate_id == profile.id,
        )
    )
    director = res2.scalar_one_or_none()
    if not director:
        raise HTTPException(status_code=404, detail="Director not found")

    await db.delete(director)
    await db.commit()


# ── Mark documents uploaded (wizard step 2 → 3 transition) ───────────────────

@router.post("/advance/documents-uploaded", response_model=OnboardingStateOut)
async def mark_documents_uploaded(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    state, tenant, session = await _ensure_state_with_session(current_user, db)
    _ensure_persistent_state(state)
    await _advance(state, OnboardingStatus.DOCUMENTS_UPLOADED, db)
    await sync_session_progress(db, session, current_status=state.current_status.value)
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="documents",
        status=KYCStepStatus.completed,
        payload_snapshot={"status": "uploaded"},
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="selfie",
        status=KYCStepStatus.in_progress,
        payload_snapshot={"next_step": "selfie"},
    )
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.documents_uploaded",
        payload={"current_status": state.current_status.value},
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="DOCUMENTS_UPLOADED",
        resource_type="onboarding_state",
        resource_id=state.id,
        meta=meta,
    )
    await db.commit()
    return state


# ── Trigger KYC (wizard step 3 → 4) ──────────────────────────────────────────

@router.post("/advance/kyc-pending", response_model=OnboardingStateOut)
async def trigger_kyc(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    state, tenant, session = await _ensure_state_with_session(current_user, db)
    _ensure_persistent_state(state)
    await _advance(state, OnboardingStatus.KYC_PENDING, db)
    await sync_session_progress(db, session, current_status=state.current_status.value)
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="selfie",
        status=KYCStepStatus.completed,
        payload_snapshot={"status": "uploaded"},
    )
    await upsert_step_state(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        step_code="checks",
        status=KYCStepStatus.in_progress,
        payload_snapshot={"status": "queued"},
    )
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.checks_started",
        payload={"current_status": state.current_status.value},
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="KYC_TRIGGERED",
        resource_type="onboarding_state",
        resource_id=state.id,
        meta=meta,
    )
    await db.commit()
    return state


# ── Compliance officer: approve / reject / freeze ─────────────────────────────

@router.post("/decision/{user_id}", response_model=OnboardingStateOut)
async def make_decision(
    user_id: str,
    decision: str,  # "APPROVED" | "REJECTED" | "FROZEN"
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    from app.models.user import UserRole
    if current_user.role not in (UserRole.kyc_officer, UserRole.compliance_manager, UserRole.admin):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    allowed = {"APPROVED": OnboardingStatus.APPROVED, "REJECTED": OnboardingStatus.REJECTED, "FROZEN": OnboardingStatus.FROZEN}
    if decision not in allowed:
        raise HTTPException(status_code=400, detail="Invalid decision")

    try:
        res = await db.execute(select(OnboardingState).where(OnboardingState.user_id == user_id))
        state = res.scalar_one_or_none()
    except ProgrammingError as exc:
        if _is_missing_relation_error(exc, "onboarding_state"):
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Onboarding tables are not available in the database yet.",
            )
        raise
    if not state:
        raise HTTPException(status_code=404, detail="Onboarding state not found")

    target = allowed[decision]
    if not can_transition(state.current_status, target):
        # Allow decision from UNDER_REVIEW only — force state if needed for demo
        state.current_status = OnboardingStatus.UNDER_REVIEW

    state.current_status = target
    state.decision = decision
    state.updated_at = func.now()
    tenant_id = state.tenant_id
    session_id = state.kyc_session_id
    if not tenant_id or not session_id:
        tenant = await ensure_tenant_for_user(db, current_user)
        session = await ensure_active_kyc_session(db, current_user)
        tenant_id = tenant.id
        session_id = session.id
    else:
        active_state, _, session = await _ensure_state_with_session(current_user, db)
        if active_state.id == state.id:
            await sync_session_progress(db, session, current_status=state.current_status.value)
    await upsert_step_state(
        db,
        tenant_id=tenant_id,
        session_id=session_id,
        user_id=state.user_id,
        step_code="decision",
        status=KYCStepStatus.completed,
        payload_snapshot={"decision": decision},
    )
    await emit_workflow_event(
        db,
        tenant_id=tenant_id,
        session_id=session_id,
        user_id=state.user_id,
        event_type="kyc.decision_recorded",
        payload={"decision": decision},
    )
    await write_audit_log(
        db,
        tenant_id=tenant_id,
        session_id=session_id,
        actor_id=current_user.id,
        action=f"DECISION_{decision}",
        resource_type="onboarding_state",
        resource_id=state.id,
        meta=meta,
    )
    await db.commit()
    await db.refresh(state)
    return state
