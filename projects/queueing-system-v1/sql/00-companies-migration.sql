-- ============================================================
-- 00-companies-migration.sql
-- Add geo columns to companies table for distance-based filtering
-- Run BEFORE 01-pipeline-queue-table.sql
-- ============================================================

-- Enable extensions for geo-distance queries
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Add latitude/longitude columns (from Google Places, used for geo-filter)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS latitude DECIMAL(8,4);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,4);

-- discovery_metro already exists on companies table (schema.sql)
-- Adding IF NOT EXISTS guard for safety in case it doesn't
ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovery_metro TEXT;

-- Index for filtering companies by discovery metro
CREATE INDEX IF NOT EXISTS idx_companies_discovery_metro
  ON companies (discovery_metro);

-- Index for geo queries (earthdistance uses these)
CREATE INDEX IF NOT EXISTS idx_companies_lat_lon
  ON companies (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN companies.latitude IS 'Latitude from Google Places. Used for geo-distance filtering.';
COMMENT ON COLUMN companies.longitude IS 'Longitude from Google Places. Used for geo-distance filtering.';
