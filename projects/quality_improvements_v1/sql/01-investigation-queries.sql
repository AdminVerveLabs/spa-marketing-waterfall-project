-- ============================================================
-- 01-investigation-queries.sql
-- Lead Quality Improvements v1 — Phase 1 Investigation
-- ALL QUERIES ARE READ-ONLY (SELECT only, no modifications)
-- Run entire file in Supabase SQL Editor
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- SECTION 0: CURRENT STATE — Existing Blocklists & Filters
-- ════════════════════════════════════════════════════════════

-- 0a. Current category blocklist patterns
SELECT category_pattern, reason, active
FROM category_blocklist
ORDER BY category_pattern;

-- 0b. Current chain blocklist entries
SELECT chain_name, domain_pattern, reason, active
FROM chain_blocklist
ORDER BY chain_name;

-- 0c. Report generator junk categories (hardcoded in get_lead_report + generate-report.js)
-- These 9 categories are filtered from reports but NOT from the pipeline:
SELECT unnest(ARRAY[
  'Transportation Service',
  'Car repair and maintenance service',
  'Corporate Office',
  'Car Rental Agency',
  'Educational Institution',
  'Association / Organization',
  'Storage Facility',
  'Shipping Service',
  'Car Dealer'
]) AS report_junk_category;

-- 0d. Companies currently matching category blocklist (existing filter coverage)
SELECT cb.category_pattern, COUNT(c.id) AS matching_companies
FROM category_blocklist cb
LEFT JOIN companies c ON c.category ILIKE '%' || cb.category_pattern || '%'
WHERE cb.active = true
GROUP BY cb.category_pattern
ORDER BY matching_companies DESC;

-- 0e. Companies matching report junk categories (NOT in pipeline blocklist)
SELECT c.category, COUNT(*) AS cnt
FROM companies c
WHERE c.category IN (
  'Transportation Service', 'Car repair and maintenance service',
  'Corporate Office', 'Car Rental Agency', 'Educational Institution',
  'Association / Organization', 'Storage Facility', 'Shipping Service', 'Car Dealer'
)
GROUP BY c.category
ORDER BY cnt DESC;


-- ════════════════════════════════════════════════════════════
-- SECTION 1: CATEGORY AUDIT
-- ════════════════════════════════════════════════════════════

-- 1a. Top 50 categories by frequency
SELECT category, COUNT(*) AS cnt
FROM companies
WHERE category IS NOT NULL
GROUP BY category
ORDER BY cnt DESC
LIMIT 50;

-- 1b. Categories containing suspicious (non-massage) terms
SELECT category, COUNT(*) AS cnt
FROM companies
WHERE category IS NOT NULL
  AND (
    category ILIKE '%physical therap%'
    OR category ILIKE '%chiropract%'
    OR category ILIKE '%acupunctur%'
    OR category ILIKE '%dermatolog%'
    OR category ILIKE '%aestheti%'
    OR category ILIKE '%nail salon%'
    OR category ILIKE '%hair salon%'
    OR category ILIKE '%tattoo%'
    OR category ILIKE '%float%'
    OR category ILIKE '%cryother%'
    OR category ILIKE '%reiki%'
    OR category ILIKE '%pilates%'
    OR category ILIKE '%yoga%'
    OR category ILIKE '%fitness%'
    OR category ILIKE '%gym%'
    OR category ILIKE '%martial art%'
  )
GROUP BY category
ORDER BY cnt DESC;

-- 1c. Categories containing safe massage-related terms
SELECT category, COUNT(*) AS cnt
FROM companies
WHERE category IS NOT NULL
  AND (
    category ILIKE '%massage%'
    OR category ILIKE '%spa%'
    OR category ILIKE '%bodywork%'
    OR category ILIKE '%wellness%'
    OR category ILIKE '%therapeutic%'
  )
GROUP BY category
ORDER BY cnt DESC;

-- 1d. Categories NOT matching any known pattern (potential gaps)
SELECT category, COUNT(*) AS cnt
FROM companies
WHERE category IS NOT NULL
  AND category NOT ILIKE '%massage%'
  AND category NOT ILIKE '%spa%'
  AND category NOT ILIKE '%bodywork%'
  AND category NOT ILIKE '%wellness%'
  AND category NOT ILIKE '%therapeutic%'
  AND category NOT ILIKE '%physical therap%'
  AND category NOT ILIKE '%chiropract%'
  AND category NOT ILIKE '%acupunctur%'
  AND category NOT ILIKE '%salon%'
  AND category NOT ILIKE '%yoga%'
  AND category NOT ILIKE '%fitness%'
