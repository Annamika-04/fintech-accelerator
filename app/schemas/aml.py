from datetime import datetime
from pydantic import BaseModel
from uuid import UUID


class AMLScreeningRequest(BaseModel):
    full_name: str
    date_of_birth: str | None = None
    profile_type: str = "individual"


class AMLScreeningOut(BaseModel):
    id: UUID
    normalized_name: str
    is_pep: bool
    is_sanctioned: bool
    adverse_media_flag: bool
    risk_flags: list | None
    screened_at: datetime | None

    model_config = {"from_attributes": True}
