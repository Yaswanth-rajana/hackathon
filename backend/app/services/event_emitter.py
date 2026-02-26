import json
from typing import Dict, List
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps district to a list of active websocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, district: str):
        await websocket.accept()
        if district not in self.active_connections:
            self.active_connections[district] = []
        self.active_connections[district].append(websocket)
        logger.info(f"WebSocket connected for district: {district}")

    def disconnect(self, websocket: WebSocket, district: str):
        if district in self.active_connections:
            if websocket in self.active_connections[district]:
                self.active_connections[district].remove(websocket)
            if not self.active_connections[district]:
                del self.active_connections[district]
        logger.info(f"WebSocket disconnected for district: {district}")

    async def emit_event(self, district: str, event_type: str, entity_id: str, entity_type: str, payload: dict = None):
        """
        Emits an event to a specific district.
        """
        if district in self.active_connections:
            import datetime
            message = {
                "type": event_type,
                "district": district,
                "entity_id": entity_id,
                "entity_type": entity_type,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "payload": payload or {}
            }
            # Only broadcast if there are connections
            # Only broadcast if there are connections
            stale_connections = []
            for connection in self.active_connections[district]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to send WS message: {e}")
                    stale_connections.append(connection)
            
            # Cleanup broken sockets
            for stale in stale_connections:
                self.disconnect(stale, district)

    async def broadcast_to_district(self, district: str, data: dict):
        """Phase 2 Shortcut: broadcast raw dictionary to district."""
        await self.emit_event(
            district=district,
            event_type=data.get("type", "notification"),
            entity_id=data.get("transaction_id", "system"),
            entity_type="blockchain_transaction",
            payload=data
        )

    async def broadcast_ml_alert(self, payload: dict):
        """
        Phase 4.6: Broadcasts an ML_ALERT event to all connected clients across all districts.
        """
        stale_connections = []
        for district, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_json(payload)
                except Exception as e:
                    logger.error(f"Failed to send ML_ALERT WS message: {e}")
                    stale_connections.append((connection, district))
        
        # Cleanup broken sockets
        for stale, district in stale_connections:
            self.disconnect(stale, district)

manager = ConnectionManager()
