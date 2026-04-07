-- 08-requeue-bug057-metros.sql
-- Requeue 150 metros that failed due to Apify monthly quota (BUG-057)
-- Plus 4 metros stuck in 'running' from before error handler was wired
-- Run AFTER Apify quota resets (April 14, 2026)

-- ============================================================
-- DRY RUN: Preview what will be reset
-- ============================================================

-- Preview failed metros to requeue
SELECT 'failed' as fix, metro_name, state, retry_count, started_at
FROM pipeline_queue
WHERE status = 'failed'
ORDER BY started_at DESC;

-- Preview stuck running metros
SELECT 'stuck_running' as fix, metro_name, state, started_at
FROM pipeline_queue
WHERE status = 'running';

-- ============================================================
-- EXECUTE: Reset failed metros to pending (uncomment to run)
-- ============================================================

-- UPDATE pipeline_queue
-- SET status = 'pending',
--     retry_count = 0,
--     error_message = NULL,
--     started_at = NULL,
--     completed_at = NULL,
--     run_id = NULL
-- WHERE status = 'failed';

-- UPDATE pipeline_queue
-- SET status = 'pending',
--     retry_count = 0,
--     error_message = NULL,
--     started_at = NULL,
--     completed_at = NULL,
--     run_id = NULL
-- WHERE status = 'running';

-- ============================================================
-- VERIFY: Check status after reset
-- ============================================================

-- SELECT status, COUNT(*) FROM pipeline_queue GROUP BY status ORDER BY count DESC;
