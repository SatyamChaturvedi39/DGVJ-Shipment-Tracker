from pydantic import BaseModel
from typing import Optional, Literal


class UserBase(BaseModel):
    phone: str
    name: str
    role: Literal["admin", "employee", "customer"]
    company_name: Optional[str] = None


class UserCreate(UserBase):
    firebase_uid: str


class UserResponse(UserBase):
    id: str
    firebase_uid: str
    created_at: str