GROUP BY category
ORDER BY cnt DESC
LIMIT 30;


-- ════════════════════════════════════════════════════════════
-- SECTION 2: WRONG BUSINESS TYPE DETECTION (Name Patterns)
-- ════════════════════════════════════════════════════════════

-- 2a. Physical therapy / rehabilitation
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%physical therap%'
   OR name ILIKE '%physiotherap%'
   OR name ILIKE '%rehab%'
   OR name ILIKE '% PT %'
   OR name ILIKE '% PT'
ORDER BY lead_score DESC;

-- 2b. Chiropractic (careful patterns — avoid matching Washington DC addresses)
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%chiropract%'
   OR name ILIKE '%chiro %'
   OR name ILIKE '%chiro-%'
ORDER BY lead_score DESC;

-- 2c. DC credential detection — separate query for precision testing
-- Matches: "Dr. Smith, DC", "Name DC", "Name, D.C."
-- Avoids: "Washington, DC" addresses
SELECT name, category, city, state, domain, lead_score,
  CASE
    WHEN name ~ ',\s*D\.?C\.?\s*$' THEN 'ends_with_DC'
    WHEN name ~ '\b[A-Z][a-z]+,?\s+DC\b' AND name NOT ILIKE '%washington%' THEN 'name_DC_pattern'
    ELSE 'other_match'
  END AS dc_match_type
FROM companies
WHERE (name ~ ',\s*D\.?C\.?\s*$'
   OR (name ~ '\b[A-Z][a-z]+,?\s+DC\b' AND name NOT ILIKE '%washington%'))
ORDER BY lead_score DESC;

-- 2d. Medical aesthetics / med spa
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%med spa%'
   OR name ILIKE '%medspa%'
   OR name ILIKE '%medical spa%'
   OR name ILIKE '%aestheti%'
   OR name ILIKE '%dermatolog%'
   OR name ILIKE '%skincare%'
   OR name ILIKE '%botox%'
   OR name ILIKE '%laser%clinic%'
   OR name ILIKE '%cosmetic%'
ORDER BY lead_score DESC;

-- 2e. Acupuncture
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%acupunctur%'
   OR name ILIKE '%traditional chinese medicine%'
ORDER BY lead_score DESC;

-- 2f. Float / salt / biohacking
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%float%therap%'
   OR name ILIKE '%float spa%'
   OR name ILIKE '%salt cave%'
   OR name ILIKE '%salt room%'
   OR name ILIKE '%cryother%'
   OR name ILIKE '%biohack%'
   OR name ILIKE '%infrared sauna%'
ORDER BY lead_score DESC;

-- 2g. Energy healing / spiritual
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%reiki%'
   OR name ILIKE '%energy heal%'
   OR name ILIKE '%crystal heal%'
   OR name ILIKE '%spiritual%heal%'
   OR name ILIKE '%chakra%'
   OR name ILIKE '%sound heal%'
   OR name ILIKE '%sound bath%'
ORDER BY lead_score DESC;

-- 2h. Other non-massage
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%nail salon%'
   OR name ILIKE '%hair salon%'
   OR name ILIKE '%barber%'
   OR name ILIKE '%tattoo%'
   OR name ILIKE '%hospice%'
   OR name ILIKE '%doula%'
   OR name ILIKE '%midwi%'
   OR name ILIKE '%cuddl%'
ORDER BY lead_score DESC;


-- ════════════════════════════════════════════════════════════
-- SECTION 3: FRANCHISE / CHAIN DETECTION
-- ════════════════════════════════════════════════════════════

-- 3a. Known franchise brands (from scope doc)
SELECT
  CASE
    WHEN name ILIKE '%massage envy%' THEN 'Massage Envy'
    WHEN name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%' THEN 'Hand & Stone'
    WHEN name ILIKE '%elements massage%' THEN 'Elements Massage'
    WHEN name ILIKE '%massage heights%' THEN 'Massage Heights'
    WHEN name ILIKE '%massage luxe%' OR name ILIKE '%massageluxe%' THEN 'Massage Luxe'
    WHEN name ILIKE '%lavida massage%' OR name ILIKE '%la vida massage%' THEN 'LaVida Massage'
    WHEN name ILIKE '%spavia%' THEN 'Spavia'
    WHEN name ILIKE '%massage green%' THEN 'Massage Green'
    ELSE 'Other'
  END AS franchise_brand,
  COUNT(*) AS cnt
