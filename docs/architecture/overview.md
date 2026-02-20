# System Architecture

## Pipeline Overview

An automated lead discovery and enrichment pipeline for massage therapy clinics across US metro areas.

**Stack:** Hetzner VPS → Coolify → self-hosted n8n → Supabase (Postgres)

### Pipeline Steps

| Step | Name | Status | Description |
|------|------|--------|-------------|
| 1 | Discover Businesses | ✅ Working | Google Places + Apify/Yelp → companies table |
| 2 | Enrich Companies | ✅ Working | Website analysis, booking detection, social extraction |
| 3a | Find People | ✅ Working | Apollo, solo detection, website scrape → contacts table |
| 4 | Enrich People | ❌ Broken | Email finder, email verifier, NamSor → contacts updates |
| 5 | Scoring | 🔲 Future | Lead scoring based on enrichment data |

### What Works
- Steps 1-3a execute correctly end-to-end
- Layer 1 validation (format checking, role-based email rejection, phone E.164, name cleaning)
- Schema migrations (email_status, email_verified_at columns added)
- Individual API calls (Hunter, NamSor) work when tested in isolation

### What's Broken
- Step 4 multi-path convergence causes item duplication/loss (see n8n-patterns.md)
- Only 1 of 13 contacts gets verified due to batching bug
- Merge nodes and code-based collection both failed to fix the routing issue

## Supabase Access

All Supabase calls use HTTP Request nodes:
- Headers: `apikey: {service_key}` + `Authorization: Bearer {service_key}`
- Upserts: `Prefer: resolution=merge-duplicates`
- Updates: PATCH with `Prefer: return=minimal`
- Base URL: `$env.SUPABASE_URL/rest/v1/{table}`

## Environment Variables

```
SUPABASE_URL         - Supabase project URL
SUPABASE_SERVICE_KEY - Service role key (full access)
HUNTER_API_KEY       - Hunter.io API key (ends in 272e)
NAMSOR_API_KEY       - NamSor v2 API key
APOLLO_API_KEY       - Apollo.io API key
SNOVIO_ACCESS_TOKEN  - Snov.io (future, not yet configured)
```

## Current Data (Austin Test)

```
Companies: 58 discovered, 50+ enriched
Contacts: 47 total
  - 17 have email (all unverified except 1 verified)
  - 41 have phone
  - 22 have linkedin
  - 31 have cultural_affinity
  - Sources: 27 apollo, 18 solo_detection, 2 website
Hunter credits: ~48.5 of 50 remaining
```

## Schema Migrations Applied (not in base schema.sql)

```sql
-- Layer 2 additions
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'unverified'
    CHECK (email_status IN ('unverified', 'verified', 'invalid', 'risky', 'accept_all')),
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_email_status
  ON contacts (email_status)
  WHERE email_business IS NOT NULL;

-- Source constraint update (add solo_detection)
-- Note: may need to update the CHECK constraint on contacts.source
```

## Pending Schema Changes (Not Yet Applied)

```sql
-- Company email column
ALTER TABLE companies ADD COLUMN email TEXT;

-- Contact deduplication
ALTER TABLE contacts ADD CONSTRAINT unique_contact 
  UNIQUE NULLS NOT DISTINCT (company_id, first_name, last_name);
```
