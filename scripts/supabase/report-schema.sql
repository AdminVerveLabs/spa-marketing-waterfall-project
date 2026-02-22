-- ============================================================
-- Report Generator Schema
-- Run this ONCE in Supabase SQL Editor
-- Adds: report columns to pipeline_runs, storage bucket,
--        and get_lead_report RPC function
-- ============================================================

-- ============================================================
-- 1. ADD REPORT COLUMNS TO pipeline_runs
-- ============================================================
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS report_url TEXT;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS report_status TEXT
  CHECK (report_status IN ('generating', 'completed', 'failed'));
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS report_error TEXT;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS report_emailed_at TIMESTAMPTZ;

-- ============================================================
-- 2. STORAGE BUCKET FOR REPORTS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('run-reports', 'run-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service_role full access (n8n uses service_role key)
-- Public read so report_url works as a direct download link
CREATE POLICY "Service role can manage run-reports"
  ON storage.objects FOR ALL
  USING (bucket_id = 'run-reports')
  WITH CHECK (bucket_id = 'run-reports');

-- ============================================================
-- 3. RPC FUNCTION: get_lead_report
-- Returns companies + best contact + social profiles for a metro
-- Called by report generator workflow
-- ============================================================
CREATE OR REPLACE FUNCTION get_lead_report(p_metro TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT
      c.lead_score,
      c.discovery_metro,
      c.city || ', ' || c.state AS metro,
      c.name AS company_name,
      c.category,
      c.estimated_size,
      COALESCE(ct.first_name || ' ' || ct.last_name, NULL) AS contact_name,
      ct.role AS contact_role,
      ct.is_owner AS owner,
      ct.email_business AS contact_email,
      ct.phone_direct AS contact_phone,
      ct.cultural_affinity,
      ct.linkedin_url,
      ct.source AS contact_source,
      c.phone AS company_phone,
      c.domain AS website,
      c.address,
      c.city,
      c.state,
      c.google_rating,
      c.google_review_count AS google_reviews,
      c.has_online_booking AS has_booking,
      c.booking_platform,
      c.on_groupon,
      sp.social_platforms,
      sp.instagram_url,
      sp.instagram_followers,
      sp.facebook_url,
      sp.facebook_followers,
      sp.tiktok_url,
      sp.youtube_url,
      sp.total_social_followers,
      sp.most_recent_post
    FROM companies c
    LEFT JOIN LATERAL (
      SELECT *
      FROM contacts
      WHERE company_id = c.id
      ORDER BY
        is_owner DESC,
        (email_business IS NOT NULL) DESC,
        (phone_direct IS NOT NULL) DESC,
        created_at ASC
      LIMIT 1
    ) ct ON true
    LEFT JOIN LATERAL (
      SELECT
        string_agg(platform, ', ' ORDER BY platform) AS social_platforms,
        MAX(profile_url) FILTER (WHERE platform = 'instagram') AS instagram_url,
        MAX(follower_count) FILTER (WHERE platform = 'instagram') AS instagram_followers,
        MAX(profile_url) FILTER (WHERE platform = 'facebook') AS facebook_url,
        MAX(follower_count) FILTER (WHERE platform = 'facebook') AS facebook_followers,
        MAX(profile_url) FILTER (WHERE platform = 'tiktok') AS tiktok_url,
        MAX(profile_url) FILTER (WHERE platform = 'youtube') AS youtube_url,
        COALESCE(SUM(follower_count), 0) AS total_social_followers,
        MAX(last_post_date) AS most_recent_post
      FROM social_profiles
      WHERE company_id = c.id
    ) sp ON true
    WHERE
      c.discovery_metro = p_metro
      AND c.enrichment_status != 'needs_review'
      AND c.category NOT IN (
        'Transportation Service',
        'Car repair and maintenance service',
        'Corporate Office',
        'Car Rental Agency',
        'Educational Institution',
        'Association / Organization',
        'Storage Facility',
        'Shipping Service',
        'Car Dealer'
      )
    ORDER BY c.lead_score DESC, c.google_review_count DESC
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
