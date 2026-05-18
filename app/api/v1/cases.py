from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.risk import Case
from app.models.user import User, UserRole

router = APIRouter(prefix="/cases", tags=["Cases"])


class CaseCreate(BaseModel):
    user_id: UUID
    case_type: str
    priority: str = "medium"
    risk_score_id: UUID | None = None
    notes: str | None = None


class CaseOut(BaseModel):
    id: UUID
    user_id: UUID
    case_type: str | None
    status: str
    priority: str
    notes: str | None

    model_config = {"from_attributes": True}


@router.post("/", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
async def create_case(
    payload: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.kyc_officer, UserRole.compliance_manager, UserRole.admin)
    ),
):
    case = Case(**payload.model_dump(), assigned_to=current_user.id)
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


@router.get("/", response_model=list[CaseOut])
async def list_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.kyc_officer, UserRole.aml_analyst,
            UserRole.compliance_manager, UserRole.admin, UserRole.auditor
        )
    ),
):
    result = await db.execute(
        select(Case).order_by(Case.created_at.desc()).limit(100)
    )
    return result.scalars().all()


@router.patch("/{case_id}/resolve", response_model=CaseOut)
async def resolve_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.compliance_manager, UserRole.admin)
    ),
):
    from sqlalchemy.sql import func

    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.status = "resolved"
    case.resolved_at = func.now()
    await db.commit()
    await db.refresh(case)
    return case
