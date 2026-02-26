from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, PrimaryKeyConstraint
from datetime import datetime, timezone
from app.database import Base


class EntitlementSimulationBackup(Base):
    __tablename__ = "entitlement_simulation_backup"

    ration_card = Column(String(20), nullable=False)
    month_year = Column(String(7), nullable=False)
    wheat_kg = Column(Integer, nullable=False)
    rice_kg = Column(Integer, nullable=False)
    sugar_kg = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        PrimaryKeyConstraint("ration_card", "month_year"),
    )


class SimulationBaseline(Base):
    __tablename__ = "simulation_baseline"

    shop_id = Column(String(20), primary_key=True)
    beneficiaries_count = Column(Integer, nullable=False)
    complaints_count = Column(Integer, nullable=False)
    risk_score = Column(Float, nullable=False)
    total_transactions = Column(Integer, nullable=False, default=0)
    anomaly_count = Column(Integer, nullable=False, default=0)
    risk_level = Column(String(50), nullable=True)
    hash_of_baseline = Column(String(255), nullable=True)
    snapshot_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SimulationEvent(Base):
    __tablename__ = "simulation_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(String(20), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    event_details = Column(JSON, nullable=True)
    executed_by = Column(String(50), nullable=True)
    executed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
