-- Migration: Add new contact sources for enrichment enhancement v1
-- Date: 2026-02-22
-- Context: Adding 4 new contact-finding sources to the Find Contacts waterfall:
--   hunter (Hunter.io Domain Search), google_reviews, facebook, yelp

-- Update contacts source CHECK constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_source_check
  CHECK (source IN (
    'apollo', 'solo_detection', 'website', 'google', 'manual', 'import', 'other',
    'hunter', 'google_reviews', 'facebook', 'yelp'
  ));

-- Backfill on_yelp for existing companies (deferred from Session 42)
UPDATE companies
SET on_yelp = true
WHERE source_urls::text LIKE '%yelp%'
  AND (on_yelp IS NULL OR on_yelp = false);
