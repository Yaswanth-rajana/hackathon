-- Dealer Sprint Phase 1 — Migration
-- Run: psql hackathon_db < scripts/migrate_dealer_phase1.sql

-- 1. Add shop_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_id VARCHAR(20);
CREATE INDEX IF NOT EXISTS ix_users_shop_id ON users(shop_id);

-- 2. Create beneficiaries table
CREATE TABLE IF NOT EXISTS beneficiaries (
    ration_card VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    family_members INTEGER DEFAULT 1,
    mobile VARCHAR(15),
    mobile_verified BOOLEAN DEFAULT FALSE,
    account_status VARCHAR(20) DEFAULT 'inactive',
    pin_hash VARCHAR(255),
    shop_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_beneficiaries_ration_card ON beneficiaries(ration_card);
CREATE INDEX IF NOT EXISTS ix_beneficiaries_shop_id ON beneficiaries(shop_id);
