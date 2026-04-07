-- 10-deploy-cooldown-requeue.sql
-- Run ALL of this in Supabase SQL Editor in one go.
-- Step 1: Add new columns, Step 2: Requeue BUG-057 damaged metros.

-- ============================================================
-- STEP 1: Add cooldown requeue columns (ADR-042)
-- ============================================================

ALTER TABLE pipeline_queue ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE pipeline_queue ADD COLUMN IF NOT EXISTS cooldown_count INT DEFAULT 0;

COMMENT ON COLUMN pipeline_queue.retry_after IS 'When set, metro is skipped until this timestamp passes (24h cooldown after max_retries exhausted)';
COMMENT ON COLUMN pipeline_queue.cooldown_count IS 'Number of cooldown-requeue cycles completed. Permanent fail at 3 (= 12 total attempts across 4 cycles)';

-- ============================================================
-- STEP 2: Requeue 150 failed metros from BUG-057
-- ============================================================

UPDATE pipeline_queue
SET
  status = 'pending',
  retry_count = 0,
  cooldown_count = 0,
  retry_after = NULL,
  error_message = NULL,
  started_at = NULL,
  completed_at = NULL,
  run_id = NULL
WHERE status = 'failed';

-- ============================================================
-- STEP 3: Requeue 4 stuck running metros
-- ============================================================

UPDATE pipeline_queue
SET
  status = 'pending',
  retry_count = 0,
  cooldown_count = 0,
  retry_after = NULL,
  error_message = NULL,
  started_at = NULL,
  completed_at = NULL,
  run_id = NULL
WHERE status = 'running';

-- ============================================================
-- VERIFY: Should show ~3200 pending, ~797 complete, 0 failed, 0 running
-- ============================================================

SELECT status, COUNT(*) FROM pipeline_queue GROUP BY status ORDER BY count DESC;
