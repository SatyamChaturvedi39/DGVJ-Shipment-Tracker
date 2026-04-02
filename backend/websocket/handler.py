from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import supabase
from websocket.manager import manager

router = APIRouter()


@router.websocket("/ws/{shipment_id}")
async def websocket_endpoint(websocket: WebSocket, shipment_id: str):
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