FROM companies
WHERE name ILIKE '%massage envy%'
   OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
   OR name ILIKE '%elements massage%'
   OR name ILIKE '%massage heights%'
   OR name ILIKE '%massage luxe%' OR name ILIKE '%massageluxe%'
   OR name ILIKE '%lavida massage%' OR name ILIKE '%la vida massage%'
   OR name ILIKE '%spavia%'
   OR name ILIKE '%massage green%'
GROUP BY franchise_brand
ORDER BY cnt DESC;

-- 3b. Existing chain_blocklist matches (retail chains — currently blocking)
SELECT cb.chain_name, COUNT(c.id) AS matching_companies
FROM chain_blocklist cb
LEFT JOIN companies c ON (
  c.name ILIKE '%' || cb.chain_name || '%'
  OR (cb.domain_pattern IS NOT NULL AND c.domain ILIKE '%' || cb.domain_pattern || '%')
)
WHERE cb.active = true
GROUP BY cb.chain_name
ORDER BY matching_companies DESC;


-- ════════════════════════════════════════════════════════════
-- SECTION 4: MOBILE PRACTICE DETECTION
-- ════════════════════════════════════════════════════════════

SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ILIKE '%mobile massage%'
   OR name ILIKE '%house call%'
   OR name ILIKE '%in-home massage%'
   OR name ILIKE '%in home massage%'
   OR name ILIKE '%traveling massage%'
   OR name ILIKE '%travelling massage%'
   OR name ILIKE '%on-site massage%'
   OR name ILIKE '%onsite massage%'
   OR name ILIKE '%outcall%'
   OR name ILIKE '%we come to you%'
   OR name ILIKE '%mobile therap%'
ORDER BY lead_score DESC;


-- ════════════════════════════════════════════════════════════
-- SECTION 5: LANGUAGE BARRIER RISK SIGNALS
-- ════════════════════════════════════════════════════════════

-- 5a. Business name pattern matches
SELECT name, category, city, state, domain, lead_score, has_website
FROM companies
WHERE name ILIKE '%thai massage%'
   OR name ILIKE '%thai spa%'
   OR name ILIKE '%asian massage%'
   OR name ILIKE '%asian spa%'
   OR name ILIKE '%chinese massage%'
   OR name ILIKE '%korean massage%'
   OR name ILIKE '%vietnamese%massage%'
   OR name ILIKE '%foot massage%'
   OR name ILIKE '%reflexology%'
   OR name ILIKE '%oriental%massage%'
   OR name ILIKE '%oriental%spa%'
ORDER BY lead_score DESC;

-- 5b. Language barrier pattern companies — website presence
SELECT
  COUNT(*) AS total_lang_barrier_matches,
  COUNT(*) FILTER (WHERE has_website = true) AS has_website,
  COUNT(*) FILTER (WHERE has_website = false OR has_website IS NULL) AS no_website,
  COUNT(*) FILTER (WHERE domain IS NOT NULL) AS has_domain,
  COUNT(*) FILTER (WHERE domain IS NULL) AS no_domain
FROM companies
WHERE name ILIKE '%thai massage%'
   OR name ILIKE '%thai spa%'
   OR name ILIKE '%asian massage%'
   OR name ILIKE '%asian spa%'
   OR name ILIKE '%chinese massage%'
   OR name ILIKE '%korean massage%'
   OR name ILIKE '%vietnamese%massage%'
   OR name ILIKE '%foot massage%'
   OR name ILIKE '%reflexology%'
   OR name ILIKE '%oriental%massage%'
   OR name ILIKE '%oriental%spa%';

-- 5c. Cultural affinity data — overall population rate
SELECT
  COUNT(*) AS total_contacts,
  COUNT(cultural_affinity) AS has_affinity,
  COUNT(*) - COUNT(cultural_affinity) AS missing_affinity,
  ROUND(100.0 * COUNT(cultural_affinity) / NULLIF(COUNT(*), 0), 1) AS pct_populated
FROM contacts;

-- 5d. Contacts with non-human first names (business names, titles, placeholders)
SELECT
  first_name, COUNT(*) AS cnt
FROM contacts
WHERE first_name IS NOT NULL
  AND (
    first_name ILIKE '%front desk%'
    OR first_name ILIKE '%owner%'
    OR first_name ILIKE '%manager%'
    OR first_name ILIKE '%massage%'
    OR first_name ILIKE '%spa%'
    OR first_name ILIKE '%therapy%'
    OR first_name ILIKE '%wellness%'
    OR first_name ILIKE '%studio%'
    OR first_name ILIKE '%clinic%'
    OR first_name ILIKE '%center%'
    OR LENGTH(first_name) > 20
  )
