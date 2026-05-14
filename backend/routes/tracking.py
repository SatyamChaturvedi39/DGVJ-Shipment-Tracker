from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from dependencies import get_current_user, require_role
from database import supabase
from models.shipment import PhaseTransitionRequest, AddStatusEventRequest, LocationUpdateRequest
from websocket.manager import manager

router = APIRouter(tags=["tracking"])

# How many initial status events (sort_order 1–6, ascending) should be
# marked is_completed=True when the shipment reaches each phase.
# sync_events_to_phase() uses this to mark/unmark events correctly on
# both forward transitions AND admin backward transitions.
PHASE_COMPLETE_COUNT = {
    "pickup": 0,            # nothing completed yet
    "transit": 2,           # Picked Up + Heading to Carrier
    "handed_to_carrier": 3, # + Handed to Carrier
    "out_for_delivery": 5,  # + Picked Up from Carrier + Out for Delivery
    "completed": 6,         # + Delivered
}


def sync_events_to_phase(shipment_id: str, new_phase: str) -> None:
    """Mark initial status events (sort_order 1–6) complete/incomplete
    based on the new phase. Handles both forward and backward transitions.
    Also sets created_at to now when newly completing an event so customers
    see an accurate timestamp instead of the original shipment creation time."""
    complete_count = PHASE_COMPLETE_COUNT.get(new_phase, 0)
    now = datetime.now(timezone.utc).isoformat()

    events = (
        supabase.table("status_events")
        .select("id,is_completed")
        .eq("shipment_id", shipment_id)
        .lte("sort_order", 6)
        .order("sort_order")
        .order("created_at")
        .execute()
    )
    if not events.data:
        return

    for i, event in enumerate(events.data):
        should_complete = i < complete_count
        was_completed = event.get("is_completed", False)
        update: dict = {"is_completed": should_complete}
        if should_complete and not was_completed:
            # Newly completed — stamp with current time so timeline shows real date
            update["created_at"] = now
        supabase.table("status_events").update(update).eq("id", event["id"]).execute()


@router.put("/shipments/{shipment_id}/phase")
async def transition_phase(
    shipment_id: str,
    body: PhaseTransitionRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role("admin", "employee")),
):
    try:
        result = supabase.table("shipments").select("*").eq("id", shipment_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Shipment not found")

        shipment = result.data[0]

        # ── Employee authorization ─────────────────────────────────────────────────
        if user["role"] == "employee":
            uid = user["id"]
            pickup_id = shipment.get("pickup_employee_id")
            delivery_id = shipment.get("delivery_employee_id")
            is_pickup = pickup_id == uid
            is_delivery = delivery_id == uid

            if not is_pickup and not is_delivery:
                raise HTTPException(status_code=403, detail="You are not assigned to this shipment")

            if body.phase == "pickup":
                if not is_pickup:
                    raise HTTPException(status_code=403, detail="Only the pickup driver can undo a pickup")
            elif body.phase in ("transit", "handed_to_carrier"):
                if not is_pickup:
                    raise HTTPException(status_code=403, detail="Only the pickup driver can perform this action")
            elif body.phase in ("out_for_delivery", "completed"):
                if not is_delivery:
                    raise HTTPException(status_code=403, detail="Only the delivery driver can perform this action")

        # ── Apply phase update ────────────────────────────────────────────────────
        updates: dict = {"current_phase": body.phase}
        if body.phase == "completed":
            updates["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif shipment.get("completed_at"):
            updates["completed_at"] = None

        supabase.table("shipments").update(updates).eq("id", shipment_id).execute()

        # Sync timeline events
        sync_events_to_phase(shipment_id, body.phase)

        # Broadcast via WebSocket
        await manager.broadcast(shipment_id, {
            "type": "phase_change",
            "phase": body.phase,
            "label": body.phase.replace('_', ' ').title(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        if body.phase == "handed_to_carrier":
            background_tasks.add_task(_generate_etas_with_ai, shipment)

        return {"phase": body.phase}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Tracking] Error transitioning phase: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _generate_etas_with_ai(shipment: dict) -> None:
    try:
        from openai import OpenAI
        import os
        import json
        
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key: return
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
        
        origin = shipment.get("origin")
        dest = shipment.get("destination")
        mode = shipment.get("transport_mode")
        now_str = datetime.now().strftime('%b %d, %I:%M %p')
        
        prompt = f"""
        You are a logistics AI for 'Digvijay Express', an Indian logistics company. 
        A shipment has just been handed to the carrier (train/airline) and is traveling from {origin} to {dest} via {mode}.
        Based on the real-world distance and travel time between {origin} and {dest} in India, estimate a realistic future date and time for the following final 3 milestones. 
        Assume the current time of departure is {now_str}.
        Make the estimations highly realistic. For example, a train from Delhi to Mumbai takes ~16-24 hours. A flight takes ~2 hours.
        Output valid JSON only with exactly these keys.
        {{
            "Picked Up from Carrier": "e.g. Oct 14, 2:00 PM",
            "Out for Delivery": "e.g. Oct 14, 4:00 PM",
            "Delivered": "e.g. Oct 14, 7:00 PM"
        }}
        """
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        data = json.loads(response.choices[0].message.content)
        
        for label, eta in data.items():
            event_res = supabase.table("status_events").select("id,description").eq("shipment_id", shipment["id"]).eq("label", label).execute()
            if event_res.data:
                ev_id = event_res.data[0]["id"]
                desc = event_res.data[0].get("description", "")
                if "(ETA:" in desc:
                    desc = desc.split("(ETA:")[0].strip()
                new_desc = f"{desc} (ETA: {eta})"
                supabase.table("status_events").update({"description": new_desc}).eq("id", ev_id).execute()
                
                # Broadcast the update so UI refreshes
                await manager.broadcast(shipment["id"], {
                    "type": "status_update",
                    "label": label,
                    "description": new_desc,
                })
    except Exception as e:
        print("[AI] Failed to generate ETAs:", e)


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
        "sort_order": 99,
    }
    result = supabase.table("status_events").insert(event).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create status event")

    created = result.data[0]

    await manager.broadcast(shipment_id, {
        "type": "status_update",
        "label": body.label,
        "description": body.description,
        "timestamp": created["created_at"],
    })

    return {**created, "timestamp": created["created_at"]}


@router.post("/location/update")
async def update_location(
    body: LocationUpdateRequest,
    user: dict = Depends(require_role("employee")),
):
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
    row = result.data[0]
    return {**row, "timestamp": row["created_at"]}
