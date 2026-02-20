-- ============================================================
-- Step 5: Lead Scoring — SQL Deployment Script
-- Run this in Supabase SQL Editor (supabase.com > project > SQL Editor)
-- Session 15 — 2026-02-18
-- ============================================================

-- ============================================================
-- 1. SCORING RULES TABLE + SEED DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS scoring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_name TEXT NOT NULL,            -- Column in companies table
  condition TEXT NOT NULL
    CHECK (condition IN ('equals', 'not_equals', 'greater_than', 'less_than', 'is_null', 'is_not_null')),
  value TEXT,                          -- Value to compare (null for is_null/is_not_null)
  points INTEGER NOT NULL,             -- Positive or negative
  label TEXT,                          -- Human-readable description
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: enable but allow service_role full access
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on scoring_rules"
  ON scoring_rules
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed starter rules (idempotent — skips if rows already exist)
INSERT INTO scoring_rules (field_name, condition, value, points, label)
SELECT * FROM (VALUES
  ('on_groupon',          'equals',     'true',  15, 'On Groupon - price-sensitive, seeking clients'),
  ('has_website',         'equals',     'false', 10, 'No website - needs digital help'),
  ('has_online_booking',  'equals',     'false', 10, 'No online booking - missing key tool'),
  ('estimated_size',      'equals',     'solo',  20, 'Solo practitioner - sweet spot'),
  ('has_paid_ads',        'equals',     'true',   5, 'Runs paid ads - already spending on marketing'),
  ('google_review_count', 'less_than',  '20',     5, 'Low review count - room to grow')
) AS seed(field_name, condition, value, points, label)
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules LIMIT 1);


-- ============================================================
-- 2. CALCULATE_LEAD_SCORES() FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_lead_scores()
RETURNS void AS $$
DECLARE
  rule RECORD;
  sql_text TEXT;
BEGIN
  -- Reset all scores to 0
  UPDATE companies SET lead_score = 0;

  -- Apply each active rule
  FOR rule IN SELECT * FROM scoring_rules WHERE active = TRUE
  LOOP
    CASE rule.condition
      WHEN 'equals' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I::text = %L',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'not_equals' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I::text != %L',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'greater_than' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE (%I)::numeric > %s',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'less_than' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE (%I)::numeric < %s',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'is_null' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I IS NULL',
          rule.points, rule.field_name
        );
      WHEN 'is_not_null' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I IS NOT NULL',
          rule.points, rule.field_name
        );
    END CASE;

    EXECUTE sql_text;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 3. HIGH_PRIORITY_LEADS VIEW
-- ============================================================
CREATE OR REPLACE VIEW high_priority_leads AS
SELECT
  c.name AS company_name,
  c.lead_score,
  c.city,
  c.state,
  c.phone AS business_phone,
  c.domain,
  c.category,
  c.estimated_size,
  c.has_website,
  c.has_online_booking,
  c.on_groupon,
  c.on_yelp,
  c.google_review_count,
  c.google_rating,
  ct.first_name || ' ' || ct.last_name AS owner_name,
  ct.email_business AS owner_email,
  ct.phone_direct AS owner_phone,
  ct.cultural_affinity,
  c.enrichment_status,
  c.discovered_at
FROM companies c
LEFT JOIN contacts ct ON ct.company_id = c.id AND ct.is_owner = TRUE
WHERE c.enrichment_status != 'needs_review'
ORDER BY c.lead_score DESC;


-- ============================================================
-- 4. VERIFICATION QUERIES (run after the above succeeds)
-- ============================================================

-- Should return 6 rows
SELECT field_name, condition, value, points, label, active FROM scoring_rules;

-- Should return void (success)
SELECT calculate_lead_scores();

-- Should show companies with scores > 0
SELECT name, lead_score, estimated_size, has_website, has_online_booking, on_groupon
  FROM companies
  WHERE lead_score > 0
  ORDER BY lead_score DESC
  LIMIT 10;

-- Should show enriched leads with owner info
SELECT * FROM high_priority_leads LIMIT 5;
