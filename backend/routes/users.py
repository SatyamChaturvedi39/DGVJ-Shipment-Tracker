from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def get_me():
    # TODO: Extract user from verified Firebase token in Authorization header
    return {
        "id": "mock-id",
        "phone": "+919999999999",
        "name": "Mock User",
        "role": "admin",
        "company_name": None,
        "firebase_uid": "mock-uid",
        "created_at": "2026-01-01T00:00:00Z",
    }
