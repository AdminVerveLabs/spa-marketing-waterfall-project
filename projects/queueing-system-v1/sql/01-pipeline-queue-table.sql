-- ============================================================
-- 01-pipeline-queue-table.sql
-- Queuing System v1 — Pipeline Queue Table
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metro_name TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  latitude DECIMAL(8,4) NOT NULL,
  longitude DECIMAL(9,4) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 15000,
  population INTEGER,
  market_type TEXT CHECK (market_type IN ('rural', 'suburban', 'metro')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  leads_found INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  run_id UUID REFERENCES pipeline_runs(id),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Prevent duplicate queue entries for the same metro+state
  -- (metro_name, state) handles legitimate duplicates like Springfield IL vs Springfield MO
  CONSTRAINT uq_pipeline_queue_metro UNIQUE (metro_name, state)
);

-- Index for efficient "fetch next pending" query
-- ORDER BY priority DESC, queued_at ASC
CREATE INDEX IF NOT EXISTS idx_pipeline_queue_fetch_next
  ON pipeline_queue (status, priority DESC, queued_at ASC);

-- Index for monitoring stuck/running jobs
CREATE INDEX IF NOT EXISTS idx_pipeline_queue_status
  ON pipeline_queue (status)
  WHERE status IN ('running', 'failed');

COMMENT ON TABLE pipeline_queue IS 'Sequential metro processing queue for the waterfall pipeline';
COMMENT ON COLUMN pipeline_queue.priority IS 'Higher values run sooner. 0 = default.';
COMMENT ON COLUMN pipeline_queue.radius_meters IS 'Google Places search radius. Default 15km. Smaller for rural towns.';
COMMENT ON COLUMN pipeline_queue.run_id IS 'FK to pipeline_runs — set when this metro starts processing';
