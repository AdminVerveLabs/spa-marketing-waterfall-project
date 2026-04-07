-- ============================================================
-- 02-followup-queries.sql — Phase 1 Follow-up Queries
-- Run ONE query at a time in Supabase SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- Q1: All 86 high-value leads (score >= 30) matching ANY filter
-- Manual review list — export this
-- ────────────────────────────────────────────────────────────
SELECT name, category, city, state, domain, lead_score, has_online_booking,
  CASE
    WHEN name ILIKE '%physical therap%' OR name ILIKE '%physiotherap%' OR name ILIKE '%rehab%' THEN 'physical_therapy'
    WHEN name ILIKE '%chiropract%' OR name ILIKE '%chiro %' OR name ILIKE '%chiro-%' THEN 'chiropractic'
    WHEN name ILIKE '%med spa%' OR name ILIKE '%medspa%' OR name ILIKE '%medical spa%'
      OR name ILIKE '%aestheti%' OR name ILIKE '%dermatolog%' OR name ILIKE '%botox%' THEN 'med_spa'
    WHEN name ILIKE '%acupunctur%' THEN 'acupuncture'
    WHEN name ILIKE '%reiki%' OR name ILIKE '%energy heal%' OR name ILIKE '%crystal heal%'
      OR name ILIKE '%sound heal%' OR name ILIKE '%sound bath%' THEN 'energy_healing'
    WHEN name ILIKE '%float%therap%' OR name ILIKE '%float spa%' OR name ILIKE '%salt cave%'
      OR name ILIKE '%cryother%' OR name ILIKE '%infrared sauna%' THEN 'float_salt'
    WHEN name ILIKE '%massage envy%' OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
      OR name ILIKE '%elements massage%' OR name ILIKE '%massage heights%'
      OR name ILIKE '%massage luxe%' OR name ILIKE '%lavida massage%'
      OR name ILIKE '%spavia%' OR name ILIKE '%massage green%' THEN 'franchise'
    WHEN name ILIKE '%mobile massage%' OR name ILIKE '%house call%' OR name ILIKE '%outcall%'
      OR name ILIKE '%in-home massage%' OR name ILIKE '%traveling massage%' THEN 'mobile'
    WHEN name ILIKE '%thai massage%' OR name ILIKE '%thai spa%' OR name ILIKE '%asian massage%'
      OR name ILIKE '%asian spa%' OR name ILIKE '%chinese massage%' OR name ILIKE '%korean massage%'
      OR name ILIKE '%foot massage%' OR name ILIKE '%reflexology%' THEN 'language_barrier'
    ELSE 'unknown'
  END AS filter_type
FROM companies
WHERE lead_score >= 30
  AND (
    name ILIKE '%physical therap%' OR name ILIKE '%physiotherap%' OR name ILIKE '%rehab%'
    OR name ILIKE '%chiropract%' OR name ILIKE '%chiro %' OR name ILIKE '%chiro-%'
    OR name ILIKE '%med spa%' OR name ILIKE '%medspa%' OR name ILIKE '%medical spa%'
    OR name ILIKE '%aestheti%' OR name ILIKE '%dermatolog%' OR name ILIKE '%botox%'
    OR name ILIKE '%acupunctur%'
    OR name ILIKE '%reiki%' OR name ILIKE '%energy heal%' OR name ILIKE '%crystal heal%'
    OR name ILIKE '%sound heal%' OR name ILIKE '%sound bath%'
    OR name ILIKE '%float%therap%' OR name ILIKE '%float spa%' OR name ILIKE '%salt cave%'
    OR name ILIKE '%cryother%' OR name ILIKE '%infrared sauna%'
    OR name ILIKE '%massage envy%' OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
    OR name ILIKE '%elements massage%' OR name ILIKE '%massage heights%'
    OR name ILIKE '%massage luxe%' OR name ILIKE '%lavida massage%'
    OR name ILIKE '%spavia%' OR name ILIKE '%massage green%'
    OR name ILIKE '%mobile massage%' OR name ILIKE '%house call%' OR name ILIKE '%outcall%'
    OR name ILIKE '%in-home massage%' OR name ILIKE '%traveling massage%'
    OR name ILIKE '%thai massage%' OR name ILIKE '%thai spa%' OR name ILIKE '%asian massage%'
    OR name ILIKE '%asian spa%' OR name ILIKE '%chinese massage%' OR name ILIKE '%korean massage%'
    OR name ILIKE '%foot massage%' OR name ILIKE '%reflexology%'
  )
ORDER BY filter_type, lead_score DESC;


-- ────────────────────────────────────────────────────────────
-- Q2: The 20 high-value franchise matches — false positive check
-- e.g., "Elements of Healing Massage" matching "Elements Massage"
-- ────────────────────────────────────────────────────────────
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE lead_score >= 30
  AND (
    name ILIKE '%massage envy%' OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
    OR name ILIKE '%elements massage%' OR name ILIKE '%massage heights%'
    OR name ILIKE '%massage luxe%' OR name ILIKE '%lavida massage%'
    OR name ILIKE '%spavia%' OR name ILIKE '%massage green%'
  )
