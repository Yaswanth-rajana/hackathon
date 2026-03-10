import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.event_emitter import manager
from app.core.security import decode_token

# Initialize logger early
logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/admin/{district}")
async def admin_websocket(websocket: WebSocket, district: str):
    logger.info(f"Incoming WebSocket connection attempt for district: {district}")
    token = websocket.query_params.get("token")
    payload = decode_token(token) if token else None

    if not payload or payload.get("type") != "access" or payload.get("role") != "admin":
        await websocket.close(code=1008)
        return

    token_district = payload.get("district")
    if token_district and token_district not in ("HQ", district):
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, district)
    try:
        while True:
            # We keep the connection open, waiting for client messages if any
            data = await websocket.receive_text()
            logger.debug(f"Received message from WS client in {district}: {data}")
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for district: {district}")
        manager.disconnect(websocket, district)
    except Exception as e:
        logger.error(f"WebSocket error for district {district}: {e}")
        manager.disconnect(websocket, district)
