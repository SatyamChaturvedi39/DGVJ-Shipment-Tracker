from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_user, require_role
from database import supabase
from models.shipment import PhaseTransitionRequest, AddStatusEventRequest, LocationUpdateRequest
from websocket.manager import manager

router = APIRouter(tags=["tracking"])

# Which status event indexes (0-based) to mark completed per phase transition
PHASE_EVENT_MAP = {
    "transit":   [0, 1],   # Picked Up + Handed to Carrier
    "delivery":  [2, 3],   # In Transit + Arriving
    "completed": [4, 5],   # Out for Delivery + Delivered
}


@router.put("/shipments/{shipment_id}/phase")
async def transition_phase(
    shipment_id: str,
    body: PhaseTransitionRequest,
    user: dict = Depends(require_role("admin")),
):
    result = supabase.table("shipments").select("*").eq("id", shipment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Shipment not found")

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

    return created


@router.post("/location/update")
async def update_location(
    body: LocationUpdateRequest,
    user: dict = Depends(require_role("employee")),
):
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
