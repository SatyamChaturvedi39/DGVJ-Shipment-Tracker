from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import supabase
from dependencies import verify_token_string
from websocket.manager import manager

router = APIRouter()


@router.websocket("/ws/{shipment_id}")
async def websocket_endpoint(websocket: WebSocket, shipment_id: str, token: str = ""):
    # Authenticate — reject unauthenticated connections
    if not token:
        await websocket.close(code=4001)
        return

    try:
        user = await verify_token_string(token)
    except ValueError:
        await websocket.close(code=4001)
        return

    # Authorise — check user has access to this shipment
    role = user.get("role")
    user_id = user.get("id")

    if role == "employee":
        result = supabase.table("shipments").select("pickup_employee_id,delivery_employee_id").eq("id", shipment_id).execute()
        if not result.data:
            await websocket.close(code=4004)
            return
        s = result.data[0]
        if user_id != s.get("pickup_employee_id") and user_id != s.get("delivery_employee_id"):
            await websocket.close(code=4003)
            return
    elif role == "customer":
        perm = (
            supabase.table("shipment_permissions")
            .select("id")
            .eq("shipment_id", shipment_id)
            .eq("customer_user_id", user_id)
            .execute()
        )
        if not perm.data:
            await websocket.close(code=4003)
            return
    # admin: no extra check needed

    await manager.connect(shipment_id, websocket)
    try:
        # On connect: send the current phase and last known location immediately
        shipment_result = supabase.table("shipments").select("current_phase").eq("id", shipment_id).execute()
        if shipment_result.data:
            await manager.send_to(websocket, {
                "type": "phase_change",
                "phase": shipment_result.data[0]["current_phase"],
            })

        location_result = (
            supabase.table("location_updates")
            .select("*")
            .eq("shipment_id", shipment_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if location_result.data:
            loc = location_result.data[0]
            await manager.send_to(websocket, {
                "type": "location",
                "lat": loc["lat"],
                "lng": loc["lng"],
                "employee_id": loc["employee_id"],
                "timestamp": loc["created_at"],
            })

        # Keep connection alive — clients are receive-only (server pushes updates)
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(shipment_id, websocket)
