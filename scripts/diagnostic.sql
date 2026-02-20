-- ============================================================
-- Diagnostic SQL: Pipeline Health Check — Single JSON Output
-- Run in Supabase SQL Editor → 1 row, 1 column → copy JSON text
-- To change metro: find-and-replace 'Sedona, AZ' with target metro
-- ============================================================

SELECT json_build_object(
  'generated_at', NOW(),
  'metro', 'Sedona, AZ',

  -- ========== COMPANY FUNNEL ==========
  'company_funnel', (
    SELECT json_build_object(
      'total', COUNT(*),
      'discovered', COUNT(*) FILTER (WHERE enrichment_status = 'discovered'),
      'partially_enriched', COUNT(*) FILTER (WHERE enrichment_status = 'partially_enriched'),
      'fully_enriched', COUNT(*) FILTER (WHERE enrichment_status = 'fully_enriched'),
      'needs_review', COUNT(*) FILTER (WHERE enrichment_status = 'needs_review'),
      'has_domain', COUNT(*) FILTER (WHERE domain IS NOT NULL),
      'has_website', COUNT(*) FILTER (WHERE has_website),
      'has_phone', COUNT(*) FILTER (WHERE phone IS NOT NULL),
      'has_email', COUNT(*) FILTER (WHERE email IS NOT NULL),
      'has_rating', COUNT(*) FILTER (WHERE google_rating IS NOT NULL),
      'avg_rating', ROUND(AVG(google_rating), 2),
      'avg_reviews', ROUND(AVG(google_review_count), 1),
      'has_booking', COUNT(*) FILTER (WHERE has_online_booking),
      'has_paid_ads', COUNT(*) FILTER (WHERE has_paid_ads),
      'on_groupon', COUNT(*) FILTER (WHERE on_groupon),
      'on_yelp', COUNT(*) FILTER (WHERE on_yelp)
    )
    FROM companies
    WHERE discovery_metro = 'Sedona, AZ'
  ),

  -- ========== COMPANY VERIFICATION ==========
  'company_verification', (
    SELECT json_build_object(
      'phone_valid', COUNT(*) FILTER (WHERE phone_status = 'valid'),
      'phone_invalid', COUNT(*) FILTER (WHERE phone_status = 'invalid'),
      'phone_voip', COUNT(*) FILTER (WHERE phone_status = 'voip'),
      'phone_disconnected', COUNT(*) FILTER (WHERE phone_status = 'disconnected'),
      'phone_unverified', COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone_status IS NULL),
      'phone_mobile', COUNT(*) FILTER (WHERE phone_line_type = 'mobile'),
      'phone_landline', COUNT(*) FILTER (WHERE phone_line_type = 'landline'),
      'email_verified', COUNT(*) FILTER (WHERE email_status = 'verified'),
      'email_accept_all', COUNT(*) FILTER (WHERE email_status = 'accept_all'),
      'email_unverified', COUNT(*) FILTER (WHERE email IS NOT NULL AND email_status = 'unverified'),
      'email_invalid', COUNT(*) FILTER (WHERE email_status = 'invalid'),
      'email_risky', COUNT(*) FILTER (WHERE email_status = 'risky')
    )
    FROM companies
    WHERE discovery_metro = 'Sedona, AZ'
  ),

  -- ========== CONTACT FUNNEL ==========
  'contact_funnel', (
    SELECT json_build_object(
      'total', COUNT(*),
      'has_full_name', COUNT(*) FILTER (WHERE ct.first_name IS NOT NULL AND ct.last_name IS NOT NULL),
      'no_name', COUNT(*) FILTER (WHERE ct.first_name IS NULL AND ct.last_name IS NULL),
      'has_email', COUNT(*) FILTER (WHERE ct.email_business IS NOT NULL),
      'has_phone', COUNT(*) FILTER (WHERE ct.phone_direct IS NOT NULL),
      'has_linkedin', COUNT(*) FILTER (WHERE ct.linkedin_url IS NOT NULL),
      'email_verified', COUNT(*) FILTER (WHERE ct.email_status = 'verified'),
      'email_accept_all', COUNT(*) FILTER (WHERE ct.email_status = 'accept_all'),
      'email_unverified', COUNT(*) FILTER (WHERE ct.email_business IS NOT NULL
        AND (ct.email_status IS NULL OR ct.email_status = 'unverified')),
      'phone_valid', COUNT(*) FILTER (WHERE ct.phone_status = 'valid'),
      'phone_voip', COUNT(*) FILTER (WHERE ct.phone_status = 'voip'),
      'phone_unverified', COUNT(*) FILTER (WHERE ct.phone_direct IS NOT NULL AND ct.phone_status IS NULL),
      'has_cultural_affinity', COUNT(*) FILTER (WHERE ct.cultural_affinity IS NOT NULL),
      'is_owner', COUNT(*) FILTER (WHERE ct.is_owner = true)
    )
    FROM contacts ct
    JOIN companies co ON co.id = ct.company_id
    WHERE co.discovery_metro = 'Sedona, AZ'
  ),

  -- ========== CONTACTS BY SOURCE ==========
  'contacts_by_source', (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        ct.source,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE ct.first_name IS NOT NULL AND ct.last_name IS NOT NULL)::int AS has_name,
        COUNT(*) FILTER (WHERE ct.email_business IS NOT NULL)::int AS has_email,
        COUNT(*) FILTER (WHERE ct.phone_direct IS NOT NULL)::int AS has_phone
      FROM contacts ct
      JOIN companies co ON co.id = ct.company_id
      WHERE co.discovery_metro = 'Sedona, AZ'
      GROUP BY ct.source
      ORDER BY count DESC
    ) t
  ),

  -- ========== ENRICHMENT DEPTH ==========
  'enrichment_depth', (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        CASE
          WHEN cc = 0 THEN '0 contacts'
          WHEN cc = 1 THEN '1 contact'
          WHEN cc = 2 THEN '2 contacts'
          ELSE '3+ contacts'
        END AS bucket,
        COUNT(*)::int AS companies,
        COUNT(*) FILTER (WHERE has_any_channel)::int AS with_channel,
        COUNT(*) FILTER (WHERE NOT has_any_channel)::int AS no_channel
      FROM (
        SELECT
          co.id,
          COUNT(ct.id) AS cc,
          (
            EXISTS (
              SELECT 1 FROM contacts c
              WHERE c.company_id = co.id
                AND c.email_business IS NOT NULL
                AND c.email_status IN ('verified', 'accept_all')
            )
            OR (co.email IS NOT NULL AND co.email_status IN ('verified', 'accept_all'))
            OR EXISTS (
              SELECT 1 FROM contacts c
              WHERE c.company_id = co.id
                AND c.phone_direct IS NOT NULL
                AND c.phone_status = 'valid'
            )
            OR (co.phone IS NOT NULL AND co.phone_status = 'valid')
          ) AS has_any_channel
        FROM companies co
        LEFT JOIN contacts ct ON ct.company_id = co.id
        WHERE co.discovery_metro = 'Sedona, AZ'
        GROUP BY co.id, co.email, co.email_status, co.phone, co.phone_status
      ) cd
      GROUP BY
        CASE
          WHEN cc = 0 THEN '0 contacts'
          WHEN cc = 1 THEN '1 contact'
          WHEN cc = 2 THEN '2 contacts'
          ELSE '3+ contacts'
        END
      ORDER BY bucket
    ) t
  ),

  -- ========== SCORE DISTRIBUTION ==========
  'score_distribution', (
    SELECT json_build_object(
      'min', MIN(lead_score),
      'p25', (percentile_cont(0.25) WITHIN GROUP (ORDER BY lead_score))::int,
      'median', (percentile_cont(0.5) WITHIN GROUP (ORDER BY lead_score))::int,
      'p75', (percentile_cont(0.75) WITHIN GROUP (ORDER BY lead_score))::int,
      'max', MAX(lead_score),
      'score_0', COUNT(*) FILTER (WHERE lead_score = 0),
      'score_1_19', COUNT(*) FILTER (WHERE lead_score BETWEEN 1 AND 19),
      'score_20_39', COUNT(*) FILTER (WHERE lead_score BETWEEN 20 AND 39),
      'score_40_plus', COUNT(*) FILTER (WHERE lead_score >= 40)
    )
    FROM companies
    WHERE discovery_metro = 'Sedona, AZ'
  ),

  -- ========== QUALITY FLAGS ==========
  'quality_flags', json_build_object(
    'blocked_domains', (
      SELECT COUNT(*)
      FROM companies
      WHERE discovery_metro = 'Sedona, AZ'
        AND domain IS NOT NULL
        AND (
          domain LIKE '%wixsite.com%' OR domain LIKE '%wix.com%'
          OR domain LIKE '%setmore.com%' OR domain LIKE '%schedulista.com%'
          OR domain LIKE '%glossgenius.com%' OR domain LIKE '%square.site%'
          OR domain LIKE '%genbook.com%' OR domain LIKE '%jane.app%'
          OR domain LIKE '%acuityscheduling.com%' OR domain LIKE '%mindbodyonline.com%'
          OR domain LIKE '%mindbody.io%' OR domain LIKE '%vagaro.com%'
          OR domain LIKE '%fresha.com%' OR domain LIKE '%schedulicity.com%'
          OR domain LIKE '%booksy.com%' OR domain LIKE '%massagebook.com%'
          OR domain LIKE '%noterro.com%' OR domain LIKE '%clinicsense.com%'
          OR domain LIKE '%calendly.com%' OR domain LIKE '%squarespace.com%'
        )
    ),
    'email_mismatches', (
      SELECT COUNT(*)
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
    ),
    'dead_leads', (
      SELECT COUNT(*)
      FROM companies co
      WHERE co.discovery_metro = 'Sedona, AZ'
        AND co.phone IS NULL
        AND co.email IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM contacts ct
          WHERE ct.company_id = co.id
            AND (ct.email_business IS NOT NULL OR ct.phone_direct IS NOT NULL)
        )
    ),
    'no_name_contacts', (
      SELECT COUNT(*)
      FROM contacts ct
      JOIN companies co ON co.id = ct.company_id
      WHERE co.discovery_metro = 'Sedona, AZ'
        AND ct.first_name IS NULL
        AND ct.last_name IS NULL
    ),
    'stuck_companies', (
      SELECT COUNT(*)
      FROM companies
      WHERE discovery_metro = 'Sedona, AZ'
        AND enrichment_status NOT IN ('fully_enriched', 'needs_review')
    )
  ),

  -- ========== SAMPLES ==========
  'samples', json_build_object(
    'dead_leads', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT co.name, co.domain, co.lead_score AS score
        FROM companies co
        WHERE co.discovery_metro = 'Sedona, AZ'
          AND co.phone IS NULL
          AND co.email IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM contacts ct
            WHERE ct.company_id = co.id
              AND (ct.email_business IS NOT NULL OR ct.phone_direct IS NOT NULL)
          )
        ORDER BY co.lead_score DESC NULLS LAST
        LIMIT 5
      ) t
    ),
    'stuck', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT co.name, co.enrichment_status AS status, co.enriched_at
        FROM companies co
        WHERE co.discovery_metro = 'Sedona, AZ'
          AND co.enrichment_status NOT IN ('fully_enriched', 'needs_review')
        ORDER BY co.enriched_at ASC NULLS FIRST
        LIMIT 5
      ) t
    ),
    'no_name_contacts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT co.name AS company, ct.source, ct.email_business AS email, ct.phone_direct AS phone
        FROM contacts ct
        JOIN companies co ON co.id = ct.company_id
        WHERE co.discovery_metro = 'Sedona, AZ'
          AND ct.first_name IS NULL
          AND ct.last_name IS NULL
        ORDER BY ct.created_at DESC
        LIMIT 5
      ) t
    ),
    'email_mismatches', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT co.name AS company, ct.email_business AS contact_email, co.domain AS company_domain
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
        LIMIT 5
      ) t
    )
  ),

  -- ========== BOOKING PLATFORMS ==========
  'booking_platforms', (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT booking_platform AS platform, COUNT(*)::int AS count
      FROM companies
      WHERE discovery_metro = 'Sedona, AZ'
        AND booking_platform IS NOT NULL
      GROUP BY booking_platform
      ORDER BY count DESC
    ) t
  )
);