GROUP BY first_name
ORDER BY cnt DESC
LIMIT 30;

-- 5e. Cultural affinity at language-barrier-risk companies
-- Cross-tab: do contacts at "Thai/Asian/Chinese" businesses have cultural_affinity populated?
SELECT
  COUNT(DISTINCT co.id) AS lang_barrier_companies,
  COUNT(ct.id) AS total_contacts_at_these,
  COUNT(ct.cultural_affinity) AS contacts_with_affinity,
  COUNT(ct.id) - COUNT(ct.cultural_affinity) AS contacts_missing_affinity,
  ROUND(100.0 * COUNT(ct.cultural_affinity) / NULLIF(COUNT(ct.id), 0), 1) AS pct_affinity_populated
FROM companies co
LEFT JOIN contacts ct ON ct.company_id = co.id
WHERE co.name ILIKE '%thai massage%'
   OR co.name ILIKE '%thai spa%'
   OR co.name ILIKE '%asian massage%'
   OR co.name ILIKE '%asian spa%'
   OR co.name ILIKE '%chinese massage%'
   OR co.name ILIKE '%korean massage%'
   OR co.name ILIKE '%foot massage%'
   OR co.name ILIKE '%reflexology%';

-- 5f. Cultural affinity values at language-barrier companies (when populated)
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


-- ════════════════════════════════════════════════════════════
-- SECTION 6: SUMMARY DASHBOARD
-- ════════════════════════════════════════════════════════════

-- 6a. Total pipeline size
SELECT
  COUNT(*) AS total_companies,
  COUNT(*) FILTER (WHERE enrichment_status = 'fully_enriched') AS fully_enriched,
  COUNT(*) FILTER (WHERE lead_score > 0) AS has_lead_score,
  COUNT(*) FILTER (WHERE lead_score >= 30) AS high_value_leads
FROM companies;

-- 6b. Would-be-affected counts by filter type
SELECT
  'physical_therapy' AS filter_type,
  COUNT(*) AS would_affect,
  COUNT(*) FILTER (WHERE lead_score >= 30) AS high_value_affected
FROM companies
WHERE name ILIKE '%physical therap%' OR name ILIKE '%physiotherap%' OR name ILIKE '%rehab%'
UNION ALL
SELECT 'chiropractic',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%chiropract%' OR name ILIKE '%chiro %' OR name ILIKE '%chiro-%'
UNION ALL
SELECT 'med_spa_aesthetics',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%med spa%' OR name ILIKE '%medspa%' OR name ILIKE '%medical spa%'
   OR name ILIKE '%aestheti%' OR name ILIKE '%dermatolog%' OR name ILIKE '%botox%'
UNION ALL
SELECT 'acupuncture',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%acupunctur%'
UNION ALL
SELECT 'float_salt_biohacking',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%float%therap%' OR name ILIKE '%float spa%' OR name ILIKE '%salt cave%'
   OR name ILIKE '%cryother%' OR name ILIKE '%infrared sauna%'
UNION ALL
SELECT 'energy_healing',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%reiki%' OR name ILIKE '%energy heal%' OR name ILIKE '%crystal heal%'
   OR name ILIKE '%sound heal%' OR name ILIKE '%sound bath%'
UNION ALL
SELECT 'franchise',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%massage envy%' OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
   OR name ILIKE '%elements massage%' OR name ILIKE '%massage heights%'
   OR name ILIKE '%massage luxe%' OR name ILIKE '%lavida massage%'
   OR name ILIKE '%spavia%' OR name ILIKE '%massage green%'
UNION ALL
SELECT 'mobile_practice',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%mobile massage%' OR name ILIKE '%house call%' OR name ILIKE '%outcall%'
   OR name ILIKE '%in-home massage%' OR name ILIKE '%traveling massage%'
UNION ALL
SELECT 'language_barrier_risk',
  COUNT(*),
  COUNT(*) FILTER (WHERE lead_score >= 30)
FROM companies
WHERE name ILIKE '%thai massage%' OR name ILIKE '%thai spa%' OR name ILIKE '%asian massage%'
   OR name ILIKE '%asian spa%' OR name ILIKE '%chinese massage%' OR name ILIKE '%korean massage%'
   OR name ILIKE '%foot massage%' OR name ILIKE '%reflexology%'
ORDER BY would_affect DESC;

-- 6c. Apollo blast radius — how many affected records already synced?
SELECT
  COUNT(*) AS total_would_affect,
  COUNT(*) FILTER (WHERE apollo_synced_at IS NOT NULL) AS already_synced_to_apollo
