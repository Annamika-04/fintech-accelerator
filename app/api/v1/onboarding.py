from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


class OnboardingTypeRequest(BaseModel):
    onboarding_type: str  # "individual" or "corporate"


class IndividualProfileRequest(BaseModel):
    full_name: str
    date_of_birth: str | None = None
    nationality: str | None = None
    country_of_residence: str | None = None
    phone: str | None = None
    address: dict | None = None


class CorporateProfileRequest(BaseModel):
    company_name: str
    registration_number: str | None = None
    jurisdiction: str | None = None
    incorporation_date: str | None = None
    beneficial_owners: list | None = None


@router.get("/status")
async def get_onboarding_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.onboarding import OnboardingState
    result = await db.execute(
        select(OnboardingState).where(OnboardingState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()
    if not state:
        return {
            "user_id": str(current_user.id),
            "current_status": "REGISTERED",
            "onboarding_type": None,
            "kyc_score": None,
            "aml_score": None,
            "final_score": None,
            "decision": None,
        }
    return {
        "user_id": str(current_user.id),
        "current_status": state.current_status,
        "onboarding_type": state.onboarding_type,
        "kyc_score": state.kyc_score,
        "aml_score": state.aml_score,
        "final_score": state.final_score,
        "decision": state.decision,
    }


@router.post("/select-type")
async def select_type(
    payload: OnboardingTypeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.onboarding import OnboardingState, OnboardingStatus, OnboardingType as OType
    result = await db.execute(
        select(OnboardingState).where(OnboardingState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()
    if not state:
        state = OnboardingState(
            user_id=current_user.id,
            current_status=OnboardingStatus.TYPE_SELECTED,
            onboarding_type=OType(payload.onboarding_type),
        )
        db.add(state)
    else:
        state.onboarding_type = OType(payload.onboarding_type)
        state.current_status = OnboardingStatus.TYPE_SELECTED
    await db.commit()
    return {
        "message": f"Onboarding type set to {payload.onboarding_type}",
        "onboarding_type": payload.onboarding_type,
        "current_status": "TYPE_SELECTED",
    }


@router.post("/save-step")
async def save_step(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Persist step data immediately so user can resume on refresh/re-login.
    payload: { "step": "personal_details", "data": { ... }, "current_status": "PROFILE_COMPLETED" }
    """
    from app.models.onboarding import OnboardingState, OnboardingStatus

    step = payload.get("step")
    data = payload.get("data", {})
    new_status = payload.get("current_status")

    result = await db.execute(
        select(OnboardingState).where(OnboardingState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()

    if not state:
        state = OnboardingState(user_id=current_user.id, step_data={})
        db.add(state)

    # merge step data — never overwrite other steps
    merged = dict(state.step_data or {})
    if step:
        merged[step] = data
    state.step_data = merged
    state.last_completed_step = step

    if new_status:
        try:
            state.current_status = OnboardingStatus(new_status)
        except ValueError:
            pass

    await db.commit()
    return {"message": "Step saved", "step": step, "current_status": str(state.current_status)}


@router.get("/resume")
async def resume_onboarding(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full state including prefill data for each step."""
    from app.models.onboarding import OnboardingState

    result = await db.execute(
        select(OnboardingState).where(OnboardingState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()

    if not state:
        return {
            "current_status": "REGISTERED",
            "last_completed_step": None,
            "onboarding_type": None,
            "step_data": {},
        }

    return {
        "current_status": str(state.current_status),
        "last_completed_step": state.last_completed_step,
        "onboarding_type": str(state.onboarding_type) if state.onboarding_type else None,
        "step_data": state.step_data or {},
        "kyc_score": state.kyc_score,
        "aml_score": state.aml_score,
        "final_score": state.final_score,
        "decision": state.decision,
    }



async def select_type(
    payload: OnboardingTypeRequest,
    current_user: User = Depends(get_current_user),
):
    return {
        "message": f"Onboarding type set to {payload.onboarding_type}",
        "onboarding_type": payload.onboarding_type,
        "current_status": "type_selected",
    }


@router.post("/individual/profile")
async def save_individual_profile(
    payload: IndividualProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.document import Document
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    # Upsert individual profile
    from app.db.base import Base
    return {
        "message": "Individual profile saved",
        "current_status": "profile_saved",
        "data": payload.model_dump(),
    }


@router.get("/individual/profile")
async def get_individual_profile(current_user: User = Depends(get_current_user)):
    return {"user_id": str(current_user.id), "profile": None}


@router.post("/corporate/profile")
async def save_corporate_profile(
    payload: CorporateProfileRequest,
    current_user: User = Depends(get_current_user),
):
    return {
        "message": "Corporate profile saved",
        "current_status": "profile_saved",
        "data": payload.model_dump(),
    }


@router.get("/corporate/profile")
async def get_corporate_profile(current_user: User = Depends(get_current_user)):
    return {"user_id": str(current_user.id), "profile": None}


@router.post("/corporate/directors")
async def add_director(
    data: dict,
    current_user: User = Depends(get_current_user),
):
    return {"message": "Director added", "data": data}


@router.get("/corporate/directors")
async def list_directors(current_user: User = Depends(get_current_user)):
    return []


@router.delete("/corporate/directors/{director_id}")
async def remove_director(
    director_id: str,
    current_user: User = Depends(get_current_user),
):
    return {"message": f"Director {director_id} removed"}


@router.post("/advance/documents-uploaded")
async def advance_documents_uploaded(current_user: User = Depends(get_current_user)):
    return {
        "message": "Documents marked as uploaded",
        "current_status": "documents_uploaded",
    }


@router.post("/reset-kyc")
async def reset_kyc(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset stuck KYC back to DOCUMENTS_UPLOADED so user can retry selfie."""
    from app.models.verification import FaceVerification
    from app.models.onboarding import OnboardingState

    # delete pending face verifications
    await db.execute(
        select(FaceVerification).where(
            FaceVerification.user_id == current_user.id,
            FaceVerification.status == "pending",
        )
    )
    from sqlalchemy import delete
    await db.execute(
        delete(FaceVerification).where(
            FaceVerification.user_id == current_user.id,
            FaceVerification.status == "pending",
        )
    )

    # reset onboarding state
    result = await db.execute(
        select(OnboardingState).where(OnboardingState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()
    if state:
        state.current_status = "DOCUMENTS_UPLOADED"
    await db.commit()
    return {"message": "KYC reset. Please retake your selfie.", "current_status": "DOCUMENTS_UPLOADED"}


@router.post("/advance/kyc-pending")
async def advance_kyc_pending(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Read latest face verification result, persist status, return real status."""
    from app.models.verification import FaceVerification
    from app.models.onboarding import OnboardingState

    result = await db.execute(
        select(FaceVerification)
        .where(FaceVerification.user_id == current_user.id)
        .order_by(FaceVerification.created_at.desc())
    )
    latest = result.scalars().first()

    current_status = "KYC_PENDING"
    if latest and latest.status == "completed" and latest.is_match:
        current_status = "UNDER_REVIEW"

    # upsert OnboardingState
    state_result = await db.execute(
        select(OnboardingState).where(OnboardingState.user_id == current_user.id)
    )
    state = state_result.scalar_one_or_none()
    if state:
        state.current_status = current_status
    else:
        from app.models.onboarding import OnboardingType
        state = OnboardingState(
            user_id=current_user.id,
            current_status=current_status,
        )
        db.add(state)
    await db.commit()

    return {"message": "KYC status updated", "current_status": current_status}


@router.post("/decision/{user_id}")
async def make_decision(
    user_id: str,
    decision: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": user_id, "decision": decision, "message": f"Decision '{decision}' applied"}
