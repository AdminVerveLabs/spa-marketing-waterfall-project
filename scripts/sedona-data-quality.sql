-- ============================================================
-- Sedona AZ Data Quality Inspection — 10 Queries
-- Run each numbered query ONE AT A TIME in Supabase SQL Editor
-- (Supabase only returns the last SELECT when multiple run together)
-- Context: Exec #170 — 128 companies, 8 sub-workflow batches
-- ============================================================


-- ============================================================
-- Q1: Executive Summary Scorecard
-- One row with ~10 key metrics for the entire metro
-- ============================================================

SELECT
  (SELECT COUNT(*) FROM companies WHERE discovery_metro = 'Sedona, AZ')
    AS total_companies,

  (SELECT COUNT(*) FROM companies WHERE discovery_metro = 'Sedona, AZ'
    AND enrichment_status = 'fully_enriched')
    AS fully_enriched,

  (SELECT COUNT(DISTINCT ct.company_id)
   FROM contacts ct JOIN companies co ON co.id = ct.company_id
   WHERE co.discovery_metro = 'Sedona, AZ')
    AS companies_with_contacts,

  (SELECT COUNT(*) FROM contacts ct
   JOIN companies co ON co.id = ct.company_id
   WHERE co.discovery_metro = 'Sedona, AZ')
    AS total_contacts,

  -- Outreach-ready: any verified channel (contact or company level)
  (SELECT COUNT(*) FROM companies co
   WHERE co.discovery_metro = 'Sedona, AZ'
   AND (
     (co.email IS NOT NULL AND co.email_status IN ('verified', 'accept_all'))
     OR (co.phone IS NOT NULL AND co.phone_status = 'valid')
     OR EXISTS (
       SELECT 1 FROM contacts ct
       WHERE ct.company_id = co.id
         AND (
           (ct.email_business IS NOT NULL AND ct.email_status IN ('verified', 'accept_all'))
           OR (ct.phone_direct IS NOT NULL AND ct.phone_status = 'valid')
         )
     )
   ))
    AS outreach_ready,

  -- Dead leads: no channel at all
  (SELECT COUNT(*) FROM companies co
   WHERE co.discovery_metro = 'Sedona, AZ'
   AND co.phone IS NULL
   AND co.email IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM contacts ct
     WHERE ct.company_id = co.id
       AND (ct.email_business IS NOT NULL OR ct.phone_direct IS NOT NULL)
   ))
    AS dead_leads,

  (SELECT ROUND(AVG(lead_score), 1) FROM companies
   WHERE discovery_metro = 'Sedona, AZ')
    AS avg_lead_score,

  (SELECT MIN(lead_score) FROM companies
   WHERE discovery_metro = 'Sedona, AZ')
    AS min_lead_score,

  (SELECT MAX(lead_score) FROM companies
   WHERE discovery_metro = 'Sedona, AZ')
    AS max_lead_score;


-- ============================================================
-- Q2: Enrichment Status Breakdown
-- One row per status with count and percentage
-- ============================================================

SELECT
  enrichment_status,
  COUNT(*)                                              AS companies,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)   AS pct
FROM companies
WHERE discovery_metro = 'Sedona, AZ'
GROUP BY enrichment_status
ORDER BY companies DESC;


-- ============================================================
-- Q3: Company Field Coverage + Digital Signals
-- One wide row combining coverage rates and digital signal counts
-- ============================================================

