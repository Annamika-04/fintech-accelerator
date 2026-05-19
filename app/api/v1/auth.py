from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import UserCreate, UserOut
from app.services.supabase_auth import create_supabase_user, update_supabase_user_metadata

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.
    - If supabase_uid is provided (frontend already signed up via Supabase SDK), just sync to DB.
    - If not provided, creates the user in Supabase Auth first, then syncs to DB.
    """
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    supabase_uid = payload.supabase_uid
    if not supabase_uid:
        # Backend-driven signup — create in Supabase Auth
        sb_user = await create_supabase_user(payload.email, payload.password)
        supabase_uid = sb_user["id"]

    # Store role in Supabase user_metadata
    await update_supabase_user_metadata(supabase_uid, {"role": payload.role.value})

    user = User(
        supabase_uid=supabase_uid,
        email=payload.email,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
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
