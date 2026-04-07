-- 09-add-retry-after.sql
-- Add cooldown requeue support to pipeline_queue (ADR-042)
-- Run in Supabase SQL Editor

ALTER TABLE pipeline_queue ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE pipeline_queue ADD COLUMN IF NOT EXISTS cooldown_count INT DEFAULT 0;

COMMENT ON COLUMN pipeline_queue.retry_after IS 'When set, metro is skipped until this timestamp passes (24h cooldown after max_retries exhausted)';
COMMENT ON COLUMN pipeline_queue.cooldown_count IS 'Number of cooldown-requeue cycles completed. Permanent fail at 3 (= 12 total attempts across 4 cycles)';
