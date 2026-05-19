from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.api.deps import get_current_user, get_audit_meta
from app.db.session import get_db
from app.models.onboarding import (
    CorporateDirector, CorporateProfile, IndividualProfile,
    OnboardingState, OnboardingStatus, OnboardingType, can_transition,
)
from app.models.risk import AuditLog
from app.models.user import User
from app.schemas.onboarding import (
    CorporateProfileCreate, CorporateProfileOut,
    DirectorCreate, DirectorOut,
    IndividualProfileCreate, IndividualProfileOut,
    OnboardingStateOut, SelectTypeRequest,
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_or_create_state(user_id, db: AsyncSession) -> OnboardingState:
    res = await db.execute(select(OnboardingState).where(OnboardingState.user_id == user_id))
    state = res.scalar_one_or_none()
    if not state:
        state = OnboardingState(user_id=user_id, current_status=OnboardingStatus.REGISTERED)
        db.add(state)
        await db.flush()
    return state


async def _advance(state: OnboardingState, target: OnboardingStatus, db: AsyncSession):
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


# ── Status (polling endpoint for wizard) ─────────────────────────────────────

@router.get("/status", response_model=OnboardingStateOut)
async def get_my_onboarding_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    state = await _get_or_create_state(current_user.id, db)
    await db.commit()
    return state


# ── Step 1: Select onboarding type ───────────────────────────────────────────

@router.post("/select-type", response_model=OnboardingStateOut)
async def select_onboarding_type(
    payload: SelectTypeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    state = await _get_or_create_state(current_user.id, db)

    # Allow re-selection only if still at REGISTERED or TYPE_SELECTED
    if state.current_status not in (OnboardingStatus.REGISTERED, OnboardingStatus.TYPE_SELECTED):
        raise HTTPException(status_code=409, detail="Onboarding type already locked in")

    state.onboarding_type = payload.onboarding_type
    state.current_status = OnboardingStatus.TYPE_SELECTED
    state.updated_at = func.now()

    await _write_audit(current_user.id, "ONBOARDING_TYPE_SELECTED", "onboarding_state", state.id, meta, db)
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
    state = await _get_or_create_state(current_user.id, db)

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
            user_id=current_user.id,
            **payload.model_dump(exclude={"address"}),
            address=address_dict,
        )
        db.add(profile)

    await db.flush()

    # Advance state machine
    if state.current_status in (OnboardingStatus.REGISTERED, OnboardingStatus.TYPE_SELECTED):
        state.onboarding_type = OnboardingType.individual
        state.current_status = OnboardingStatus.PROFILE_COMPLETED
        state.profile_id = profile.id
        state.updated_at = func.now()

    await _write_audit(current_user.id, "INDIVIDUAL_PROFILE_SAVED", "individual_profiles", profile.id, meta, db)
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
    state = await _get_or_create_state(current_user.id, db)

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
            user_id=current_user.id,
            **payload.model_dump(exclude={"registered_address"}),
            registered_address=address_dict,
        )
        db.add(profile)

    await db.flush()

    if state.current_status in (OnboardingStatus.REGISTERED, OnboardingStatus.TYPE_SELECTED):
        state.onboarding_type = OnboardingType.corporate
        state.current_status = OnboardingStatus.PROFILE_COMPLETED
        state.profile_id = profile.id
        state.updated_at = func.now()

    await _write_audit(current_user.id, "CORPORATE_PROFILE_SAVED", "corporate_profiles", profile.id, meta, db)
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

    director = CorporateDirector(corporate_id=profile.id, **payload.model_dump())
    db.add(director)
    await _write_audit(current_user.id, "DIRECTOR_ADDED", "corporate_directors", director.id, meta, db)
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
    state = await _get_or_create_state(current_user.id, db)
    await _advance(state, OnboardingStatus.DOCUMENTS_UPLOADED, db)
    await _write_audit(current_user.id, "DOCUMENTS_UPLOADED", "onboarding_state", state.id, meta, db)
    await db.commit()
    return state


# ── Trigger KYC (wizard step 3 → 4) ──────────────────────────────────────────

@router.post("/advance/kyc-pending", response_model=OnboardingStateOut)
async def trigger_kyc(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    meta: dict = Depends(get_audit_meta),
):
    state = await _get_or_create_state(current_user.id, db)
    await _advance(state, OnboardingStatus.KYC_PENDING, db)
    await _write_audit(current_user.id, "KYC_TRIGGERED", "onboarding_state", state.id, meta, db)
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

    res = await db.execute(select(OnboardingState).where(OnboardingState.user_id == user_id))
    state = res.scalar_one_or_none()
    if not state:
        raise HTTPException(status_code=404, detail="Onboarding state not found")

    target = allowed[decision]
    if not can_transition(state.current_status, target):
        # Allow decision from UNDER_REVIEW only — force state if needed for demo
        state.current_status = OnboardingStatus.UNDER_REVIEW

    state.current_status = target
    state.decision = decision
    state.updated_at = func.now()

    await _write_audit(current_user.id, f"DECISION_{decision}", "onboarding_state", state.id, meta, db)
    await db.commit()
    await db.refresh(state)
    return state
