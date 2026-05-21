from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.verification import FaceVerification
from app.schemas.verification import FaceVerificationRequest, FaceVerificationOut
from app.services.kyc_session_service import emit_workflow_event, ensure_active_kyc_session, ensure_tenant_for_user, write_audit_log
from app.tasks.face_tasks import run_face_verification

router = APIRouter(prefix="/face-verification", tags=["Face Verification"])


@router.post("/", response_model=FaceVerificationOut, status_code=status.HTTP_202_ACCEPTED)
async def submit_face_verification(
    payload: FaceVerificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = await ensure_tenant_for_user(db, current_user)
    session = await ensure_active_kyc_session(db, current_user)
    record = FaceVerification(
        tenant_id=tenant.id,
        kyc_session_id=session.id,
        user_id=current_user.id,
        selfie_s3_key=payload.selfie_s3_key,
        id_document_s3_key=payload.id_document_s3_key,
        status="pending",
    )
    db.add(record)
    await emit_workflow_event(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        user_id=current_user.id,
        event_type="kyc.face_verification_requested",
        payload=payload.model_dump(),
    )
    await write_audit_log(
        db,
        tenant_id=tenant.id,
        session_id=session.id,
        actor_id=current_user.id,
        action="FACE_VERIFICATION_REQUESTED",
        resource_type="face_verifications",
        resource_id=record.id,
    )
    await db.commit()
    await db.refresh(record)

    run_face_verification.delay(
        str(record.id),
        payload.selfie_s3_key,
        payload.id_document_s3_key,
        str(current_user.id),
    )
    return record


@router.get("/{verification_id}", response_model=FaceVerificationOut)
async def get_face_verification(
    verification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FaceVerification).where(
            FaceVerification.id == verification_id,
            FaceVerification.user_id == current_user.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Verification not found")
    return record
