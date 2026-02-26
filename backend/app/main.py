import logging
import os
import structlog
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from app.routers import auth_router, dealer_router, transaction_router, blockchain_router, admin_router, citizen_router
from app.routes.admin_dashboard_routes import router as admin_dashboard_router
from app.database import Base, engine
from app.config import settings
from app.models.beneficiary import Beneficiary  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
from app.models.blockchain_ledger import BlockchainLedger  # noqa: F401
from app.models.anomaly import Anomaly  # noqa: F401
from app.models.shop import Shop  # noqa: F401
from app.models.risk_score import RiskScore  # noqa: F401
from app.models.audit import Audit  # noqa: F401
from app.models.activity_log import ActivityLog  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.entitlement import Entitlement  # noqa: F401
from app.models.idempotency import IdempotencyKey # noqa: F401
from app.models.simulation import EntitlementSimulationBackup, SimulationEvent, SimulationBaseline # noqa: F401
from app.models.inspection import Inspection # noqa: F401
from app.models.sms_log import SmsLog # noqa: F401
from app.models.suspension_record import SuspensionRecord # noqa: F401
from scripts.phase1_db_migration import run_migration

# Setup structured JSON logging
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)
logger = structlog.get_logger(__name__)

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.rate_limiter import limiter
from prometheus_fastapi_instrumentator import Instrumentator
import time
import uuid
from fastapi import Request

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION
)

UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

@app.middleware("http")
async def add_security_headers_and_request_id(request: Request, call_next):
    # Skip WebSocket upgrade requests
    if request.scope["type"] == "websocket":
        return await call_next(request)

    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    logger.info(
        "Request processed",
        request_id=request_id,
        path=request.url.path,
        method=request.method,
        status_code=response.status_code,
        response_time=process_time
    )
    
    from app.core.metrics import REQUEST_LATENCY
    # Only observe standard routes
    if not request.url.path.startswith("/metrics"):
        REQUEST_LATENCY.labels(method=request.method, endpoint=request.url.path).observe(process_time)
        
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self' ws: wss:; "
        "font-src 'self' data:;"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    return response

Instrumentator().instrument(app).expose(app)



# CORS — Never wildcard in production
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.routes.admin_complaint_routes import router as admin_complaint_router
from app.routes.admin_audit_routes import router as admin_audit_router
from app.routes.admin_recommendation_routes import router as admin_recommendation_router
from app.routes.admin_log_routes import router as admin_log_router
from app.routes.admin_notification_routes import router as admin_notification_router
from app.sockets.admin_ws import router as admin_ws_router

app.include_router(admin_ws_router)
app.include_router(auth_router.router)
app.include_router(dealer_router.router)
app.include_router(transaction_router.router)
app.include_router(blockchain_router.router)
app.include_router(admin_router.router)
app.include_router(admin_complaint_router)
app.include_router(admin_audit_router)
app.include_router(admin_recommendation_router)
app.include_router(admin_log_router)
app.include_router(admin_notification_router)
app.include_router(citizen_router.router)
app.include_router(admin_dashboard_router)
from app.routes.admin_analytics_routes import router as admin_analytics_router
from app.routes.admin_reports_routes import router as admin_reports_router
from app.routes.admin_schedule_routes import router as admin_schedule_router
from app.routes.admin_forecast_routes import router as admin_forecast_router
from app.routes.admin_dealer_routes import router as admin_dealer_router
from app.routers.admin_simulation_router import router as admin_simulation_router
from app.routers.admin_ml_router import router as admin_ml_router
from app.routes.admin_alert_routes import router as admin_alert_router
from app.routes.public_proof_routes import router as public_proof_router
from app.routers.admin_audit_router import router as admin_manual_audit_router
from app.routes.admin_governance_inspection_routes import router as admin_governance_inspection_router
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import HTTPException

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    
    logger.error(
        "Unhandled exception", 
        error=str(exc),
        path=request.url.path,
        method=request.method
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal Server Error",
            "type": exc.__class__.__name__
        }
    )

app.include_router(admin_analytics_router, prefix="/api/admin/analytics", tags=["Admin Analytics"])
app.include_router(admin_reports_router, prefix="/api/admin/reports", tags=["Admin Reports"])
app.include_router(admin_schedule_router, prefix="/api/admin/schedule", tags=["Admin Schedule"])
app.include_router(admin_forecast_router, prefix="/api/admin/forecast", tags=["Admin Forecast"])
app.include_router(admin_dealer_router, prefix="/api/admin/dealers", tags=["Admin Dealers"])
app.include_router(
    admin_simulation_router,
    prefix="/api/admin/simulate",
    tags=["Admin Simulation"]
)
app.include_router(
    admin_manual_audit_router,
    prefix="/api/admin/audit",
    tags=["Admin Audit"]
)
app.include_router(admin_alert_router)
app.include_router(public_proof_router)
app.include_router(
    admin_ml_router,
    prefix="/api/admin/ml",
    tags=["Admin Intelligence"]
)
app.include_router(
    admin_governance_inspection_router,
    prefix="/api/admin/governance/inspections",
    tags=["Admin Governance Inspections"]
)

from app.utils.cache import init_redis_cache
from app.services.blockchain.crypto import initialize_keys

@app.on_event("startup")
async def startup():
    skip_db_init = os.getenv("SKIP_DB_INIT", "false").lower() == "true"
    require_db_on_startup = os.getenv("REQUIRE_DB_ON_STARTUP", "false").lower() == "true"

    if not skip_db_init:
        try:
            run_migration()
            Base.metadata.create_all(bind=engine)
            logger.info("Database initialization complete")
        except Exception as exc:
            logger.error("Database initialization failed", error=str(exc))
            if require_db_on_startup:
                raise

    await init_redis_cache()
    # Phase 3 Digital Signatures initialization (RSA Keys)
    initialize_keys()
    # Ensure blockchain genesis block exists in DB (survives simulation resets & fresh DBs)
    from app.services.blockchain.blockchain import blockchain
    from app.database import SessionLocal
    _db = SessionLocal()
    try:
        blockchain.ensure_genesis_exists(_db)
        logger.info("Blockchain genesis block verified on startup")
    except Exception as e:
        logger.error(f"Failed to ensure blockchain genesis on startup: {e}")
    finally:
        _db.close()

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Healthy"}

@app.get("/")
def read_root():
    return {"message": "Government Auth System API is running"}