ORDER BY lead_score DESC;


-- ────────────────────────────────────────────────────────────
-- Q3: "Review" categories — Sauna, Skin Care, Med Spa, Resort
-- Sample records for decision-making
-- ────────────────────────────────────────────────────────────
SELECT category, name, city, state, domain, lead_score, has_online_booking
FROM companies
WHERE category ILIKE '%sauna%'
   OR category = 'Skin Care Clinic'
   OR category ILIKE '%medical spa%'
   OR category ILIKE '%resort hotel%'
ORDER BY category, lead_score DESC
LIMIT 40;


-- ────────────────────────────────────────────────────────────
-- Q4: Cultural affinity distribution at language-barrier companies
-- Which specific affinities correlate with Orum call failures?
-- (This was query 5f in the original file)
-- ────────────────────────────────────────────────────────────
SELECT ct.cultural_affinity, COUNT(*) AS cnt
FROM contacts ct
JOIN companies co ON ct.company_id = co.id
WHERE ct.cultural_affinity IS NOT NULL
  AND (co.name ILIKE '%thai massage%'
    OR co.name ILIKE '%thai spa%'
    OR co.name ILIKE '%asian massage%'
    OR co.name ILIKE '%asian spa%'
    OR co.name ILIKE '%chinese massage%'
    OR co.name ILIKE '%korean massage%'
    OR co.name ILIKE '%foot massage%'
    OR co.name ILIKE '%reflexology%')
GROUP BY ct.cultural_affinity
ORDER BY cnt DESC;


-- ────────────────────────────────────────────────────────────
-- Q5: Overlap analysis — how many companies match 2+ filters?
-- ────────────────────────────────────────────────────────────
SELECT filter_count, COUNT(*) AS companies
FROM (
  SELECT id,
    (CASE WHEN name ILIKE '%physical therap%' OR name ILIKE '%physiotherap%' OR name ILIKE '%rehab%' THEN 1 ELSE 0 END)
    + (CASE WHEN name ILIKE '%chiropract%' OR name ILIKE '%chiro %' OR name ILIKE '%chiro-%' THEN 1 ELSE 0 END)
    + (CASE WHEN name ILIKE '%med spa%' OR name ILIKE '%medspa%' OR name ILIKE '%medical spa%'
        OR name ILIKE '%aestheti%' OR name ILIKE '%dermatolog%' OR name ILIKE '%botox%' THEN 1 ELSE 0 END)
    + (CASE WHEN name ILIKE '%acupunctur%' THEN 1 ELSE 0 END)
    + (CASE WHEN name ILIKE '%reiki%' OR name ILIKE '%energy heal%' OR name ILIKE '%crystal heal%'
        OR name ILIKE '%sound heal%' OR name ILIKE '%sound bath%' THEN 1 ELSE 0 END)
    + (CASE WHEN name ILIKE '%float%therap%' OR name ILIKE '%float spa%' OR name ILIKE '%salt cave%'
        OR name ILIKE '%cryother%' OR name ILIKE '%infrared sauna%' THEN 1 ELSE 0 END)
    + (CASE WHEN name ILIKE '%massage envy%' OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
        OR name ILIKE '%elements massage%' OR name ILIKE '%massage heights%'
        OR name ILIKE '%massage luxe%' OR name ILIKE '%lavida massage%'
        OR name ILIKE '%spavia%' OR name ILIKE '%massage green%' THEN 1 ELSE 0 END)
    + (CASE WHEN name ILIKE '%mobile massage%' OR name ILIKE '%house call%' OR name ILIKE '%outcall%'
        OR name ILIKE '%in-home massage%' OR name ILIKE '%traveling massage%' THEN 1 ELSE 0 END)
    AS filter_count
  FROM companies
) sub
WHERE filter_count >= 1
GROUP BY filter_count
ORDER BY filter_count;


-- ────────────────────────────────────────────────────────────
-- Q6: What does "fully_enriched" actually mean?
-- Check data completeness for enriched records
-- ────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS fully_enriched_total,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS has_company_email,
  COUNT(*) FILTER (WHERE domain IS NOT NULL) AS has_domain,
  COUNT(*) FILTER (WHERE phone IS NOT NULL) AS has_phone,
  COUNT(*) FILTER (WHERE has_online_booking = true) AS has_booking,
  COUNT(*) FILTER (WHERE has_website = true) AS has_website,
  COUNT(*) FILTER (WHERE google_place_id IS NOT NULL) AS has_google_id,
  ROUND(100.0 * COUNT(*) FILTER (WHERE email IS NOT NULL) / COUNT(*), 1) AS pct_email,
  ROUND(100.0 * COUNT(*) FILTER (WHERE domain IS NOT NULL) / COUNT(*), 1) AS pct_domain,
  ROUND(100.0 * COUNT(*) FILTER (WHERE phone IS NOT NULL) / COUNT(*), 1) AS pct_phone
FROM companies
WHERE enrichment_status = 'fully_enriched';
