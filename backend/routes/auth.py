from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth
from database import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyTokenRequest(BaseModel):
    firebase_token: str


@router.post("/verify-token")
def verify_token(body: VerifyTokenRequest):
    """
    Verify a Firebase ID token. Creates the user in Supabase if first login.
    Returns the full user object including role.
    """
    try:
        decoded = firebase_auth.verify_id_token(body.firebase_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")

    firebase_uid = decoded["uid"]
    phone = decoded.get("phone_number", "")

    # Check if user already exists
    result = supabase.table("users").select("*").eq("firebase_uid", firebase_uid).execute()

    if result.data:
        return result.data[0]

    # New user — create with default role 'customer'
    new_user = {
        "firebase_uid": firebase_uid,
        "phone": phone,
        "name": None,
        "role": "customer",
        "company_name": None,
    }
    created = supabase.table("users").insert(new_user).execute()
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to create user")

    return created.data[0]
