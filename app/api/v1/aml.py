from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.aml import AMLScreening
from app.models.user import User, UserRole
from app.schemas.aml import AMLScreeningRequest, AMLScreeningOut
from app.tasks.aml_tasks import run_aml_screening

router = APIRouter(prefix="/aml", tags=["AML Screening"])


@router.post("/screen", status_code=status.HTTP_202_ACCEPTED)
async def trigger_aml_screening(
    payload: AMLScreeningRequest,
    current_user: User = Depends(
        require_roles(UserRole.aml_analyst, UserRole.compliance_manager, UserRole.admin)
    ),
):
    run_aml_screening.delay(
        str(current_user.id),
        payload.full_name,
        payload.date_of_birth,
        payload.profile_type,
    )
    return {"message": "AML screening queued", "name": payload.full_name}


@router.get("/results/{user_id}", response_model=list[AMLScreeningOut])
async def get_aml_results(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(
        require_roles(UserRole.aml_analyst, UserRole.compliance_manager, UserRole.admin, UserRole.auditor)
    ),
):
    result = await db.execute(
        select(AMLScreening)
        .where(AMLScreening.user_id == user_id)
        .order_by(AMLScreening.created_at.desc())
    )
    return result.scalars().all()
