-- Outreach-Ready Export Query
-- Run in Supabase SQL Editor → Download CSV
-- Returns all companies/contacts with at least one contact channel
-- Sorted by lead_score descending

SELECT
  co.lead_score,
  co.discovery_metro AS metro,
  co.name AS company_name,
  co.category,
  CONCAT_WS(' ', ct.first_name, ct.last_name) AS contact_name,
  ct.role AS contact_role,
  ct.email_business AS contact_email,
  ct.phone_direct AS contact_phone,
  co.phone AS company_phone,
  co.email AS company_email,
  co.email_status AS company_email_status,
  co.domain AS website,
  co.address,
  co.city,
  co.state,
  co.google_rating,
  co.google_review_count AS google_reviews,
  co.has_online_booking AS has_booking,
  co.booking_platform,
  co.on_groupon,
  co.estimated_size,
  ct.source AS contact_source,
  co.enrichment_status
FROM companies co
LEFT JOIN contacts ct ON ct.company_id = co.id
WHERE co.enrichment_status != 'needs_review'
  AND (
    ct.email_business IS NOT NULL
    OR ct.phone_direct IS NOT NULL
    OR co.phone IS NOT NULL
    OR co.email IS NOT NULL
  )
ORDER BY co.lead_score DESC NULLS LAST, co.name ASC;
