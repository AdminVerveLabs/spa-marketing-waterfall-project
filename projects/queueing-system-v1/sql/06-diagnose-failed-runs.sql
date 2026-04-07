-- ============================================================
-- Diagnostic SQL: Identify Failed/Incomplete Queue Runs
-- Run each query separately in Supabase SQL Editor
-- Purpose: Find metros that need reprocessing after pre-ADR-040
--          fire-and-forget false completions
-- ============================================================

-- ============================================================
-- QUERY 1: Queue Status Overview
-- Shows the overall distribution of queue items by status
-- ============================================================
SELECT
  status,
  COUNT(*) AS cnt,
  SUM(leads_found) AS total_leads,
  ROUND(AVG(leads_found) FILTER (WHERE leads_found > 0), 1) AS avg_leads_nonzero,
  MIN(completed_at) AS earliest_completed,
  MAX(completed_at) AS latest_completed
FROM pipeline_queue
GROUP BY status
ORDER BY CASE status
  WHEN 'running' THEN 1
  WHEN 'pending' THEN 2
  WHEN 'failed' THEN 3
  WHEN 'complete' THEN 4
END;


-- ============================================================
-- QUERY 2: "Complete" metros with zero or no leads
-- These are the ~96 false completions from fire-and-forget era
-- ============================================================
SELECT
  pq.metro_name, pq.state, pq.leads_found, pq.completed_at,
  pq.run_id, pq.retry_count,
  pr.status AS run_status,
  pr.total_discovered,
  pr.contacts_found,
  pr.total_batches,
  pr.completed_batches,
  pr.errors
FROM pipeline_queue pq
LEFT JOIN pipeline_runs pr ON pr.id = pq.run_id
WHERE pq.status = 'complete'
  AND (pq.leads_found = 0 OR pq.leads_found IS NULL)
ORDER BY pq.completed_at;


-- ============================================================
-- QUERY 3: Cross-reference with actual companies table
-- Check if discovery actually produced companies for these metros
-- (some may have legitimately found 0 businesses)
-- ============================================================
SELECT
  pq.metro_name, pq.state,
  pq.leads_found AS queue_leads,
  COUNT(DISTINCT c.id) AS actual_companies,
  COUNT(DISTINCT ct.id) AS actual_contacts,
  COUNT(DISTINCT c.id) FILTER (WHERE c.enrichment_status = 'fully_enriched') AS enriched,
  COUNT(DISTINCT c.id) FILTER (WHERE c.enrichment_status = 'discovered') AS stuck_discovered
FROM pipeline_queue pq
LEFT JOIN companies c ON c.discovery_metro = pq.metro_name
LEFT JOIN contacts ct ON ct.company_id = c.id
WHERE pq.status = 'complete'
  AND (pq.leads_found = 0 OR pq.leads_found IS NULL)
GROUP BY pq.metro_name, pq.state, pq.leads_found
ORDER BY actual_companies DESC;


-- ============================================================
-- QUERY 4: Enrichment quality per metro (detect API failures)
-- Shows which APIs actually ran for each metro's contacts
-- Missing NamSor/Hunter/Telnyx suggests API credits were unavailable
-- ============================================================
SELECT
  c.discovery_metro,
  COUNT(DISTINCT c.id) AS companies,
  COUNT(DISTINCT c.id) FILTER (WHERE c.enrichment_status = 'fully_enriched') AS enriched,
  COUNT(DISTINCT c.id) FILTER (WHERE c.enrichment_status = 'discovered') AS stuck_discovered,
  COUNT(DISTINCT ct.id) AS contacts,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.cultural_affinity IS NOT NULL) AS has_namsor,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.email_status IN ('verified', 'invalid', 'risky', 'accept_all')) AS has_hunter_verify,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.phone_status IS NOT NULL) AS has_telnyx,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.source = 'apollo') AS apollo_contacts,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.source = 'hunter_domain_search') AS hunter_contacts
FROM pipeline_queue pq
JOIN companies c ON c.discovery_metro = pq.metro_name
LEFT JOIN contacts ct ON ct.company_id = c.id
WHERE pq.status = 'complete'
  AND (pq.leads_found = 0 OR pq.leads_found IS NULL)
GROUP BY c.discovery_metro
ORDER BY stuck_discovered DESC;


-- ============================================================
-- QUERY 5: Failed metros and their errors
-- ============================================================
SELECT
  metro_name, state,
  retry_count, max_retries,
  error_message,
  leads_found,
  started_at, completed_at
FROM pipeline_queue
WHERE status = 'failed'
ORDER BY completed_at DESC;


-- ============================================================
-- QUERY 6: Running metros that may be stuck
-- ============================================================
SELECT
  metro_name, state,
  started_at,
  NOW() - started_at AS running_duration,
  run_id
FROM pipeline_queue
WHERE status = 'running'
ORDER BY started_at;


-- ============================================================
-- QUERY 7: Summary of ALL complete metros (for comparison)
-- Shows what "good" completions look like vs the 0-lead ones
-- ============================================================
SELECT
  pq.metro_name, pq.state,
  pq.leads_found,
  pq.completed_at,
  CASE WHEN pq.leads_found > 0 THEN 'good' ELSE 'needs_requeue' END AS verdict
FROM pipeline_queue pq
WHERE pq.status = 'complete'
ORDER BY pq.leads_found ASC, pq.completed_at;
