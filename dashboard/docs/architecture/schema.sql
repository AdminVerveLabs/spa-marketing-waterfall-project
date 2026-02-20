-- ============================================================
-- VerveLabs Run Manager — Additional Supabase Tables
-- Run this in Supabase SQL Editor AFTER the main schema exists
-- These tables support the dashboard UI only
-- ============================================================

-- ============================================================
-- 1. PIPELINE RUNS TABLE
-- Core tracking table for every pipeline run triggered from the dashboard
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Metro config (what was run)
  country TEXT NOT NULL CHECK (country IN ('US', 'CA')),
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  metro_name TEXT NOT NULL,           -- Display label, e.g. "Austin, TX"
  latitude DECIMAL(8,4) NOT NULL,
  longitude DECIMAL(9,4) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 10000,
  search_queries TEXT[] NOT NULL,     -- Array of search terms used
  yelp_location TEXT,                 -- Yelp location label
  
  -- Run status
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Results (populated when n8n calls back on completion)
  total_discovered INTEGER,
  new_records INTEGER,
  contacts_found INTEGER,
  duplicates_merged INTEGER,
  errors TEXT[],                       -- Array of error messages if any
  
  -- Metadata
  triggered_by TEXT,                   -- Email of user who triggered the run
  n8n_execution_id TEXT,               -- For linking back to n8n execution logs
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs (status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_metro ON pipeline_runs (country, state, city);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created ON pipeline_runs (created_at DESC);


-- ============================================================
-- 2. SEARCH QUERY TEMPLATES
-- Reusable sets of search queries for the New Run form
-- ============================================================
CREATE TABLE IF NOT EXISTS search_query_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                  -- e.g. "Default Massage", "Spa Focus"
  queries TEXT[] NOT NULL,             -- Array of search terms
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with starter templates
INSERT INTO search_query_templates (name, queries, is_default) VALUES
  ('Default Massage/Spa', ARRAY['massage therapy', 'massage clinic', 'RMT', 'spa massage', 'massage therapist'], true),
  ('Spa Focus', ARRAY['day spa', 'med spa', 'wellness spa', 'beauty spa'], false),
  ('Wellness Broad', ARRAY['wellness center', 'holistic healing', 'bodywork', 'therapeutic massage'], false);


-- ============================================================
-- 3. COVERAGE STATS VIEW
-- Pre-aggregated view for the Coverage Report page
-- ============================================================
CREATE OR REPLACE VIEW run_coverage_stats AS
SELECT 
  country,
  state,
  city,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_runs,
  COUNT(*) AS total_runs,
  COALESCE(SUM(total_discovered) FILTER (WHERE status = 'completed'), 0) AS total_discovered,
  COALESCE(SUM(new_records) FILTER (WHERE status = 'completed'), 0) AS total_new_records,
  COALESCE(SUM(contacts_found) FILTER (WHERE status = 'completed'), 0) AS total_contacts,
  MAX(completed_at) AS last_completed_at
FROM pipeline_runs
GROUP BY country, state, city;


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_query_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can do everything (2-user internal tool)
CREATE POLICY "Authenticated users can read pipeline_runs" 
  ON pipeline_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pipeline_runs" 
  ON pipeline_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pipeline_runs" 
  ON pipeline_runs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage search_query_templates" 
  ON search_query_templates FOR ALL TO authenticated USING (true);

-- n8n uses service_role key which bypasses RLS automatically
-- n8n needs UPDATE access to pipeline_runs (for status callbacks)