SELECT
  -- Field coverage
  COUNT(*)                                                                      AS total_companies,
  COUNT(*) FILTER (WHERE phone IS NOT NULL)                                     AS has_phone,
  ROUND(100.0 * COUNT(*) FILTER (WHERE phone IS NOT NULL) / COUNT(*), 1)        AS phone_pct,
  COUNT(*) FILTER (WHERE domain IS NOT NULL)                                    AS has_domain,
  ROUND(100.0 * COUNT(*) FILTER (WHERE domain IS NOT NULL) / COUNT(*), 1)       AS domain_pct,
  COUNT(*) FILTER (WHERE has_website)                                           AS has_website,
  ROUND(100.0 * COUNT(*) FILTER (WHERE has_website) / COUNT(*), 1)              AS website_pct,
  COUNT(*) FILTER (WHERE email IS NOT NULL)                                     AS has_email,
  ROUND(100.0 * COUNT(*) FILTER (WHERE email IS NOT NULL) / COUNT(*), 1)        AS email_pct,
  COUNT(*) FILTER (WHERE google_rating IS NOT NULL)                             AS has_rating,
  ROUND(100.0 * COUNT(*) FILTER (WHERE google_rating IS NOT NULL) / COUNT(*), 1) AS rating_pct,
  ROUND(AVG(google_rating), 2)                                                 AS avg_rating,
  ROUND(AVG(google_review_count), 1)                                           AS avg_reviews,

  -- Digital signals
  COUNT(*) FILTER (WHERE has_online_booking)                                    AS with_booking,
  COUNT(*) FILTER (WHERE has_paid_ads)                                          AS with_paid_ads,
  COUNT(*) FILTER (WHERE on_groupon)                                            AS on_groupon,
  COUNT(*) FILTER (WHERE on_yelp)                                               AS on_yelp,
  COUNT(*) FILTER (WHERE has_website AND NOT has_online_booking)                 AS website_no_booking,
  COUNT(*) FILTER (WHERE NOT has_website)                                        AS no_website
FROM companies
WHERE discovery_metro = 'Sedona, AZ';


-- ============================================================
-- Q4: Company Phone & Email Verification
-- One wide row with phone/email status breakdowns
-- ============================================================

SELECT
  -- Phone verification (companies with phones)
  COUNT(*) FILTER (WHERE phone IS NOT NULL)                                     AS companies_with_phone,
  COUNT(*) FILTER (WHERE phone_status = 'valid')                                AS phone_valid,
  COUNT(*) FILTER (WHERE phone_status = 'invalid')                              AS phone_invalid,
  COUNT(*) FILTER (WHERE phone_status = 'disconnected')                         AS phone_disconnected,
  COUNT(*) FILTER (WHERE phone_status = 'voip')                                 AS phone_voip,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone_status IS NULL)             AS phone_unverified,
  COUNT(*) FILTER (WHERE phone_line_type = 'mobile')                            AS phone_mobile,
  COUNT(*) FILTER (WHERE phone_line_type = 'landline')                          AS phone_landline,
  COUNT(*) FILTER (WHERE phone_line_type = 'voip')                              AS phone_line_voip,
  COUNT(*) FILTER (WHERE phone_line_type = 'toll_free')                         AS phone_toll_free,

  -- Email verification (companies with emails)
  COUNT(*) FILTER (WHERE email IS NOT NULL)                                     AS companies_with_email,
  COUNT(*) FILTER (WHERE email_status = 'verified')                             AS email_verified,
  COUNT(*) FILTER (WHERE email_status = 'accept_all')                           AS email_accept_all,
  COUNT(*) FILTER (WHERE email_status = 'unverified')                           AS email_unverified,
  COUNT(*) FILTER (WHERE email_status = 'invalid')                              AS email_invalid,
  COUNT(*) FILTER (WHERE email_status = 'risky')                                AS email_risky
FROM companies
WHERE discovery_metro = 'Sedona, AZ';


-- ============================================================
-- Q5: Contact Overview by Source
-- One row per source with name/email/phone/linkedin counts
-- ============================================================

