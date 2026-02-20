-- Pipeline Summary Stats
-- Quick health check: how many actionable leads do we have?

-- 1. Company counts by metro
SELECT
  discovery_metro,
  COUNT(*)                                                    AS total_companies,
  COUNT(*) FILTER (WHERE enrichment_status = 'fully_enriched') AS fully_enriched,
  COUNT(*) FILTER (WHERE lead_score >= 50)                    AS high_score,
  COUNT(*) FILTER (WHERE email IS NOT NULL AND email_status = 'verified') AS verified_emails,
  COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone_status = 'valid')    AS valid_phones,
  COUNT(*) FILTER (WHERE has_online_booking)                  AS has_booking,
  ROUND(AVG(lead_score), 1)                                   AS avg_lead_score
FROM companies
GROUP BY discovery_metro
ORDER BY total_companies DESC;

-- 2. Contact enrichment summary by metro
SELECT
  co.discovery_metro,
  COUNT(DISTINCT ct.id)                                                      AS total_contacts,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.email_business IS NOT NULL)         AS with_email,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.email_status = 'verified')          AS email_verified,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.email_status = 'invalid')           AS email_invalid,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.phone_direct IS NOT NULL)           AS with_phone,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.phone_status = 'valid')             AS phone_valid,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.linkedin_url IS NOT NULL)           AS with_linkedin,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.cultural_affinity IS NOT NULL)      AS with_cultural,
  COUNT(DISTINCT ct.id) FILTER (
    WHERE ct.email_status IN ('verified','accept_all')
       OR ct.phone_status = 'valid'
       OR ct.linkedin_url IS NOT NULL
  ) AS actionable_contacts
FROM contacts ct
JOIN companies co ON co.id = ct.company_id
GROUP BY co.discovery_metro
ORDER BY total_contacts DESC;

-- 3. Outreach readiness: contacts with N channels available
SELECT
  channels,
  COUNT(*) AS contact_count
FROM (
  SELECT
    ct.id,
    (CASE WHEN ct.email_business IS NOT NULL AND ct.email_status IN ('verified','accept_all') THEN 1 ELSE 0 END
     + CASE WHEN ct.phone_direct IS NOT NULL AND ct.phone_status = 'valid' THEN 1 ELSE 0 END
     + CASE WHEN ct.linkedin_url IS NOT NULL THEN 1 ELSE 0 END
    ) AS channels
  FROM contacts ct
  JOIN companies co ON co.id = ct.company_id
  WHERE co.enrichment_status IN ('fully_enriched','partially_enriched')
) sub
WHERE channels > 0
GROUP BY channels
ORDER BY channels DESC;

-- 4. Contact source breakdown
SELECT
  source,
  COUNT(*)                                                        AS total,
  COUNT(*) FILTER (WHERE first_name IS NOT NULL)                  AS has_name,
  COUNT(*) FILTER (WHERE email_business IS NOT NULL)              AS has_email,
  COUNT(*) FILTER (WHERE email_status IN ('verified','accept_all')) AS email_verified,
  COUNT(*) FILTER (WHERE phone_direct IS NOT NULL)                AS has_phone,
  COUNT(*) FILTER (WHERE phone_status = 'valid')                  AS phone_valid,
  COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL)                AS has_linkedin
FROM contacts
GROUP BY source
ORDER BY total DESC;
