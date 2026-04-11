from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import bcrypt
from dependencies import get_current_user
from database import supabase
from utils.jwt_utils import create_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def _verify_pin(pin: str, hashed: str) -> bool:
    return bcrypt.checkpw(pin.encode(), hashed.encode())


class LoginRequest(BaseModel):
    phone: str
    pin: str


class SetPinRequest(BaseModel):
    new_pin: str


@router.post("/login")
def login(body: LoginRequest):
    """
    Phone + PIN login.
    Returns JWT token + user profile on success.
    Step 1: Find user by phone
    Step 2: Check PIN is set
    Step 3: Verify PIN
    Step 4: Return token + user
    """
    # Step 1 — find user by phone
    result = supabase.table("users").select("*").eq("phone", body.phone).execute()
    if not result.data:
        raise HTTPException(
            status_code=403,
            detail="Your number is not registered. Contact Digvijay Express to get access."
        )

    user = result.data[0]

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Contact Digvijay Express."
        )

    # Step 2 — check PIN is set
    if not user.get("pin_hash"):
        raise HTTPException(
            status_code=403,
            detail="No PIN set for this account. Contact Digvijay Express."
        )

    # Step 3 — verify PIN
    if not _verify_pin(body.pin, user["pin_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect PIN. Please try again.")

    # Step 4 — return token + profile (exclude pin_hash from response)
    token = create_token(user["id"])
    user_safe = {k: v for k, v in user.items() if k != "pin_hash"}
    return {"token": token, "user": user_safe}


@router.post("/set-pin")
def set_pin(body: SetPinRequest, current_user: dict = Depends(get_current_user)):
    """
    Set or change PIN for the authenticated user.
    PIN must be exactly 4 digits.
    """
    if not body.new_pin.isdigit() or len(body.new_pin) != 4:
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits.")

    pin_hash = _hash_pin(body.new_pin)
    supabase.table("users").update({"pin_hash": pin_hash}).eq("id", current_user["id"]).execute()
    return {"ok": True}
