import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # shipment_id -> list of active WebSocket connections
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, shipment_id: str, websocket: WebSocket):
        await websocket.accept()
        if shipment_id not in self.connections:
            self.connections[shipment_id] = []
        self.connections[shipment_id].append(websocket)

    def disconnect(self, shipment_id: str, websocket: WebSocket):
        if shipment_id in self.connections:
            self.connections[shipment_id].remove(websocket)
            if not self.connections[shipment_id]:
                del self.connections[shipment_id]

    async def broadcast(self, shipment_id: str, message: dict):
        """Send a message to all clients watching a specific shipment."""
        clients = self.connections.get(shipment_id, [])
        dead = []
        for ws in clients:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(shipment_id, ws)

    async def send_to(self, websocket: WebSocket, message: dict):
        """Send a message to a single WebSocket client."""
        await websocket.send_text(json.dumps(message))


manager = ConnectionManager()