SELECT
  ct.source,
  COUNT(*)                                                                              AS total,
  COUNT(*) FILTER (WHERE ct.first_name IS NOT NULL)                                     AS has_first_name,
  COUNT(*) FILTER (WHERE ct.last_name IS NOT NULL)                                      AS has_last_name,
  COUNT(*) FILTER (WHERE ct.first_name IS NOT NULL AND ct.last_name IS NOT NULL)         AS has_full_name,
  COUNT(*) FILTER (WHERE ct.first_name IS NULL AND ct.last_name IS NULL)                 AS no_name,
  COUNT(*) FILTER (WHERE ct.email_business IS NOT NULL)                                  AS has_email,
  COUNT(*) FILTER (WHERE ct.phone_direct IS NOT NULL)                                    AS has_phone,
  COUNT(*) FILTER (WHERE ct.linkedin_url IS NOT NULL)                                    AS has_linkedin
FROM contacts ct
JOIN companies co ON co.id = ct.company_id
WHERE co.discovery_metro = 'Sedona, AZ'
GROUP BY ct.source
ORDER BY total DESC;


-- ============================================================
-- Q6: Contact Channel Quality
-- One wide row: email/phone/linkedin coverage + verification status
-- ============================================================

SELECT
  COUNT(*)                                                                              AS total_contacts,

  -- Email coverage
  COUNT(*) FILTER (WHERE ct.email_business IS NOT NULL)                                  AS has_email,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ct.email_business IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS email_pct,
  COUNT(*) FILTER (WHERE ct.email_status = 'verified')                                   AS email_verified,
  COUNT(*) FILTER (WHERE ct.email_status = 'accept_all')                                 AS email_accept_all,
  COUNT(*) FILTER (WHERE ct.email_status = 'unverified')                                 AS email_unverified,
  COUNT(*) FILTER (WHERE ct.email_status = 'invalid')                                    AS email_invalid,
  COUNT(*) FILTER (WHERE ct.email_status = 'risky')                                      AS email_risky,

  -- Phone coverage
  COUNT(*) FILTER (WHERE ct.phone_direct IS NOT NULL)                                    AS has_phone,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ct.phone_direct IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS phone_pct,
  COUNT(*) FILTER (WHERE ct.phone_status = 'valid')                                      AS phone_valid,
  COUNT(*) FILTER (WHERE ct.phone_status = 'voip')                                       AS phone_voip,
  COUNT(*) FILTER (WHERE ct.phone_status = 'invalid')                                    AS phone_invalid,
  COUNT(*) FILTER (WHERE ct.phone_status = 'disconnected')                               AS phone_disconnected,
  COUNT(*) FILTER (WHERE ct.phone_direct IS NOT NULL AND ct.phone_status IS NULL)         AS phone_unverified,

  -- LinkedIn coverage
  COUNT(*) FILTER (WHERE ct.linkedin_url IS NOT NULL)                                    AS has_linkedin,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ct.linkedin_url IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS linkedin_pct,
  COUNT(*) FILTER (WHERE ct.cultural_affinity IS NOT NULL)                               AS has_cultural_affinity,

  -- Role distribution
  COUNT(*) FILTER (WHERE ct.is_owner = true)                                             AS is_owner,
  COUNT(*) FILTER (WHERE ct.role IS NOT NULL)                                            AS has_role
FROM contacts ct
JOIN companies co ON co.id = ct.company_id
WHERE co.discovery_metro = 'Sedona, AZ';


-- ============================================================
-- Q7: Enrichment Depth + Sales Readiness
-- Contact-per-company buckets + outreach channel availability
-- ============================================================

WITH company_data AS (
  SELECT
    co.id,
    co.name,
    co.lead_score,
    COUNT(ct.id) AS contact_count,

    -- Channel flags (any verified contact OR company-level)
    (
      EXISTS (
        SELECT 1 FROM contacts c
        WHERE c.company_id = co.id
          AND c.email_business IS NOT NULL
          AND c.email_status IN ('verified', 'accept_all')
      )
      OR (co.email IS NOT NULL AND co.email_status IN ('verified', 'accept_all'))
    ) AS any_email,

    (
      EXISTS (
        SELECT 1 FROM contacts c
        WHERE c.company_id = co.id
          AND c.phone_direct IS NOT NULL
          AND c.phone_status = 'valid'
      )
      OR (co.phone IS NOT NULL AND co.phone_status = 'valid')
    ) AS any_phone

  FROM companies co
  LEFT JOIN contacts ct ON ct.company_id = co.id
  WHERE co.discovery_metro = 'Sedona, AZ'
  GROUP BY co.id, co.name, co.lead_score, co.email, co.email_status, co.phone, co.phone_status
)
SELECT
  CASE
    WHEN contact_count = 0 THEN '0 contacts'
    WHEN contact_count = 1 THEN '1 contact'
    WHEN contact_count = 2 THEN '2 contacts'
    ELSE '3+ contacts'
  END AS contact_bucket,
  COUNT(*) AS companies,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct,
  ROUND(AVG(lead_score), 1) AS avg_score,
  COUNT(*) FILTER (WHERE any_email AND any_phone)   AS both_channels,
  COUNT(*) FILTER (WHERE any_email AND NOT any_phone) AS email_only,
  COUNT(*) FILTER (WHERE any_phone AND NOT any_email) AS phone_only,
  COUNT(*) FILTER (WHERE NOT any_email AND NOT any_phone) AS no_channel
FROM company_data
GROUP BY
  CASE
    WHEN contact_count = 0 THEN '0 contacts'
    WHEN contact_count = 1 THEN '1 contact'
    WHEN contact_count = 2 THEN '2 contacts'
    ELSE '3+ contacts'
  END
ORDER BY contact_bucket;


-- ============================================================
-- Q8: Top 20 Highest-Scored Leads
-- Best contact info per company, ranked by lead score
-- ============================================================

WITH best_contact AS (
  SELECT DISTINCT ON (ct.company_id)
    ct.company_id,
    ct.first_name,
    ct.last_name,
    ct.role,
    ct.email_business,
    ct.email_status   AS contact_email_status,
    ct.phone_direct,
    ct.phone_status   AS contact_phone_status,
    ct.linkedin_url,
    ct.source
  FROM contacts ct
  JOIN companies co ON co.id = ct.company_id
  WHERE co.discovery_metro = 'Sedona, AZ'
  ORDER BY ct.company_id,
    ct.is_owner DESC NULLS LAST,
    CASE WHEN ct.email_status IN ('verified', 'accept_all') THEN 0 ELSE 1 END,
    CASE WHEN ct.phone_status = 'valid' THEN 0 ELSE 1 END,
    ct.created_at ASC
)
SELECT
  co.lead_score,
  co.name                                                  AS company_name,
  co.category,
  co.estimated_size,
  co.google_rating,
  co.google_review_count,

  -- Best contact
  CASE WHEN bc.first_name IS NOT NULL
       THEN bc.first_name || COALESCE(' ' || bc.last_name, '')
       ELSE NULL
  END                                                      AS contact_name,
  bc.role,

  -- Best email (contact first, then company)
  COALESCE(
    CASE WHEN bc.contact_email_status IN ('verified', 'accept_all')
         THEN bc.email_business END,
    CASE WHEN co.email_status IN ('verified', 'accept_all')
         THEN co.email END
  )                                                        AS best_email,
  COALESCE(bc.contact_email_status, co.email_status)       AS email_status,

  -- Best phone (contact first, then company)
  COALESCE(
    CASE WHEN bc.contact_phone_status = 'valid'
         THEN bc.phone_direct END,
    CASE WHEN co.phone_status = 'valid'
         THEN co.phone END
  )                                                        AS best_phone,

  bc.linkedin_url,
  co.has_online_booking,
  co.on_groupon,
  co.domain

FROM companies co
LEFT JOIN best_contact bc ON bc.company_id = co.id
WHERE co.discovery_metro = 'Sedona, AZ'
ORDER BY co.lead_score DESC NULLS LAST
LIMIT 20;


-- ============================================================
-- Q9: Data Quality Flags
-- All quality issues in one UNION ALL result
-- flag_type identifies the issue category
-- ============================================================

