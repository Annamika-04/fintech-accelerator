from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import UserCreate, UserOut
from app.services.cognito import admin_add_user_to_group

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user after Cognito signup."""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        cognito_sub=payload.cognito_sub,
        email=payload.email,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Sync role to Cognito group
    admin_add_user_to_group(payload.cognito_sub, payload.role.value)
    return user


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.compliance_manager)),
):
    result = await db.execute(select(User))
    return result.scalars().all()
