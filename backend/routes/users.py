from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_user, require_role
from database import supabase
from models.user import UpdateProfileRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user


@router.put("/me")
def update_me(body: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return user
    result = supabase.table("users").update(updates).eq("id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update profile")
    return result.data[0]


@router.get("/employees")
def get_employees(_user: dict = Depends(require_role("admin"))):
    result = supabase.table("users").select("*").eq("role", "employee").eq("is_active", True).execute()
    return result.data


@router.get("/customers")
def get_customers(_user: dict = Depends(require_role("admin"))):
    result = supabase.table("users").select("*").eq("role", "customer").eq("is_active", True).execute()
    return result.data
