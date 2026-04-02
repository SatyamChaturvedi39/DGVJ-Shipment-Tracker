from pydantic import BaseModel
from typing import Optional, Literal


class UserResponse(BaseModel):
    id: str
    firebase_uid: str
    phone: str
    name: Optional[str] = None
    role: Literal["admin", "employee", "customer"]
    company_name: Optional[str] = None
    is_active: bool = True
    created_at: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
