import os
import signal
import sys
import redis
import structlog
from apscheduler.schedulers.blocking import BlockingScheduler

from app.database import SessionLocal
from app.services.schedule_service import ScheduleService

# Configure structlog for JSON formatting
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()
scheduler = BlockingScheduler()

def apscheduler_job():
    try:
        r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        
        # Acquire a 50-second lock (job runs every 60s)
        if r.set("run_reports_lock", "1", nx=True, ex=50):
            db = SessionLocal()
            try:
                logger.info("Executing scheduled reports job")
                ScheduleService.run_due_reports(db)
                logger.info("Successfully executed scheduled reports job")
            finally:
                db.close()
        else:
            logger.debug("Skipping scheduler job: Lock held by another worker")
    except Exception as e:
        logger.error("Error in scheduler job", exc_info=True)

def heartbeat_job():
    """Runs every 5 minutes to confirm the scheduler is alive."""
    logger.info("Scheduler heartbeat", status="alive", service="scheduler-worker")


def expire_dealers_job():
    """Runs every 12 hours. Bulk-expires dealers whose license has passed.

    - Uses a single batch query + bulk update (no per-row commits)
    - Skips dealers already expired (deduplication)
    - Creates district-scoped notifications
    - Never processes duplicate notifications
    """
    from datetime import datetime, timezone
    from app.models.user import User, UserRole
    from app.models.notification import Notification

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # Fetch dealers to expire (batch — no per-row processing)
        dealers_to_expire = (
            db.query(User)
            .filter(
                User.role == UserRole.dealer,
                User.license_valid_until < now,
                User.dealer_status != "expired",  # Deduplication guard
            )
            .all()
        )

        if not dealers_to_expire:
            logger.debug("No dealers to expire")
            return

        # Collect IDs and district info for notifications before update
        expired_info = [
            {"id": d.id, "name": d.name, "district": d.district, "shop_id": d.shop_id}
            for d in dealers_to_expire
        ]

        # Bulk update in one statement
        dealer_ids = [d.id for d in dealers_to_expire]
        db.query(User).filter(User.id.in_(dealer_ids)).update(
            {"dealer_status": "expired"},
            synchronize_session=False,
        )

        # Create one notification per dealer (district-scoped)
        for info in expired_info:
            notif = Notification(
                district=info["district"],
                type="SYSTEM",
                message=(
                    f"Dealer '{info['name']}' (ID: {info['id']}) license has expired. "
                    f"Shop {info['shop_id']} requires a new dealer assignment."
                ),
                severity="error",
            )
            db.add(notif)

        # Single commit for everything
        db.commit()
        logger.info(
            "dealer.expired_auto",
            count=len(expired_info),
            dealer_ids=dealer_ids,
        )
    except Exception:
        db.rollback()
        logger.error("Error in expire_dealers_job", exc_info=True)
    finally:
        db.close()


def notify_expiring_soon_job():
    """Runs daily. Sends proactive warnings for licenses expiring within 7 days.

    - Only targets active dealers (not already expired)
    - District-scoped notification per dealer
    - Deduplication: skips if notification created in last 24h for same dealer
    """
    from datetime import datetime, timezone, timedelta
    from app.models.user import User, UserRole
    from app.models.notification import Notification

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        warning_window = now + timedelta(days=7)

        # Dealers with license expiring in the next 7 days, still active
        expiring_soon = (
            db.query(User)
            .filter(
                User.role == UserRole.dealer,
                User.dealer_status == "active",
                User.license_valid_until.isnot(None),
                User.license_valid_until > now,          # Not yet expired
                User.license_valid_until <= warning_window,  # Within 7 days
            )
            .all()
        )

        if not expiring_soon:
            logger.debug("No dealers expiring soon — nothing to notify")
            return

        # 24-hour dedup: skip if we already notified about this dealer today
        yesterday = now - timedelta(hours=24)
        notified_count = 0

        for dealer in expiring_soon:
            already_notified = (
                db.query(Notification)
                .filter(
                    Notification.district == dealer.district,
                    Notification.message.like(f"%{dealer.id}%"),
                    Notification.type == "SYSTEM",
                    Notification.created_at > yesterday,
                )
                .first()
            )
            if already_notified:
                continue  # Dedup: skip

            days_left = (dealer.license_valid_until.replace(tzinfo=timezone.utc) - now).days
            notif = Notification(
                district=dealer.district,
                type="SYSTEM",
                message=(
                    f"⚠ Dealer '{dealer.name}' (ID: {dealer.id}) license expires in "
                    f"{days_left} day(s). Shop: {dealer.shop_id}. Renew before expiry."
                ),
                severity="warning",
            )
            db.add(notif)
            notified_count += 1

        db.commit()
        logger.info(
            "dealer.expiring_soon_notified",
            count=notified_count,
            checked=len(expiring_soon),
        )
    except Exception:
        db.rollback()
        logger.error("Error in notify_expiring_soon_job", exc_info=True)
    finally:
        db.close()

def handle_shutdown(signum, frame):
    logger.info("Received shutdown signal. Stopping scheduler...")
    if scheduler.running:
        scheduler.shutdown(wait=False)
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    logger.info("Starting up APScheduler blocking worker...")
    scheduler.add_job(apscheduler_job, 'interval', minutes=1, id='run_reports', misfire_grace_time=3600)
    scheduler.add_job(heartbeat_job, 'interval', minutes=5, id='heartbeat')
    scheduler.add_job(expire_dealers_job, 'interval', hours=12, id='expire_dealers', misfire_grace_time=3600)
    scheduler.add_job(notify_expiring_soon_job, 'interval', hours=24, id='expiry_warnings', misfire_grace_time=3600)
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass
