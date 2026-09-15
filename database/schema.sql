-- =============================================================================
-- RENTAL HOUSE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Target Database: Neon PostgreSQL 16+
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean existing schema if re-initializing (safe creation)
DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM ('super_admin', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_status AS ENUM ('active', 'suspended', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM ('draft', 'pending_signature', 'signed', 'expired', 'terminated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reading_type AS ENUM ('electricity', 'water');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'corrected', 'rejected', 'flagged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bill_status AS ENUM ('unpaid', 'pending', 'paid', 'overdue', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 1. ADMINS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role admin_role NOT NULL DEFAULT 'admin',
    status admin_status NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);

-- -----------------------------------------------------------------------------
-- 2. ROOMS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number VARCHAR(20) NOT NULL UNIQUE,
    floor INT NOT NULL DEFAULT 1 CHECK (floor >= 0),
    description TEXT,
    status room_status NOT NULL DEFAULT 'available',
    monthly_rent NUMERIC(14, 2) NOT NULL CHECK (monthly_rent >= 0),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_deleted_at ON rooms(deleted_at);

-- -----------------------------------------------------------------------------
-- 3. USERS (TENANTS) TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(120),
    status user_status NOT NULL DEFAULT 'active',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_room_id ON users(room_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- -----------------------------------------------------------------------------
-- 4. CONTRACTS TABLE (Immutable upon signature)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    contract_number VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rent_amount NUMERIC(14, 2) NOT NULL CHECK (rent_amount >= 0),
    deposit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
    electricity_price NUMERIC(14, 2) NOT NULL CHECK (electricity_price >= 0),
    water_price NUMERIC(14, 2) NOT NULL CHECK (water_price >= 0),
    contract_file_url TEXT,
    contract_file_data BYTEA, -- Stored PDF binary data in database
    document_hash VARCHAR(64), -- SHA-256 hash of final PDF
    contract_content TEXT NOT NULL,
    status contract_status NOT NULL DEFAULT 'draft',
    tenant_signature TEXT, -- Base64 Canvas PNG
    admin_signature TEXT,  -- Base64 Canvas PNG
    signed_at TIMESTAMPTZ,
    signed_ip VARCHAR(45),
    signed_user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_contract_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_contracts_room_id ON contracts(room_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);

-- -----------------------------------------------------------------------------
-- 5. METER IMAGES TABLE (Direct Neon DB Image Storage)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meter_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    reading_type reading_type NOT NULL,
    reading_id UUID, -- References electricity/water reading once created
    image_url TEXT NOT NULL, -- Relative path, cloud URL, or Base64 Data URI
    image_data BYTEA, -- Native binary image stored directly in PostgreSQL
    image_base64 TEXT, -- Base64 encoded image string / Data URI
    mime_type VARCHAR(100) DEFAULT 'image/jpeg',
    file_size INT, -- File size in bytes
    storage_key VARCHAR(255),
    image_hash VARCHAR(64) NOT NULL, -- SHA-256 to prevent duplicate uploads
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    image_quality_score NUMERIC(5, 4) CHECK (image_quality_score BETWEEN 0 AND 1),
    brightness_score NUMERIC(6, 2),
    blur_score NUMERIC(8, 2),
    resolution VARCHAR(30),
    ai_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meter_images_room_id ON meter_images(room_id);
CREATE INDEX IF NOT EXISTS idx_meter_images_type ON meter_images(reading_type);
CREATE INDEX IF NOT EXISTS idx_meter_images_hash ON meter_images(image_hash);

-- -----------------------------------------------------------------------------
-- 6. ELECTRICITY READINGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS electricity_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    meter_image_id UUID REFERENCES meter_images(id) ON DELETE SET NULL,
    reading_month INT NOT NULL CHECK (reading_month BETWEEN 1 AND 12),
    reading_year INT NOT NULL CHECK (reading_year >= 2000),
    previous_value NUMERIC(12, 3) NOT NULL CHECK (previous_value >= 0),
    current_value NUMERIC(12, 3) NOT NULL CHECK (current_value >= 0),
    consumption NUMERIC(12, 3) NOT NULL CHECK (consumption >= 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    image_url TEXT,
    image_data BYTEA, -- Optional direct binary snapshot
    ai_detected_value NUMERIC(12, 3),
    ai_confidence NUMERIC(5, 4) CHECK (ai_confidence BETWEEN 0 AND 1),
    image_quality_score NUMERIC(5, 4),
    verification_status verification_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    is_meter_reset BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_electricity_room_period UNIQUE (room_id, reading_month, reading_year)
);

CREATE INDEX IF NOT EXISTS idx_elec_room_period ON electricity_readings(room_id, reading_year, reading_month);
CREATE INDEX IF NOT EXISTS idx_elec_verification ON electricity_readings(verification_status);

-- -----------------------------------------------------------------------------
-- 7. WATER READINGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    meter_image_id UUID REFERENCES meter_images(id) ON DELETE SET NULL,
    reading_month INT NOT NULL CHECK (reading_month BETWEEN 1 AND 12),
    reading_year INT NOT NULL CHECK (reading_year >= 2000),
    previous_value NUMERIC(12, 3) NOT NULL CHECK (previous_value >= 0),
    current_value NUMERIC(12, 3) NOT NULL CHECK (current_value >= 0),
    consumption NUMERIC(12, 3) NOT NULL CHECK (consumption >= 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    image_url TEXT,
    image_data BYTEA, -- Optional direct binary snapshot
    ai_detected_value NUMERIC(12, 3),
    ai_confidence NUMERIC(5, 4) CHECK (ai_confidence BETWEEN 0 AND 1),
    image_quality_score NUMERIC(5, 4),
    verification_status verification_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES admins(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    is_meter_reset BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_water_room_period UNIQUE (room_id, reading_month, reading_year)
);

CREATE INDEX IF NOT EXISTS idx_water_room_period ON water_readings(room_id, reading_year, reading_month);
CREATE INDEX IF NOT EXISTS idx_water_verification ON water_readings(verification_status);

-- -----------------------------------------------------------------------------
-- 8. BILLS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    electricity_reading_id UUID REFERENCES electricity_readings(id) ON DELETE RESTRICT,
    water_reading_id UUID REFERENCES water_readings(id) ON DELETE RESTRICT,
    billing_month INT NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
    billing_year INT NOT NULL CHECK (billing_year >= 2000),
    electricity_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (electricity_amount >= 0),
    water_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (water_amount >= 0),
    rent_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (rent_amount >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    status bill_status NOT NULL DEFAULT 'unpaid',
    payment_method VARCHAR(50), -- 'cash' | 'transfer'
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bills_room_period UNIQUE (room_id, billing_month, billing_year)
);

CREATE INDEX IF NOT EXISTS idx_bills_room_period ON bills(room_id, billing_year, billing_month);
CREATE INDEX IF NOT EXISTS idx_bills_tenant ON bills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);

-- -----------------------------------------------------------------------------
-- 9. AI PREDICTIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reading_type reading_type NOT NULL,
    reading_id UUID,
    meter_image_id UUID REFERENCES meter_images(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    predicted_value NUMERIC(10, 2),
    confidence NUMERIC(5, 4),
    image_quality_score NUMERIC(5, 4),
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    raw_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_image ON ai_predictions(meter_image_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_created ON ai_predictions(created_at);

-- -----------------------------------------------------------------------------
-- 10. AI TRAINING SAMPLES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_training_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID NOT NULL REFERENCES meter_images(id) ON DELETE RESTRICT,
    expected_value NUMERIC(10, 2),
    verified_value NUMERIC(10, 2) NOT NULL,
    prediction_value NUMERIC(10, 2),
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    dataset_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_training_correct ON ai_training_samples(is_correct);

-- -----------------------------------------------------------------------------
-- 11. AUDIT LOGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_type VARCHAR(50) NOT NULL, -- 'admin' or 'tenant' or 'system'
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- -----------------------------------------------------------------------------
-- 12. NOTIFICATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_type VARCHAR(20) NOT NULL, -- 'tenant' or 'admin'
    recipient_id UUID, -- User ID or Admin ID (NULL for broadcast)
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'bill', 'contract', 'meter', 'warning', 'general'
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id, is_read);

-- -----------------------------------------------------------------------------
-- AUTOMATED UPDATED_AT TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admins_updated_at ON admins;
CREATE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON rooms;
CREATE TRIGGER trg_rooms_updated_at
BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
CREATE TRIGGER trg_contracts_updated_at
BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_electricity_readings_updated_at ON electricity_readings;
CREATE TRIGGER trg_electricity_readings_updated_at
BEFORE UPDATE ON electricity_readings FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_water_readings_updated_at ON water_readings;
CREATE TRIGGER trg_water_readings_updated_at
BEFORE UPDATE ON water_readings FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_bills_updated_at ON bills;
CREATE TRIGGER trg_bills_updated_at
BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- -----------------------------------------------------------------------------
-- CONTRACT IMMUTABILITY TRIGGER
-- Prevents alteration or deletion of signed contracts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_contract_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Block alteration of signed contracts unless status is explicitly reopened
    IF (OLD.status = 'signed' AND NEW.status = 'signed') THEN
        RAISE EXCEPTION 'Signed contracts are legally immutable and cannot be modified without reopening.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_contract_immutability ON contracts;
CREATE TRIGGER trg_enforce_contract_immutability
BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION enforce_contract_immutability();

CREATE OR REPLACE FUNCTION prevent_signed_contract_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status = 'signed') THEN
        RAISE EXCEPTION 'Signed contracts cannot be deleted. Preserving contract history is required.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_signed_contract_deletion ON contracts;
CREATE TRIGGER trg_prevent_signed_contract_deletion
BEFORE DELETE ON contracts FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_deletion();

-- -----------------------------------------------------------------------------
-- IDEMPOTENT UPGRADES FOR EXISTING DATABASES
-- Ensures existing tables get new binary and base64 image fields automatically
-- -----------------------------------------------------------------------------
ALTER TABLE meter_images ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE meter_images ADD COLUMN IF NOT EXISTS image_base64 TEXT;
ALTER TABLE meter_images ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'image/jpeg';
ALTER TABLE meter_images ADD COLUMN IF NOT EXISTS file_size INT;
ALTER TABLE meter_images ALTER COLUMN storage_key DROP NOT NULL;
ALTER TABLE meter_images ALTER COLUMN image_url TYPE TEXT;

ALTER TABLE electricity_readings ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE electricity_readings ALTER COLUMN image_url TYPE TEXT;

ALTER TABLE water_readings ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE water_readings ALTER COLUMN image_url TYPE TEXT;

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_file_data BYTEA;
ALTER TABLE contracts ALTER COLUMN contract_file_url TYPE TEXT;

ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- No service fees whatsoever: completely eliminated
ALTER TABLE contracts DROP COLUMN IF EXISTS other_fee;
ALTER TABLE bills DROP COLUMN IF EXISTS other_amount;
