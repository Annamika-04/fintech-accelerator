from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_current_user, get_audit_meta
from app.db.session import get_db
from app.models.onboarding import OnboardingState, OnboardingStatus, can_transition
from app.models.user import User
from app.services.kyc_session_service import write_audit_log
from app.tasks.aml_tasks import run_aml_screening

router = APIRouter(prefix="/admin", tags=["Admin Overrides"])


class KYCOverrideRequest(BaseModel):
    user_id: str
    target_status: OnboardingStatus
    reason: str
    bypass_aml: bool = False


class AMLBypassRequest(BaseModel):
    user_id: str
    reason: str


@router.post("/kyc-override")
async def override_kyc_status(
    request: KYCOverrideRequest,
    current_user: User = Depends(get_current_user),
    audit_meta: dict = Depends(get_audit_meta),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin override for KYC status - use when OCR fails but manual verification is complete.
    Requires admin role.
    """
    if current_user.role not in ["admin", "compliance_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get current state
    result = await db.execute(
        select(OnboardingState).where(OnboardingState.user_id == request.user_id)
    )
    state = result.scalar_one_or_none()
    
    if not state:
        raise HTTPException(status_code=404, detail="User onboarding state not found")

    old_status = state.current_status
    
    # Validate transition (allow admin overrides for stuck states)
    if not can_transition(old_status, request.target_status):
        # Allow admin override for specific stuck scenarios
        allowed_overrides = {
            OnboardingStatus.KYC_PENDING: [OnboardingStatus.AML_PENDING, OnboardingStatus.UNDER_REVIEW],
            OnboardingStatus.KYC_VALIDATION_RUNNING: [OnboardingStatus.AML_PENDING, OnboardingStatus.UNDER_REVIEW],
            OnboardingStatus.UNDER_REVIEW: [OnboardingStatus.AML_PENDING, OnboardingStatus.APPROVED],
        }
        
        if request.target_status not in allowed_overrides.get(old_status, []):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid transition: {old_status} -> {request.target_status}"
            )

    # Update state
    state.current_status = request.target_status
    state.kyc_metadata = state.kyc_metadata or {}
    state.kyc_metadata["admin_override"] = {
        "overridden_by": str(current_user.id),
        "reason": request.reason,
        "original_status": old_status.value,
        "timestamp": audit_meta["timestamp"],
    }

    await db.commit()

    # Log the override
    await write_audit_log(
        db=db,
        user_id=request.user_id,
        action="KYC_STATUS_OVERRIDE",
        details={
            "from_status": old_status.value,
            "to_status": request.target_status.value,
            "reason": request.reason,
            "overridden_by": str(current_user.id),
        },
        audit_meta=audit_meta,
    )

    # Trigger AML if moving to AML_PENDING and not bypassed
    if request.target_status == OnboardingStatus.AML_PENDING and not request.bypass_aml:
        # Get profile for AML screening
        from app.models.onboarding import IndividualProfile
        profile_result = await db.execute(
            select(IndividualProfile).where(IndividualProfile.user_id == request.user_id)
        )
        profile = profile_result.scalar_one_or_none()
        
        if profile:
            run_aml_screening.apply_async(
                args=[
                    request.user_id,
                    profile.full_name,
                    str(profile.date_of_birth) if profile.date_of_birth else None,
                    "individual",
                ],
                queue="aml",
            )

    return {
        "success": True,
        "message": f"Status updated from {old_status.value} to {request.target_status.value}",
        "user_id": request.user_id,
        "new_status": request.target_status.value,
    }


@router.post("/force-aml-screening")
async def force_aml_screening(
    request: AMLBypassRequest,
    current_user: User = Depends(get_current_user),
    audit_meta: dict = Depends(get_audit_meta),
    db: AsyncSession = Depends(get_db),
):
    """
    Force AML screening regardless of KYC status.
    Use when you need AML results while KYC is still in progress.
    """
    if current_user.role not in ["admin", "compliance_manager", "aml_analyst"]:
        raise HTTPException(status_code=403, detail="Compliance access required")

    # Get profile for AML screening
    from app.models.onboarding import IndividualProfile
    profile_result = await db.execute(
        select(IndividualProfile).where(IndividualProfile.user_id == request.user_id)
    )
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    # Log the forced AML screening
    await write_audit_log(
        db=db,
        user_id=request.user_id,
        action="FORCE_AML_SCREENING",
        details={
            "reason": request.reason,
            "triggered_by": str(current_user.id),
        },
        audit_meta=audit_meta,
    )

    # Trigger AML screening
    task_result = run_aml_screening.apply_async(
        args=[
            request.user_id,
            profile.full_name,
            str(profile.date_of_birth) if profile.date_of_birth else None,
            "individual",
        ],
        queue="aml",
    )

    return {
        "success": True,
        "message": "AML screening initiated",
        "user_id": request.user_id,
        "task_id": task_result.id,
        "profile_name": profile.full_name,
    }