-- Blocked domains that slipped through
SELECT
  'blocked_domain'     AS flag_type,
  co.name              AS company_name,
  co.domain            AS detail1,
  co.enrichment_status AS detail2
FROM companies co
WHERE co.discovery_metro = 'Sedona, AZ'
  AND co.domain IS NOT NULL
  AND (
    co.domain LIKE '%wixsite.com%'    OR co.domain LIKE '%wix.com%'
    OR co.domain LIKE '%setmore.com%' OR co.domain LIKE '%schedulista.com%'
    OR co.domain LIKE '%glossgenius.com%' OR co.domain LIKE '%square.site%'
    OR co.domain LIKE '%genbook.com%' OR co.domain LIKE '%jane.app%'
    OR co.domain LIKE '%acuityscheduling.com%' OR co.domain LIKE '%mindbodyonline.com%'
    OR co.domain LIKE '%mindbody.io%' OR co.domain LIKE '%vagaro.com%'
    OR co.domain LIKE '%fresha.com%'  OR co.domain LIKE '%schedulicity.com%'
    OR co.domain LIKE '%booksy.com%'  OR co.domain LIKE '%massagebook.com%'
    OR co.domain LIKE '%noterro.com%' OR co.domain LIKE '%clinicsense.com%'
    OR co.domain LIKE '%calendly.com%' OR co.domain LIKE '%squarespace.com%'
  )

UNION ALL

-- Email-domain mismatches (excluding free webmail)
SELECT
  'email_mismatch'     AS flag_type,
  co.name              AS company_name,
  ct.email_business    AS detail1,
  co.domain            AS detail2
FROM contacts ct
JOIN companies co ON co.id = ct.company_id
WHERE co.discovery_metro = 'Sedona, AZ'
  AND ct.email_business IS NOT NULL
  AND co.domain IS NOT NULL
  AND SPLIT_PART(ct.email_business, '@', 2) != co.domain
  AND SPLIT_PART(ct.email_business, '@', 2) NOT IN (
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'aol.com', 'icloud.com', 'me.com', 'live.com',
    'msn.com', 'protonmail.com', 'mail.com', 'ymail.com'
  )

UNION ALL

-- Dead leads (no phone, no email, no contact channels)
SELECT
  'dead_lead'          AS flag_type,
  co.name              AS company_name,
  co.domain            AS detail1,
  'score=' || COALESCE(co.lead_score::text, 'null') AS detail2
FROM companies co
WHERE co.discovery_metro = 'Sedona, AZ'
  AND co.phone IS NULL
  AND co.email IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM contacts ct
    WHERE ct.company_id = co.id
      AND (ct.email_business IS NOT NULL OR ct.phone_direct IS NOT NULL)
  )

UNION ALL

-- Contacts with no name (limits enrichment)
SELECT
  'no_name_contact'    AS flag_type,
  co.name              AS company_name,
  COALESCE(ct.email_business, ct.phone_direct, 'no channel') AS detail1,
  ct.source            AS detail2
FROM contacts ct
JOIN companies co ON co.id = ct.company_id
WHERE co.discovery_metro = 'Sedona, AZ'
  AND ct.first_name IS NULL
  AND ct.last_name IS NULL

UNION ALL

-- Companies stuck in non-final enrichment status
SELECT
  'stuck_status'       AS flag_type,
  co.name              AS company_name,
  co.enrichment_status AS detail1,
  co.enriched_at::text AS detail2
FROM companies co
WHERE co.discovery_metro = 'Sedona, AZ'
  AND co.enrichment_status NOT IN ('fully_enriched', 'needs_review')

ORDER BY flag_type, company_name;


-- ============================================================
-- Q10: Booking Platform Distribution
-- One row per platform with company count
-- ============================================================

SELECT
  booking_platform,
  COUNT(*) AS companies
FROM companies
WHERE discovery_metro = 'Sedona, AZ'
  AND booking_platform IS NOT NULL
GROUP BY booking_platform
ORDER BY companies DESC;
