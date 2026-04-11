import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from database import supabase
from utils.jwt_utils import decode_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials

    # Dev mock token — skip real verification (disabled in production)
    is_production = os.getenv("ENVIRONMENT") == "production"
    if not is_production and (token == "dev-mock-token" or token.startswith("dev-mock-token:")):
        phone = token.split(":", 1)[1] if ":" in token else None
        if phone:
            result = supabase.table("users").select("*").eq("phone", phone).execute()
            if result.data:
                user = result.data[0]
                if not user.get("is_active", True):
                    raise HTTPException(status_code=403, detail="Account is inactive")
                return user
            raise HTTPException(status_code=403, detail="Your number is not registered. Contact Digvijay Express to get access.")
        # Fallback (no phone in token) → first admin
        result = supabase.table("users").select("*").eq("role", "admin").limit(1).execute()
        if result.data:
            return result.data[0]
        raise HTTPException(status_code=401, detail="No admin user found for dev mock token")

    try:
        user_id = decode_token(token)
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")

    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found.")

    user = result.data[0]
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is inactive")

    return user


def require_role(*roles: str):
    """Returns a dependency that checks the current user's role."""
    async def check(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(roles)}")
        return user
    return check


async def verify_token_string(token: str) -> dict:
    """Verify a raw token string and return the user dict. Used by WebSocket auth."""
    is_production = os.getenv("ENVIRONMENT") == "production"
    if not is_production and (token == "dev-mock-token" or token.startswith("dev-mock-token:")):
        phone = token.split(":", 1)[1] if ":" in token else None
        if phone:
            result = supabase.table("users").select("*").eq("phone", phone).execute()
            if result.data:
                user = result.data[0]
                if not user.get("is_active", True):
                    raise ValueError("Account is inactive")
                return user
            raise ValueError("Phone not registered")
        result = supabase.table("users").select("*").eq("role", "admin").limit(1).execute()
        if result.data:
            return result.data[0]
        raise ValueError("No admin user found for dev mock token")

    try:
        user_id = decode_token(token)
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid or expired token: {e}")

    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise ValueError("User not found")
    user = result.data[0]
    if not user.get("is_active", True):
        raise ValueError("Account is inactive")
    return user
