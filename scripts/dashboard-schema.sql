-- ============================================================
-- Dashboard Integration Schema
-- Run this ONCE in Supabase SQL Editor
-- Creates: pipeline_runs, search_query_templates, view, RLS,
--          batch tracking columns, and atomic increment function
-- ============================================================

-- ============================================================
-- 1. PIPELINE RUNS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Metro config (what was run)
  country TEXT NOT NULL CHECK (country IN ('US', 'CA')),
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  metro_name TEXT NOT NULL,
  latitude DECIMAL(8,4) NOT NULL,
  longitude DECIMAL(9,4) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 10000,
  search_queries TEXT[] NOT NULL,
  yelp_location TEXT,

  -- Run status
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),

  -- Results (populated by n8n callbacks)
  total_discovered INTEGER,
  new_records INTEGER,
  contacts_found INTEGER,
  duplicates_merged INTEGER,
  errors TEXT[],

  -- Batch tracking (populated by n8n Batch Dispatcher + Track Batch Completion)
  total_batches INTEGER,
  completed_batches INTEGER DEFAULT 0,

  -- Metadata
  triggered_by TEXT,
  n8n_execution_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs (status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_metro ON pipeline_runs (country, state, city);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created ON pipeline_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_execution ON pipeline_runs (n8n_execution_id);

-- ============================================================
-- 2. SEARCH QUERY TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS search_query_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  queries TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO search_query_templates (name, queries, is_default) VALUES
  ('Default Massage/Spa', ARRAY['massage therapy', 'massage clinic', 'massage therapist', 'spa massage', 'therapeutic massage', 'deep tissue massage', 'sports massage', 'bodywork', 'day spa', 'wellness spa', 'relaxation massage', 'licensed massage therapist'], true),
  ('Spa Focus', ARRAY['day spa', 'med spa', 'wellness spa', 'beauty spa'], false),
  ('Wellness Broad', ARRAY['wellness center', 'holistic healing', 'bodywork', 'therapeutic massage'], false);

-- ============================================================
-- 3. COVERAGE STATS VIEW
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
-- 4. ATOMIC BATCH INCREMENT FUNCTION
-- Called by sub-workflow Track Batch Completion node via RPC
-- ============================================================
CREATE OR REPLACE FUNCTION increment_completed_batches(p_run_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_completed INTEGER;
BEGIN
  UPDATE pipeline_runs
  SET completed_batches = completed_batches + 1
  WHERE id = p_run_id
  RETURNING total_batches, completed_batches INTO v_total, v_completed;

  IF v_total IS NULL THEN
    RETURN json_build_object('error', 'run_id not found');
  END IF;

  RETURN json_build_object(
    'total_batches', v_total,
    'completed_batches', v_completed,
    'is_last_batch', v_completed >= v_total
  );
END;
$$;

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_query_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users (dashboard) can read/write
CREATE POLICY "Authenticated users can read pipeline_runs"
  ON pipeline_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pipeline_runs"
  ON pipeline_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pipeline_runs"
  ON pipeline_runs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage search_query_templates"
  ON search_query_templates FOR ALL TO authenticated USING (true);

-- Allow anon key reads (for dashboard without auth if needed)
CREATE POLICY "Anon can read pipeline_runs"
  ON pipeline_runs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert pipeline_runs"
  ON pipeline_runs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update pipeline_runs"
  ON pipeline_runs FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon can read search_query_templates"
  ON search_query_templates FOR SELECT TO anon USING (true);

-- n8n uses service_role key which bypasses RLS automatically

-- ============================================================
-- 6. SAFETY NET: Mark stale runs as failed
-- Run this periodically or set up pg_cron
-- ============================================================
-- To set up as a cron job (requires pg_cron extension):
-- SELECT cron.schedule('mark-stale-runs', '*/15 * * * *',
--   $$UPDATE pipeline_runs SET status = 'failed', completed_at = NOW(),
--     errors = array_append(COALESCE(errors, '{}'), 'Timed out after 90 minutes')
--     WHERE status = 'running' AND started_at < NOW() - INTERVAL '90 minutes'$$
-- );
