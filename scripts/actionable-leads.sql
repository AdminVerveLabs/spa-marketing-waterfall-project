-- Actionable Sales Leads Report (Company-Centric)
-- Shows ALL companies with at least one outreach channel,
-- with their best contact (if any), social profiles, and context.
--
-- Company-centric: companies without contacts still appear
-- if they have a valid company phone, verified company email,
-- or social profiles (Facebook, Instagram).
--
-- Run against Supabase SQL Editor or psql.
-- Filter by metro: change the WHERE discovery_metro clause.

WITH social_agg AS (
  -- Pivot social profiles into one row per company
  SELECT
    company_id,
    MAX(profile_url) FILTER (WHERE platform = 'facebook')  AS facebook_url,
    MAX(follower_count) FILTER (WHERE platform = 'facebook') AS facebook_followers,
    MAX(profile_url) FILTER (WHERE platform = 'instagram')  AS instagram_url,
    MAX(follower_count) FILTER (WHERE platform = 'instagram') AS instagram_followers,
    MAX(profile_url) FILTER (WHERE platform = 'linkedin')   AS linkedin_company_url,
    MAX(profile_url) FILTER (WHERE platform = 'tiktok')     AS tiktok_url,
    MAX(profile_url) FILTER (WHERE platform = 'youtube')    AS youtube_url,
    COUNT(*)                                                 AS social_profile_count
  FROM social_profiles
  GROUP BY company_id
),

-- Rank contacts per company: owner first, then by enrichment quality
ranked_contacts AS (
  SELECT
    ct.*,
    ROW_NUMBER() OVER (
      PARTITION BY ct.company_id
      ORDER BY
        ct.is_owner DESC NULLS LAST,
        -- Prefer contacts with verified email
        CASE WHEN ct.email_status IN ('verified', 'accept_all') THEN 0 ELSE 1 END,
        -- Then contacts with valid phone
        CASE WHEN ct.phone_status = 'valid' THEN 0 ELSE 1 END,
        -- Then contacts with LinkedIn
        CASE WHEN ct.linkedin_url IS NOT NULL THEN 0 ELSE 1 END,
        ct.created_at ASC
    ) AS contact_rank
  FROM contacts ct
),

lead_data AS (
  SELECT
    -- Company info
    co.id                 AS company_id,
    co.name               AS company_name,
    co.phone              AS company_phone,
    co.email              AS company_email,
    co.domain,
    co.city,
    co.state,
    co.category,
    co.estimated_size,
    co.google_rating,
    co.google_review_count,
    co.has_online_booking,
    co.booking_platform,
    co.has_paid_ads,
    co.on_yelp,
    co.lead_score,
    co.discovery_metro,
    co.phone_status       AS company_phone_status,
    co.phone_line_type    AS company_phone_line_type,
    co.email_status       AS company_email_status,

    -- Best contact info (NULL if company has no contacts)
    ct.id                 AS contact_id,
    ct.first_name,
    ct.last_name,
    ct.role,
    ct.is_owner,
    ct.email_business,
    ct.email_personal,
    ct.phone_direct,
    ct.linkedin_url,
    ct.cultural_affinity,
    ct.source             AS contact_source,
    ct.email_status       AS contact_email_status,
    ct.phone_status       AS contact_phone_status,
    ct.phone_line_type    AS contact_phone_line_type,
    ct.phone_carrier,

    -- Social profiles (company-level)
    sa.facebook_url,
    sa.facebook_followers,
    sa.instagram_url,
    sa.instagram_followers,
    sa.linkedin_company_url,
    sa.tiktok_url,
    sa.youtube_url,
    sa.social_profile_count,

    -- Contact count per company
    (SELECT COUNT(*) FROM contacts c2 WHERE c2.company_id = co.id) AS total_contacts,

    -- Outreach channel flags
    CASE WHEN ct.email_business IS NOT NULL
          AND ct.email_status IN ('verified', 'accept_all')
         THEN true ELSE false
    END AS has_verified_email,

    CASE WHEN ct.phone_direct IS NOT NULL
          AND ct.phone_status = 'valid'
         THEN true ELSE false
    END AS has_valid_phone,

    CASE WHEN ct.linkedin_url IS NOT NULL
         THEN true ELSE false
    END AS has_linkedin,

    CASE WHEN co.phone IS NOT NULL
          AND co.phone_status = 'valid'
         THEN true ELSE false
    END AS has_valid_company_phone,

    CASE WHEN co.email IS NOT NULL
          AND co.email_status IN ('verified', 'accept_all')
         THEN true ELSE false
    END AS has_verified_company_email,

    CASE WHEN sa.facebook_url IS NOT NULL
         THEN true ELSE false
    END AS has_facebook,

    CASE WHEN sa.instagram_url IS NOT NULL
         THEN true ELSE false
    END AS has_instagram

  FROM companies co
  LEFT JOIN ranked_contacts ct ON ct.company_id = co.id AND ct.contact_rank = 1
  LEFT JOIN social_agg sa ON sa.company_id = co.id
  -- No enrichment_status filter: show all companies with any outreach channel
  WHERE co.discovery_metro IS NOT NULL
)

SELECT
  company_name,
  city || ', ' || state                         AS location,
  lead_score,
  total_contacts,
  CASE
    WHEN first_name IS NOT NULL
    THEN first_name || COALESCE(' ' || last_name, '')
    ELSE NULL
  END                                            AS contact_name,
  role,
  CASE WHEN is_owner THEN 'Yes' ELSE '' END     AS owner,

  -- Best outreach channels
  CASE
    WHEN has_verified_email          THEN email_business
    WHEN has_verified_company_email  THEN company_email || ' (company)'
    ELSE NULL
  END AS best_email,
  contact_email_status,

  CASE
    WHEN has_valid_phone             THEN phone_direct
    WHEN has_valid_company_phone     THEN company_phone || ' (company)'
    ELSE NULL
  END AS best_phone,
  contact_phone_status,
  contact_phone_line_type,

  linkedin_url,

  -- Social profiles
  facebook_url,
  facebook_followers,
  instagram_url,
  instagram_followers,
  linkedin_company_url,
  tiktok_url,
  youtube_url,
  COALESCE(social_profile_count, 0) AS social_profiles,

  cultural_affinity,

  -- Company context
  estimated_size,
  google_rating,
  google_review_count,
  CASE WHEN has_online_booking THEN booking_platform ELSE NULL END AS booking,
  CASE WHEN has_paid_ads THEN 'Yes' ELSE '' END AS paid_ads,
  domain,
  contact_source,
  discovery_metro,

  -- Channel count for sorting (includes social DM channels)
  (CASE WHEN has_verified_email THEN 1 ELSE 0 END
   + CASE WHEN has_valid_phone THEN 1 ELSE 0 END
   + CASE WHEN has_linkedin THEN 1 ELSE 0 END
   + CASE WHEN has_valid_company_phone THEN 1 ELSE 0 END
   + CASE WHEN has_verified_company_email THEN 1 ELSE 0 END
   + CASE WHEN has_facebook THEN 1 ELSE 0 END
   + CASE WHEN has_instagram THEN 1 ELSE 0 END
  ) AS outreach_channels

FROM lead_data

-- At least one way to reach out
WHERE (has_verified_email
    OR has_valid_phone
    OR has_linkedin
    OR has_valid_company_phone
    OR has_verified_company_email
    OR has_facebook
    OR has_instagram)

  -- Optional metro filter (remove or change as needed)
  -- AND discovery_metro = 'Austin, TX'

ORDER BY
  lead_score DESC,
  outreach_channels DESC,
  google_review_count DESC;
