import logging
import os
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# Create tables (for simplicity in sprint, though Alembic is PRO, 
# prompt implicitly allows manual/auto creation. 
# "Manually insert one dealer" implies tables must exist).
Base.metadata.create_all(bind=engine)

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

app.include_router(admin_analytics_router, prefix="/api/admin/analytics", tags=["Admin Analytics"])
app.include_router(admin_reports_router, prefix="/api/admin/reports", tags=["Admin Reports"])
app.include_router(admin_schedule_router, prefix="/api/admin/schedule", tags=["Admin Schedule"])
app.include_router(admin_forecast_router, prefix="/api/admin/forecast", tags=["Admin Forecast"])
app.include_router(admin_dealer_router, prefix="/api/admin/dealers", tags=["Admin Dealers"])

from app.utils.cache import init_redis_cache
from app.services.blockchain.crypto import initialize_keys

@app.on_event("startup")
async def startup():
    await init_redis_cache()
    # Phase 3 Digital Signatures initialization (RSA Keys)
    initialize_keys()

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Healthy"}

@app.get("/")
def read_root():
    return {"message": "Government Auth System API is running"}
