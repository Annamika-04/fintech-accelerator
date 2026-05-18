from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.risk import RiskScore
from app.models.user import User, UserRole
from app.schemas.risk import RiskScoreRequest, RiskScoreOut
from app.services.risk_engine import RiskInput, calculate_risk

router = APIRouter(prefix="/risk", tags=["Risk Scoring"])


@router.post("/calculate", response_model=RiskScoreOut, status_code=status.HTTP_201_CREATED)
async def calculate_risk_score(
    payload: RiskScoreRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(
        require_roles(UserRole.kyc_officer, UserRole.compliance_manager, UserRole.admin)
    ),
):
    risk_input = RiskInput(**payload.model_dump())
    result = calculate_risk(risk_input)

    record = RiskScore(
        user_id=payload.user_id,
        kyc_risk=result["kyc_risk"],
        aml_risk=result["aml_risk"],
        geographic_risk=result["geographic_risk"],
        behavioural_risk=result["behavioural_risk"],
        transaction_risk=result["transaction_risk"],
        device_ip_risk=result["device_ip_risk"],
        ownership_structure_risk=result["ownership_structure_risk"],
        final_score=result["final_score"],
        decision=result["decision"],
        score_breakdown=result["score_breakdown"],
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/history/{user_id}", response_model=list[RiskScoreOut])
async def get_risk_history(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(
        require_roles(
            UserRole.kyc_officer, UserRole.compliance_manager,
            UserRole.admin, UserRole.auditor
        )
    ),
):
    result = await db.execute(
        select(RiskScore)
        .where(RiskScore.user_id == user_id)
        .order_by(RiskScore.calculated_at.desc())
    )
    return result.scalars().all()
