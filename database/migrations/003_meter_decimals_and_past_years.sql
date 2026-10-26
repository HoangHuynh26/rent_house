-- Migration 003: Expand meter readings precision to NUMERIC(12, 3) and allow past years >= 2000

-- 1. Electricity Readings: Update precision
ALTER TABLE electricity_readings ALTER COLUMN previous_value TYPE NUMERIC(12, 3);
ALTER TABLE electricity_readings ALTER COLUMN current_value TYPE NUMERIC(12, 3);
ALTER TABLE electricity_readings ALTER COLUMN consumption TYPE NUMERIC(12, 3);
ALTER TABLE electricity_readings ALTER COLUMN ai_detected_value TYPE NUMERIC(12, 3);

-- 2. Water Readings: Update precision
ALTER TABLE water_readings ALTER COLUMN previous_value TYPE NUMERIC(12, 3);
ALTER TABLE water_readings ALTER COLUMN current_value TYPE NUMERIC(12, 3);
ALTER TABLE water_readings ALTER COLUMN consumption TYPE NUMERIC(12, 3);
ALTER TABLE water_readings ALTER COLUMN ai_detected_value TYPE NUMERIC(12, 3);

-- 3. Relax year constraints to allow historical data back to year 2000
ALTER TABLE electricity_readings DROP CONSTRAINT IF EXISTS electricity_readings_reading_year_check;
ALTER TABLE electricity_readings ADD CONSTRAINT electricity_readings_reading_year_check CHECK (reading_year >= 2000);

ALTER TABLE water_readings DROP CONSTRAINT IF EXISTS water_readings_reading_year_check;
ALTER TABLE water_readings ADD CONSTRAINT water_readings_reading_year_check CHECK (reading_year >= 2000);

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_billing_year_check;
ALTER TABLE bills ADD CONSTRAINT bills_billing_year_check CHECK (billing_year >= 2000);