FROM companies
WHERE name ILIKE '%physical therap%' OR name ILIKE '%physiotherap%' OR name ILIKE '%rehab%'
   OR name ILIKE '%chiropract%' OR name ILIKE '%chiro %'
   OR name ILIKE '%med spa%' OR name ILIKE '%medspa%' OR name ILIKE '%medical spa%'
   OR name ILIKE '%aestheti%' OR name ILIKE '%dermatolog%' OR name ILIKE '%botox%'
   OR name ILIKE '%acupunctur%'
   OR name ILIKE '%float%therap%' OR name ILIKE '%salt cave%' OR name ILIKE '%cryother%'
   OR name ILIKE '%reiki%' OR name ILIKE '%energy heal%' OR name ILIKE '%sound heal%'
   OR name ILIKE '%massage envy%' OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
   OR name ILIKE '%elements massage%' OR name ILIKE '%massage heights%'
   OR name ILIKE '%mobile massage%' OR name ILIKE '%house call%' OR name ILIKE '%outcall%';


-- ════════════════════════════════════════════════════════════
-- SECTION 7: FALSE POSITIVE SAMPLING
-- ════════════════════════════════════════════════════════════

-- 7a. Physical therapy — sample for manual review
SELECT name, category, domain, city, state, lead_score, has_online_booking, enrichment_status
FROM companies
WHERE name ILIKE '%physical therap%' OR name ILIKE '%physiotherap%' OR name ILIKE '%rehab%'
ORDER BY RANDOM()
LIMIT 10;

-- 7b. Chiropractic — sample
SELECT name, category, domain, city, state, lead_score, has_online_booking, enrichment_status
FROM companies
WHERE name ILIKE '%chiropract%' OR name ILIKE '%chiro %' OR name ILIKE '%chiro-%'
ORDER BY RANDOM()
LIMIT 10;

-- 7c. DC credential pattern — ALL matches for false positive verification
SELECT name, category, city, state, domain, lead_score
FROM companies
WHERE name ~ ',\s*D\.?C\.?\s*$'
   OR (name ~ '\b[A-Z][a-z]+,?\s+DC\b' AND name NOT ILIKE '%washington%')
ORDER BY name;

-- 7d. Med spa / aesthetics — sample
SELECT name, category, domain, city, state, lead_score, has_online_booking, enrichment_status
FROM companies
WHERE name ILIKE '%med spa%' OR name ILIKE '%medspa%' OR name ILIKE '%medical spa%'
   OR name ILIKE '%aestheti%' OR name ILIKE '%botox%'
ORDER BY RANDOM()
LIMIT 10;

-- 7e. Energy healing — sample
SELECT name, category, domain, city, state, lead_score, has_online_booking, enrichment_status
FROM companies
WHERE name ILIKE '%reiki%' OR name ILIKE '%energy heal%' OR name ILIKE '%crystal heal%'
   OR name ILIKE '%sound heal%' OR name ILIKE '%sound bath%'
ORDER BY RANDOM()
LIMIT 10;

-- 7f. Franchise — sample (all matches, not random)
SELECT name, category, domain, city, state, lead_score
FROM companies
WHERE name ILIKE '%massage envy%' OR name ILIKE '%hand & stone%' OR name ILIKE '%hand and stone%'
   OR name ILIKE '%elements massage%' OR name ILIKE '%massage heights%'
   OR name ILIKE '%massage luxe%' OR name ILIKE '%lavida massage%'
   OR name ILIKE '%spavia%' OR name ILIKE '%massage green%'
ORDER BY name
LIMIT 20;

-- 7g. Mobile practice — sample
SELECT name, category, domain, city, state, lead_score, has_online_booking, enrichment_status
FROM companies
WHERE name ILIKE '%mobile massage%' OR name ILIKE '%house call%' OR name ILIKE '%outcall%'
   OR name ILIKE '%in-home massage%' OR name ILIKE '%traveling massage%'
ORDER BY RANDOM()
LIMIT 10;

-- 7h. Language barrier risk — sample
SELECT name, category, domain, city, state, lead_score, has_website, enrichment_status
FROM companies
WHERE name ILIKE '%thai massage%' OR name ILIKE '%thai spa%' OR name ILIKE '%asian massage%'
   OR name ILIKE '%asian spa%' OR name ILIKE '%chinese massage%' OR name ILIKE '%korean massage%'
   OR name ILIKE '%foot massage%' OR name ILIKE '%reflexology%'
ORDER BY RANDOM()
LIMIT 10;
