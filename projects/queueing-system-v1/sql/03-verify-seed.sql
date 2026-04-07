-- ============================================================
-- 03-verify-seed.sql
-- Verify pipeline_queue seed data loaded correctly
-- Run after all 02-seed-pipeline-queue-batch*.sql files
-- ============================================================

-- 1. Total count (expect ~3,987)
SELECT 'Total metros' AS check, COUNT(*) AS result FROM pipeline_queue;

-- 2. Status distribution (all should be 'pending')
SELECT 'Status distribution' AS check, status, COUNT(*) AS count
FROM pipeline_queue
GROUP BY status
ORDER BY count DESC;

-- 3. Market type breakdown
SELECT 'Market type' AS check, market_type, COUNT(*) AS count
FROM pipeline_queue
GROUP BY market_type
ORDER BY count DESC;

-- 4. State coverage (expect 49 — DC and HI have no cities in 5k-50k range)
SELECT 'State coverage' AS check, COUNT(DISTINCT state) AS states_represented
FROM pipeline_queue;

-- 5. States with most metros
SELECT 'Top 10 states' AS check, state, COUNT(*) AS count
FROM pipeline_queue
GROUP BY state
ORDER BY count DESC
LIMIT 10;

-- 6. Radius distribution
SELECT 'Radius distribution' AS check,
  MIN(radius_meters) AS min_radius_m,
  MAX(radius_meters) AS max_radius_m,
  ROUND(AVG(radius_meters)) AS avg_radius_m
FROM pipeline_queue;

-- 7. Population range
SELECT 'Population range' AS check,
  MIN(population) AS min_pop,
  MAX(population) AS max_pop,
  ROUND(AVG(population)) AS avg_pop
FROM pipeline_queue;

-- 8. Spot-check test metros (from rural eval)
SELECT 'Spot check' AS check, metro_name, state, population, radius_meters, market_type
FROM pipeline_queue
WHERE metro_name IN ('Price city', 'Sterling city', 'Vernal city', 'Durango city', 'Elko city', 'Clovis city')
ORDER BY metro_name;

-- 9. Check for duplicates (should return 0)
SELECT 'Duplicates' AS check, metro_name, state, COUNT(*) AS count
FROM pipeline_queue
GROUP BY metro_name, state
HAVING COUNT(*) > 1;

-- 10. Metros with same name in different states (legitimate duplicates)
SELECT 'Same-name metros' AS check, metro_name, COUNT(DISTINCT state) AS state_count,
  STRING_AGG(state, ', ' ORDER BY state) AS states
FROM pipeline_queue
GROUP BY metro_name
HAVING COUNT(DISTINCT state) > 1
ORDER BY state_count DESC
LIMIT 20;
