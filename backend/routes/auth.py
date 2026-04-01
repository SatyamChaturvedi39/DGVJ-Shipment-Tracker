from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyTokenRequest(BaseModel):
    firebase_token: str


@router.post("/verify-token")
def verify_token(body: VerifyTokenRequest):
    # TODO: Verify Firebase ID token using firebase_admin
    # TODO: Look up or create user in Supabase
    return {
        "user": {
            "id": "mock-id",
            "phone": "+919999999999",
            "name": "Mock User",
            "role": "admin",
            "company_name": None,
            "firebase_uid": "mock-uid",
            "created_at": "2026-01-01T00:00:00Z",
        }
    }
