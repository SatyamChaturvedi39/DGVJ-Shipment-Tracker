from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_user, require_role
from database import supabase
from models.user import UpdateProfileRequest, CreateUserRequest, AdminUpdateUserRequest

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


@router.get("")
def get_all_users(_user: dict = Depends(require_role("admin"))):
    result = supabase.table("users").select("*").neq("role", "admin").order("role").order("name").execute()
    return result.data


@router.post("", status_code=201)
def create_user(body: CreateUserRequest, _user: dict = Depends(require_role("admin"))):
    existing = supabase.table("users").select("id").eq("phone", body.phone).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="A user with this phone number already exists")
    new_user = {
        "name": body.name,
        "phone": body.phone,
        "role": body.role,
        "company_name": body.company_name,
        "is_active": True,
    }
    result = supabase.table("users").insert(new_user).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    return result.data[0]


@router.put("/{user_id}")
def admin_update_user(user_id: str, body: AdminUpdateUserRequest, _user: dict = Depends(require_role("admin"))):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = supabase.table("users").update(updates).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


@router.delete("/{user_id}")
def delete_user(user_id: str, _user: dict = Depends(require_role("admin"))):
    result = supabase.table("users").update({"is_active": False}).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"deleted": True}
