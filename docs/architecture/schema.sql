-- ============================================================
-- Spa Marketing Waterfall - Supabase Schema
-- Run this in Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text matching
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- For UUID generation

-- ============================================================
-- 1. COMPANIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core identity
  name TEXT NOT NULL,
  phone TEXT,                          -- E.164 format, primary dedup key
  domain TEXT,                         -- Secondary dedup key
  address TEXT,
  city TEXT,
  state TEXT,                          -- State/province code
  country TEXT DEFAULT 'US',
  google_place_id TEXT,                -- Stable Google Maps ID
  
  -- Classification
  category TEXT,                       -- massage, RMT, spa, wellness, etc.
  estimated_size TEXT                  -- solo / small / medium
    CHECK (estimated_size IN ('solo', 'small', 'medium', NULL)),
  
  -- Company email (from website scraping + role-based routing)
  email TEXT,                          -- Best company-level email (info@, contact@, etc.)
  email_status TEXT                    -- Verification status
    CHECK (email_status IN ('unverified', 'verified', 'invalid', 'risky', 'accept_all')),

  -- Phone verification (Level 2: Telnyx Number Lookup)
  phone_status TEXT                    -- NULL = never verified or no phone
    CHECK (phone_status IN ('valid', 'invalid', 'disconnected', 'voip')),
  phone_line_type TEXT
    CHECK (phone_line_type IN ('mobile', 'landline', 'voip', 'toll_free')),

  -- Digital presence signals
  has_website BOOLEAN DEFAULT FALSE,
  has_online_booking BOOLEAN DEFAULT FALSE,
  booking_platform TEXT,               -- jane_app, acuity, mindbody, square, vagaro
  has_paid_ads BOOLEAN DEFAULT FALSE,
  
  -- Listing presence
  on_groupon BOOLEAN DEFAULT FALSE,
  on_yelp BOOLEAN DEFAULT FALSE,
  
  -- Review metrics
  google_review_count INTEGER DEFAULT 0,
  google_rating DECIMAL(2,1),
  
  -- Source tracking
  source_urls JSONB DEFAULT '[]'::jsonb,  -- [{source, url, query_used}]
  discovery_metro TEXT,                    -- Metro area that discovered this company (e.g., "Austin, TX")

  -- Pipeline status
  enrichment_status TEXT DEFAULT 'discovered'
    CHECK (enrichment_status IN ('discovered', 'partially_enriched', 'fully_enriched', 'needs_review')),
  lead_score INTEGER DEFAULT 0,
  
  -- Timestamps
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dedup and querying
-- NOTE: domain and phone are NOT unique — franchise chains (Massage Envy, The Now, Elements)
-- share domains and sometimes phone numbers across locations. google_place_id is the only
-- truly unique identifier per location and is the upsert conflict key.
CREATE INDEX IF NOT EXISTS idx_companies_phone ON companies (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies (domain) WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_google_place_id ON companies (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_city_state ON companies (city, state);
CREATE INDEX IF NOT EXISTS idx_companies_enrichment_status ON companies (enrichment_status);
CREATE INDEX IF NOT EXISTS idx_companies_lead_score ON companies (lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 2. CONTACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identity
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'unknown'
    CHECK (role IN ('owner', 'practitioner', 'manager', 'unknown')),
  is_owner BOOLEAN DEFAULT FALSE,
  
  -- Contact info
  email_business TEXT,
  email_personal TEXT,
  phone_direct TEXT,
  linkedin_url TEXT,
  location TEXT,
  
  -- Phone verification (Level 2: Telnyx Number Lookup)
  phone_status TEXT                    -- NULL = never verified or no phone
    CHECK (phone_status IN ('valid', 'invalid', 'disconnected', 'voip')),
  phone_verified_at TIMESTAMPTZ,
  phone_line_type TEXT
    CHECK (phone_line_type IN ('mobile', 'landline', 'voip', 'toll_free')),
  phone_carrier TEXT,

  -- Personalization
  cultural_affinity TEXT,              -- From NamSor API

  -- Metadata
  source TEXT                          -- apollo / solo_detection / website / google / manual / import
    CHECK (source IN ('apollo', 'solo_detection', 'website', 'google', 'manual', 'import', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_is_owner ON contacts (is_owner) WHERE is_owner = TRUE;
CREATE INDEX IF NOT EXISTS idx_contacts_phone_status ON contacts (phone_status)
  WHERE phone_direct IS NOT NULL AND phone_status IS NULL;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 3. SOCIAL PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS social_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  platform TEXT NOT NULL
    CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'x', 'linkedin', 'youtube')),
  profile_url TEXT NOT NULL,
  follower_count INTEGER,
  post_count INTEGER,
  last_post_date DATE,                 -- Key activity signal
  
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, platform)         -- One profile per platform per company
);

CREATE INDEX IF NOT EXISTS idx_social_profiles_company_id ON social_profiles (company_id);


-- ============================================================
-- 4. SCORING RULES TABLE
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

-- Insert starter scoring rules
INSERT INTO scoring_rules (field_name, condition, value, points, label) VALUES
  ('on_groupon', 'equals', 'true', 15, 'On Groupon - price-sensitive, seeking clients'),
  ('has_website', 'equals', 'false', 10, 'No website - needs digital help'),
  ('has_online_booking', 'equals', 'false', 10, 'No online booking - missing key tool'),
  ('estimated_size', 'equals', 'solo', 20, 'Solo practitioner - sweet spot'),
  ('has_paid_ads', 'equals', 'true', 5, 'Runs paid ads - already spending on marketing'),
  ('google_review_count', 'less_than', '20', 5, 'Low review count - room to grow');


-- ============================================================
-- 5. SCORING FUNCTION
-- ============================================================
-- Call this after enrichment or when scoring rules change
CREATE OR REPLACE FUNCTION calculate_lead_scores()
RETURNS void AS $$
DECLARE
  rule RECORD;
  sql_text TEXT;
BEGIN
  -- Reset all scores to 0 (WHERE TRUE required by Supabase PostgREST)
  UPDATE companies SET lead_score = 0 WHERE TRUE;
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6. DISCOVERY RUNS TABLE (for tracking/monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS discovery_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metro_name TEXT NOT NULL,
  sources_used TEXT[] DEFAULT '{}',
  total_discovered INTEGER DEFAULT 0,
  new_records INTEGER DEFAULT 0,
  duplicates_merged INTEGER DEFAULT 0,
  flagged_for_review INTEGER DEFAULT 0,
  run_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 7. USEFUL VIEWS
-- ============================================================

-- High-priority leads: scored, enriched, with owner contact
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

-- Records needing manual review (fuzzy matches)
CREATE OR REPLACE VIEW needs_review AS
SELECT 
  id,
  name,
  phone,
  domain,
  address,
  city,
  state,
  source_urls,
  discovered_at
FROM companies
WHERE enrichment_status = 'needs_review'
ORDER BY discovered_at DESC;

-- Net new discoveries (last 7 days)
CREATE OR REPLACE VIEW recent_discoveries AS
SELECT *
FROM companies
WHERE discovered_at > NOW() - INTERVAL '7 days'
ORDER BY discovered_at DESC;


-- ============================================================
-- 8. ROW LEVEL SECURITY (basic setup)
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_runs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (tighten later if needed)
CREATE POLICY "Authenticated users can read companies" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert companies" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update companies" ON companies FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read contacts" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contacts" ON contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contacts" ON contacts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read social_profiles" ON social_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert social_profiles" ON social_profiles FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can manage scoring_rules" ON scoring_rules FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read discovery_runs" ON discovery_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert discovery_runs" ON discovery_runs FOR INSERT TO authenticated WITH CHECK (true);

-- Service role (for n8n API calls) bypasses RLS automatically
-- Make sure n8n uses the service_role key, not anon key, for writes
