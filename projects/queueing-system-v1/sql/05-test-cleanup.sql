-- ============================================================
-- 05-test-cleanup.sql
-- Queuing System v1 — Dry-Run Validation Queries
-- SELECT-only — shows what WOULD be deleted without deleting
-- Run in Supabase SQL Editor to review before enabling cleanup
-- ============================================================


-- ============================================================
-- 1. COUNTRY FILTER PREVIEW
-- Companies with non-US country, grouped by metro
-- ============================================================
SELECT
  discovery_metro,
  country,
  COUNT(*) AS would_delete
FROM companies
WHERE country IS NOT NULL
  AND country NOT IN ('US')
GROUP BY discovery_metro, country
ORDER BY discovery_metro, would_delete DESC;


-- ============================================================
-- 2. CATEGORY BLOCKLIST PREVIEW
-- Companies matching blocked categories (with safe-term check)
-- ============================================================

-- 2a. Would be DELETED (matches blocklist, NO safe term)
SELECT
  c.discovery_metro,
  bl.category_pattern AS matched_pattern,
  c.name,
  c.category,
  c.domain
FROM companies c
JOIN category_blocklist bl ON bl.active = TRUE
  AND c.category ILIKE '%' || bl.category_pattern || '%'
WHERE c.category NOT ILIKE '%Massage%'
  AND c.category NOT ILIKE '%Bodywork%'
  AND c.category NOT ILIKE '%Day Spa%'
  AND c.category NOT ILIKE '%Wellness%'
  AND c.category NOT ILIKE '%Therapeutic%'
ORDER BY c.discovery_metro, bl.category_pattern, c.name;

-- 2b. Would be KEPT (matches blocklist BUT has safe term — exempted)
SELECT
  c.discovery_metro,
  bl.category_pattern AS matched_pattern,
  c.name,
  c.category,
  'EXEMPTED — safe term found' AS status
FROM companies c
JOIN category_blocklist bl ON bl.active = TRUE
  AND c.category ILIKE '%' || bl.category_pattern || '%'
WHERE c.category ILIKE '%Massage%'
   OR c.category ILIKE '%Bodywork%'
   OR c.category ILIKE '%Day Spa%'
   OR c.category ILIKE '%Wellness%'
   OR c.category ILIKE '%Therapeutic%'
ORDER BY c.discovery_metro, bl.category_pattern, c.name;


-- ============================================================
-- 3. CHAIN BLOCKLIST PREVIEW
-- Companies matching chain names or domains
-- ============================================================
SELECT
  c.discovery_metro,
  bl.chain_name,
  bl.domain_pattern,
  c.name,
  c.domain,
  bl.reason
FROM companies c
JOIN chain_blocklist bl ON bl.active = TRUE
  AND (
    c.name ILIKE '%' || bl.chain_name || '%'
    OR (bl.domain_pattern IS NOT NULL AND c.domain ILIKE '%' || bl.domain_pattern || '%')
  )
ORDER BY c.discovery_metro, bl.chain_name, c.name;


-- ============================================================
-- 4. COMBINED SUMMARY — Before/After counts per metro
-- ============================================================
WITH
country_hits AS (
  SELECT discovery_metro, COUNT(*) AS cnt
  FROM companies
  WHERE country IS NOT NULL AND country NOT IN ('US')
  GROUP BY discovery_metro
),
category_hits AS (
  SELECT c.discovery_metro, COUNT(*) AS cnt
  FROM companies c
  JOIN category_blocklist bl ON bl.active = TRUE
    AND c.category ILIKE '%' || bl.category_pattern || '%'
  WHERE c.category NOT ILIKE '%Massage%'
    AND c.category NOT ILIKE '%Bodywork%'
    AND c.category NOT ILIKE '%Day Spa%'
    AND c.category NOT ILIKE '%Wellness%'
    AND c.category NOT ILIKE '%Therapeutic%'
  GROUP BY c.discovery_metro
),
chain_hits AS (
  SELECT c.discovery_metro, COUNT(*) AS cnt
  FROM companies c
  JOIN chain_blocklist bl ON bl.active = TRUE
    AND (
      c.name ILIKE '%' || bl.chain_name || '%'
      OR (bl.domain_pattern IS NOT NULL AND c.domain ILIKE '%' || bl.domain_pattern || '%')
    )
  GROUP BY c.discovery_metro
),
totals AS (
  SELECT discovery_metro, COUNT(*) AS total
  FROM companies
  GROUP BY discovery_metro
)
SELECT
  t.discovery_metro,
  t.total AS companies_before,
  COALESCE(co.cnt, 0) AS country_deletes,
  COALESCE(ca.cnt, 0) AS category_deletes,
  COALESCE(ch.cnt, 0) AS chain_deletes,
  COALESCE(co.cnt, 0) + COALESCE(ca.cnt, 0) + COALESCE(ch.cnt, 0) AS total_deletes,
  t.total - (COALESCE(co.cnt, 0) + COALESCE(ca.cnt, 0) + COALESCE(ch.cnt, 0)) AS companies_after
FROM totals t
LEFT JOIN country_hits co ON co.discovery_metro = t.discovery_metro
LEFT JOIN category_hits ca ON ca.discovery_metro = t.discovery_metro
LEFT JOIN chain_hits ch ON ch.discovery_metro = t.discovery_metro
ORDER BY total_deletes DESC;
