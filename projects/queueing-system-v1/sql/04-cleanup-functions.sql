-- ============================================================
-- 04-cleanup-functions.sql
-- Queuing System v1 — Post-Discovery Cleanup Functions
-- Run in Supabase SQL Editor AFTER tables 01-03 exist
-- ============================================================

-- ------------------------------------------------------------
-- 2a. Country filter — remove non-US leads from a US metro
-- Only runs on the metro being processed (Toronto is safe)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_country_filter(p_metro TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM companies
  WHERE discovery_metro = p_metro
    AND country IS NOT NULL
    AND country NOT IN ('US');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('deleted_count', v_deleted);
END;
$$;

COMMENT ON FUNCTION cleanup_country_filter IS 'Remove non-US companies from a specific metro. Safe for Toronto — it would never be passed as p_metro for a US queue item.';

-- ------------------------------------------------------------
-- 2b. Category blocklist — remove companies matching blocked
--     categories UNLESS they contain safe massage terms
-- Relies on FK ON DELETE CASCADE for contacts/social_profiles
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_category_blocklist(p_metro TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM companies c
  WHERE c.discovery_metro = p_metro
    -- Matches ANY active blocklist pattern
    AND EXISTS (
      SELECT 1 FROM category_blocklist bl
      WHERE bl.active = TRUE
        AND c.category ILIKE '%' || bl.category_pattern || '%'
    )
    -- Does NOT contain any safe massage term
    AND c.category NOT ILIKE '%Massage%'
    AND c.category NOT ILIKE '%Bodywork%'
    AND c.category NOT ILIKE '%Day Spa%'
    AND c.category NOT ILIKE '%Wellness%'
    AND c.category NOT ILIKE '%Therapeutic%';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('deleted_count', v_deleted);
END;
$$;

COMMENT ON FUNCTION cleanup_category_blocklist IS 'Remove companies matching blocked categories. Safe-term exemption keeps "Massage + Hair Salon" combos.';

-- ------------------------------------------------------------
-- 2c. Chain blocklist — remove known non-massage retail chains
-- Matches on company name OR domain
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_chain_blocklist(p_metro TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM companies c
  WHERE c.discovery_metro = p_metro
    AND EXISTS (
      SELECT 1 FROM chain_blocklist bl
      WHERE bl.active = TRUE
        AND (
          c.name ILIKE '%' || bl.chain_name || '%'
          OR (bl.domain_pattern IS NOT NULL AND c.domain ILIKE '%' || bl.domain_pattern || '%')
        )
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('deleted_count', v_deleted);
END;
$$;

COMMENT ON FUNCTION cleanup_chain_blocklist IS 'Remove known non-massage retail chains by name or domain match.';

-- ------------------------------------------------------------
-- 2d. Geo filter — SKELETON (companies table lacks lat/lon)
-- TODO: Add lat/lon columns to companies, then enable
-- ------------------------------------------------------------

-- Extensions needed when geo filter is enabled:
-- CREATE EXTENSION IF NOT EXISTS cube;
-- CREATE EXTENSION IF NOT EXISTS earthdistance;

-- TODO: When ready to enable geo filtering, run:
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS latitude DECIMAL(8,6);
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);
-- Then uncomment the DELETE logic below.

CREATE OR REPLACE FUNCTION cleanup_geo_filter(
  p_metro TEXT,
  p_lat FLOAT,
  p_lon FLOAT,
  p_radius_km FLOAT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  -- SKELETON: companies table lacks latitude/longitude columns
  -- When columns exist, replace this with:
  --
  -- DELETE FROM companies c
  -- WHERE c.discovery_metro = p_metro
  --   AND c.latitude IS NOT NULL
  --   AND c.longitude IS NOT NULL
  --   AND (
  --     point(c.longitude, c.latitude) <@> point(p_lon, p_lat)
  --   ) * 1.609344 > p_radius_km;  -- <@> returns statute miles, convert to km
  --
  -- GET DIAGNOSTICS v_deleted = ROW_COUNT;
  -- RETURN jsonb_build_object('deleted_count', v_deleted);

  RETURN jsonb_build_object(
    'deleted_count', 0,
    'status', 'skipped',
    'reason', 'companies table lacks lat/lon columns'
  );
END;
$$;

COMMENT ON FUNCTION cleanup_geo_filter IS 'SKELETON — Remove companies outside radius. Deferred to v2 (needs lat/lon on companies table).';

-- ------------------------------------------------------------
-- 2e. Orchestrator — runs all 4 cleanup functions in order
-- Callable via Supabase RPC:
--   POST /rest/v1/rpc/run_post_discovery_cleanup
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_post_discovery_cleanup(
  p_metro TEXT,
  p_lat FLOAT DEFAULT 0,
  p_lon FLOAT DEFAULT 0,
  p_radius_km FLOAT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_country JSONB;
  v_category JSONB;
  v_chain JSONB;
  v_geo JSONB;
  v_country_count INTEGER;
  v_category_count INTEGER;
  v_chain_count INTEGER;
  v_geo_count INTEGER;
BEGIN
  -- Run each cleanup step in order
  v_country := cleanup_country_filter(p_metro);
  v_category := cleanup_category_blocklist(p_metro);
  v_chain := cleanup_chain_blocklist(p_metro);
  v_geo := cleanup_geo_filter(p_metro, p_lat, p_lon, p_radius_km);

  -- Extract counts
  v_country_count := (v_country->>'deleted_count')::INTEGER;
  v_category_count := (v_category->>'deleted_count')::INTEGER;
  v_chain_count := (v_chain->>'deleted_count')::INTEGER;
  v_geo_count := (v_geo->>'deleted_count')::INTEGER;

  RETURN jsonb_build_object(
    'country', v_country_count,
    'category', v_category_count,
    'chain', v_chain_count,
    'geo', v_geo_count,
    'total_deleted', v_country_count + v_category_count + v_chain_count + v_geo_count,
    'metro', p_metro
  );
END;
$$;

COMMENT ON FUNCTION run_post_discovery_cleanup IS 'Orchestrator: runs all cleanup functions in order. Call via POST /rest/v1/rpc/run_post_discovery_cleanup';
