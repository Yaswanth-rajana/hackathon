import os
from fastapi import HTTPException

def enforce_demo_mode(shop_id: str):
    """
    Restrict simulation and audit actions to DEMO_001 if DEMO_MODE is enabled.
    """
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"
    if demo_mode and shop_id != "DEMO_001":
        raise HTTPException(
            status_code=403, 
            detail=f"Action restricted to demo shop in demo mode. Targeted shop: {shop_id}"
        )
