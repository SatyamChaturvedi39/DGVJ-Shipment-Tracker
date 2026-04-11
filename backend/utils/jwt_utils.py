import os
import jwt
from datetime import datetime, timedelta, timezone

SECRET = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM = "HS256"
EXPIRY_DAYS = 365  # stay logged in for a year


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=EXPIRY_DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> str:
    """Returns user_id (sub claim). Raises jwt.InvalidTokenError on failure."""
    payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    return payload["sub"]
