from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_user, require_role
from database import supabase
from models.shipment import PhaseTransitionRequest, AddStatusEventRequest, LocationUpdateRequest
from websocket.manager import manager

router = APIRouter(tags=["tracking"])

# Which status event indexes (0-based, sorted by sort_order) to mark completed per phase transition
PHASE_EVENT_MAP = {
    "transit":           [0],     # Picked Up (sort_order 1)
    "handed_to_carrier": [1, 2],  # Heading to Carrier + Handed to Carrier (sort_order 2, 3)
    "out_for_delivery":  [3, 4],  # Picked Up from Carrier + Out for Delivery (sort_order 4, 5)
    "completed":         [5],     # Delivered (sort_order 6)
}


@router.put("/shipments/{shipment_id}/phase")
async def transition_phase(
    shipment_id: str,
    body: PhaseTransitionRequest,
    user: dict = Depends(require_role("admin", "employee")),
):
    result = supabase.table("shipments").select("*").eq("id", shipment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = result.data[0]

    # Employees can only advance phases for shipments they're assigned to.
    # Pickup driver owns: pickup→transit, transit→handed_to_carrier
    # Delivery driver owns: handed_to_carrier→out_for_delivery, out_for_delivery→completed
    if user["role"] == "employee":
        uid = user["id"]
        is_pickup = shipment.get("pickup_employee_id") == uid
        is_delivery = shipment.get("delivery_employee_id") == uid
        if not is_pickup and not is_delivery:
            raise HTTPException(status_code=403, detail="You are not assigned to this shipment")
        if body.phase in ("transit", "handed_to_carrier") and not is_pickup:
            raise HTTPException(status_code=403, detail="Only the pickup driver can perform this action")
        if body.phase in ("out_for_delivery", "completed") and not is_delivery:
            raise HTTPException(status_code=403, detail="Only the delivery driver can perform this action")

    updates: dict = {"current_phase": body.phase}
    if body.phase == "completed":
        updates["completed_at"] = datetime.now(timezone.utc).isoformat()

    supabase.table("shipments").update(updates).eq("id", shipment_id).execute()

    # Mark relevant status events as completed
    event_indexes = PHASE_EVENT_MAP.get(body.phase, [])
    if event_indexes:
        events = (
            supabase.table("status_events")
            .select("id")
            .eq("shipment_id", shipment_id)
            .order("sort_order")
            .order("created_at")
            .execute()
        )
        ids_to_complete = [events.data[i]["id"] for i in event_indexes if i < len(events.data)]
        if ids_to_complete:
            supabase.table("status_events").update({"is_completed": True}).in_("id", ids_to_complete).execute()

    # Broadcast phase change via WebSocket
    await manager.broadcast(shipment_id, {
        "type": "phase_change",
        "phase": body.phase,
        "label": body.phase.capitalize(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {"phase": body.phase}


@router.post("/shipments/{shipment_id}/status-event")
async def add_status_event(
    shipment_id: str,
    body: AddStatusEventRequest,
    user: dict = Depends(require_role("admin")),
):
    event = {
        "shipment_id": shipment_id,
        "label": body.label,
        "description": body.description,
        "is_completed": True,
    }
    result = supabase.table("status_events").insert(event).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create status event")

    created = result.data[0]

    # Broadcast to WebSocket clients watching this shipment
    await manager.broadcast(shipment_id, {
        "type": "status_update",
        "label": body.label,
        "description": body.description,
        "timestamp": created["created_at"],
    })

    # Map created_at → timestamp so frontend StatusEvent type is satisfied
    return {**created, "timestamp": created["created_at"]}


@router.post("/location/update")
async def update_location(
    body: LocationUpdateRequest,
    user: dict = Depends(require_role("employee")),
):
    # Verify employee is assigned to this shipment
    shipment_result = supabase.table("shipments").select("pickup_employee_id,delivery_employee_id").eq("id", body.shipment_id).execute()
    if not shipment_result.data:
        raise HTTPException(status_code=404, detail="Shipment not found")
    s = shipment_result.data[0]
    uid = user["id"]
    if uid != s.get("pickup_employee_id") and uid != s.get("delivery_employee_id"):
        raise HTTPException(status_code=403, detail="You are not assigned to this shipment")

    row = {
        "shipment_id": body.shipment_id,
        "employee_id": user["id"],
        "lat": body.lat,
        "lng": body.lng,
    }
    supabase.table("location_updates").insert(row).execute()

    # Broadcast to all WebSocket clients watching this shipment
    await manager.broadcast(body.shipment_id, {
        "type": "location",
        "lat": body.lat,
        "lng": body.lng,
        "employee_id": user["id"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "ok"}


@router.get("/location/{shipment_id}/latest")
def get_latest_location(shipment_id: str, user: dict = Depends(get_current_user)):
    result = (
        supabase.table("location_updates")
        .select("*")
        .eq("shipment_id", shipment_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]
