import random
import string
from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_user, require_role
from database import supabase
from models.shipment import CreateShipmentRequest, UpdateShipmentRequest

router = APIRouter(prefix="/shipments", tags=["shipments"])

# Status event templates — created for every new shipment
INITIAL_STATUS_EVENTS = [
    {"label": "Picked Up", "description": "Goods picked up from sender"},
    {"label": "Handed to Carrier", "description": "Goods handed to railway/airport"},
    {"label": "In Transit", "description": "Goods in transit"},
    {"label": "Arriving", "description": "Shipment arriving at destination city"},
    {"label": "Out for Delivery", "description": "Goods out for delivery to recipient"},
    {"label": "Delivered", "description": "Goods delivered to recipient"},
]


def _generate_tracking_id() -> str:
    chars = string.ascii_uppercase + string.digits
    return "DGVJ-" + "".join(random.choices(chars, k=8))


@router.post("")
def create_shipment(body: CreateShipmentRequest, user: dict = Depends(require_role("admin"))):
    # Generate unique tracking ID
    tracking_id = _generate_tracking_id()

    # Build shipment row
    shipment_data = body.model_dump(exclude={"customer_ids"}, exclude_none=True)
    shipment_data["tracking_id"] = tracking_id
    shipment_data["current_phase"] = "pickup"
    shipment_data["created_by"] = user["id"]

    result = supabase.table("shipments").insert(shipment_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create shipment")

    shipment = result.data[0]
    shipment_id = shipment["id"]

    # Create shipment_permissions for each customer
    if body.customer_ids:
        perms = [
            {"shipment_id": shipment_id, "customer_user_id": cid}
            for cid in body.customer_ids
        ]
        supabase.table("shipment_permissions").insert(perms).execute()

    # Create 6 initial status events (all not completed)
    events = [
        {"shipment_id": shipment_id, "label": e["label"], "description": e["description"], "is_completed": False}
        for e in INITIAL_STATUS_EVENTS
    ]
    supabase.table("status_events").insert(events).execute()

    return shipment


@router.get("")
def get_shipments(user: dict = Depends(get_current_user)):
    role = user["role"]
    user_id = user["id"]

    if role == "admin":
        result = supabase.table("shipments").select("*").order("created_at", desc=True).execute()
        return result.data

    if role == "employee":
        result = (
            supabase.table("shipments")
            .select("*")
            .or_(f"pickup_employee_id.eq.{user_id},delivery_employee_id.eq.{user_id}")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data

    # customer
    perms = supabase.table("shipment_permissions").select("shipment_id").eq("customer_user_id", user_id).execute()
    if not perms.data:
        return []
    ids = [p["shipment_id"] for p in perms.data]
    result = supabase.table("shipments").select("*").in_("id", ids).order("created_at", desc=True).execute()
    return result.data


@router.get("/{shipment_id}")
def get_shipment(shipment_id: str, user: dict = Depends(get_current_user)):
    result = supabase.table("shipments").select("*").eq("id", shipment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = result.data[0]
    _assert_access(user, shipment, shipment_id)

    # Attach status events
    events = supabase.table("status_events").select("*").eq("shipment_id", shipment_id).order("created_at").execute()
    shipment["status_events"] = events.data

    return shipment


@router.put("/{shipment_id}")
def update_shipment(shipment_id: str, body: UpdateShipmentRequest, user: dict = Depends(require_role("admin"))):
    customer_ids = body.customer_ids
    updates = body.model_dump(exclude={"customer_ids"}, exclude_none=True)

    if updates:
        result = supabase.table("shipments").update(updates).eq("id", shipment_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Shipment not found")

    # Replace permissions if customer_ids provided
    if customer_ids is not None:
        supabase.table("shipment_permissions").delete().eq("shipment_id", shipment_id).execute()
        if customer_ids:
            perms = [{"shipment_id": shipment_id, "customer_user_id": cid} for cid in customer_ids]
            supabase.table("shipment_permissions").insert(perms).execute()

    result = supabase.table("shipments").select("*").eq("id", shipment_id).execute()
    return result.data[0]


@router.delete("/{shipment_id}")
def delete_shipment(shipment_id: str, user: dict = Depends(require_role("admin"))):
    result = supabase.table("shipments").delete().eq("id", shipment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return {"detail": "Shipment deleted"}


def _assert_access(user: dict, shipment: dict, shipment_id: str):
    """Raise 403 if the user has no access to this shipment."""
    role = user["role"]
    user_id = user["id"]

    if role == "admin":
        return

    if role == "employee":
        if user_id not in (shipment.get("pickup_employee_id"), shipment.get("delivery_employee_id")):
            raise HTTPException(status_code=403, detail="Not assigned to this shipment")
        return

    # customer
    perm = (
        supabase.table("shipment_permissions")
        .select("id")
        .eq("shipment_id", shipment_id)
        .eq("customer_user_id", user_id)
        .execute()
    )
    if not perm.data:
        raise HTTPException(status_code=403, detail="No access to this shipment")
