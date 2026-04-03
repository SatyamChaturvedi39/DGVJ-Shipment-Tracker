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
    Closed auth flow:
    1. Look up by firebase_uid → returning user
    2. Look up by phone WHERE firebase_uid IS NULL → first login of pre-registered user, bind uid
    3. Neither found → 403 (phone not pre-registered by admin)
    """
    try:
        decoded = firebase_auth.verify_id_token(body.firebase_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")

    firebase_uid = decoded["uid"]
    phone = decoded.get("phone_number", "")

    # Step 1 — returning user (firebase_uid already bound)
    result = supabase.table("users").select("*").eq("firebase_uid", firebase_uid).execute()
    if result.data:
        user = result.data[0]
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Your account has been deactivated. Contact Digvijay Express.")
        return user

    # Step 2 — first login of a pre-registered user (phone exists, no uid yet)
    pre = supabase.table("users").select("*").eq("phone", phone).is_("firebase_uid", "null").execute()
    if pre.data:
        user = pre.data[0]
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Your account has been deactivated. Contact Digvijay Express.")
        # Bind the firebase_uid to the pre-registered record
        supabase.table("users").update({"firebase_uid": firebase_uid}).eq("id", user["id"]).execute()
        user["firebase_uid"] = firebase_uid
        return user

    # Step 3 — unknown phone, not pre-registered
    raise HTTPException(
        status_code=403,
        detail="Your number is not registered. Contact Digvijay Express to get access."
    )
