-- ============================================================
-- Requeue SQL: Reset failed/incomplete metros for reprocessing
-- Run AFTER reviewing 06-diagnose-failed-runs.sql results
--
-- IMPORTANT: Run the diagnostic queries FIRST to understand
-- which metros need reprocessing and why. Some metros with
-- leads_found=0 may legitimately have no businesses.
-- ============================================================

-- ============================================================
-- DRY RUN: Preview which metros would be requeued
-- Run this first to verify before making changes
-- ============================================================
SELECT
  metro_name, state, status, leads_found, retry_count,
  'would_requeue' AS action,
  CASE
    WHEN status = 'complete' AND (leads_found = 0 OR leads_found IS NULL)
      THEN 'false_completion (pre-ADR-040 fire-and-forget)'
    WHEN status = 'failed' AND retry_count < max_retries
      THEN 'failed_with_retries_remaining'
    WHEN status = 'failed' AND retry_count >= max_retries
      THEN 'failed_exhausted_retries'
    WHEN status = 'running' AND started_at < NOW() - INTERVAL '2 hours'
      THEN 'stuck_running'
  END AS reason
FROM pipeline_queue
WHERE
  (status = 'complete' AND (leads_found = 0 OR leads_found IS NULL))
  OR (status = 'failed' AND retry_count < max_retries)
  OR (status = 'running' AND started_at < NOW() - INTERVAL '2 hours')
ORDER BY status, metro_name;


-- ============================================================
-- STEP 1: Requeue "complete" metros with 0 leads
-- These are the fire-and-forget false completions from pre-ADR-040
-- Resets: status, timestamps, leads_found, run_id, retry_count
-- ============================================================
/*
UPDATE pipeline_queue
SET
  status = 'pending',
  started_at = NULL,
  completed_at = NULL,
  leads_found = NULL,
  run_id = NULL,
  error_message = NULL,
  retry_count = 0
WHERE status = 'complete'
  AND (leads_found = 0 OR leads_found IS NULL)
RETURNING metro_name, state;
*/


-- ============================================================
-- STEP 2: Requeue failed metros that haven't exhausted retries
-- ============================================================
/*
UPDATE pipeline_queue
SET
  status = 'pending',
  started_at = NULL,
  completed_at = NULL,
  error_message = NULL
WHERE status = 'failed'
  AND retry_count < max_retries
RETURNING metro_name, state, retry_count;
*/


-- ============================================================
-- STEP 3: Reset stuck running metros (running > 2 hours)
-- ============================================================
/*
UPDATE pipeline_queue
SET
  status = 'pending',
  started_at = NULL
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '2 hours'
RETURNING metro_name, state;
*/


-- ============================================================
-- STEP 4: Optionally reset failed metros WITH exhausted retries
-- Uncomment only if you want to give these another chance
-- (they failed 3+ times, so investigate error_message first)
-- ============================================================
/*
UPDATE pipeline_queue
SET
  status = 'pending',
  started_at = NULL,
  completed_at = NULL,
  error_message = NULL,
  retry_count = 0
WHERE status = 'failed'
  AND retry_count >= max_retries
RETURNING metro_name, state, retry_count;
*/


-- ============================================================
-- VERIFICATION: Run after uncommenting and executing above
-- ============================================================
SELECT status, COUNT(*) AS cnt
FROM pipeline_queue
GROUP BY status
ORDER BY CASE status
  WHEN 'running' THEN 1
  WHEN 'pending' THEN 2
  WHEN 'failed' THEN 3
  WHEN 'complete' THEN 4
END;
