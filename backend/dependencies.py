import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from database import supabase

security = HTTPBearer()

# --- Firebase Admin init (once) ---

def _init_firebase():
    if firebase_admin._apps:
        return
    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-service-account.json")
    if os.path.exists(path):
        cred = credentials.Certificate(path)
        firebase_admin.initialize_app(cred)
        print(f"[Firebase] Initialized with service account: {path}")
    else:
        # No service account — initialize without credentials.
        # Token verification will fail until you add firebase-service-account.json.
        # Download from: Firebase Console → Project Settings → Service accounts
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        firebase_admin.initialize_app(options={"projectId": project_id})
        print("[Firebase] WARNING: No service account found. Token verification disabled.")

_init_firebase()

# --- Dependency ---

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
        decoded = firebase_auth.verify_id_token(token)
        firebase_uid = decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")

    result = supabase.table("users").select("*").eq("firebase_uid", firebase_uid).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found. Call /auth/verify-token first.")

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
        decoded = firebase_auth.verify_id_token(token)
        firebase_uid = decoded["uid"]
    except Exception as e:
        raise ValueError(f"Invalid or expired token: {e}")

    result = supabase.table("users").select("*").eq("firebase_uid", firebase_uid).execute()
    if not result.data:
        raise ValueError("User not found")
    user = result.data[0]
    if not user.get("is_active", True):
        raise ValueError("Account is inactive")
    return user
