from pydantic import BaseModel
from typing import Optional, Literal


class UserResponse(BaseModel):
    id: str
    firebase_uid: Optional[str] = None
    phone: str
    name: Optional[str] = None
    role: Literal["admin", "employee", "customer"]
    company_name: Optional[str] = None
    is_active: bool = True
    created_at: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None


class CreateUserRequest(BaseModel):
    name: str
    phone: str
    role: Literal["employee", "customer"]
    company_name: Optional[str] = None


class AdminUpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["employee", "customer"]] = None
    company_name: Optional[str] = None
    is_active: Optional[bool] = None
