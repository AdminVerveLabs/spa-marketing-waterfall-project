# Enrichment Enhancement v1 — Branch Handoff

**Branch:** `enrichment-enhancement-v1`
**Date range:** 2026-02-22 → 2026-02-23 (Sessions 62–69)
**Status:** Complete — ready to merge to master

---

## Overview

Extended `find-contacts.js` with 4 new contact-finding sources to improve the pipeline's contact discovery rate beyond Apollo + website scraping. The existing Find Contacts Code node grew from 630 → 931 lines. Each source was deployed behind a `SKIP_*` flag and enabled progressively ("progressive rollout") against Sedona AZ as a test metro.

**New sources added (waterfall order):**
1. Hunter Domain Search — find people/emails at a company domain
2. Google Reviews — extract owner name from Google Place profile
3. Yelp Owner — scrape owner name from Yelp business page
4. Facebook Page — extract email from public Facebook page HTML

**Current state:**
- Phases 1–3 ENABLED (Hunter, Google Reviews, Yelp Owner)
- Phase 4 DISABLED (Facebook — `SKIP_FACEBOOK = true`)

---

## Architecture (ADR-035)

**Decision:** Extend the existing `find-contacts.js` Code node rather than creating a separate workflow node or sub-workflow.

**Rationale:**
- Waterfall is inherently sequential per-company — each source runs only if the previous didn't find a contact
- Reuses existing validation logic (name validation, email filtering, role scoring)
- Single node prevents re-fetching companies/contacts from Supabase
- SKIP flags allow progressive rollout without redeployment

**Waterfall order in code:**
```
solo detection → Apollo search → Apollo enrich → website scrape →
  → Hunter Domain Search → Google Reviews → Yelp Owner → Facebook
```

**Source conditions (each runs only if prior sources didn't find a contact):**
| Source | Condition |
|--------|-----------|
| Hunter Domain Search | `domain` exists AND no contact with `first_name` |
| Google Reviews | `google_place_id` exists AND no contact with `first_name` |
| Yelp Owner | `source_urls` contains `yelp.com` AND no contact with `first_name` |
| Facebook Page | `facebook_url` in `social_profiles` AND no contact with `email_business` |

---

## Source Details

### 1. Hunter Domain Search (Phase 1)
- **API:** `https://api.hunter.io/v2/domain-search?domain={domain}&api_key={key}`
- **Config flag:** `SKIP_HUNTER_DOMAIN_SEARCH`
- **Rate limit:** 1 second between requests
- **What it does:** Queries Hunter.io for people associated with a domain. Filters for massage-relevant roles, validates names, scores emails.
- **Code location:** `find-contacts.js` lines 606–665
- **Current state:** ENABLED
- **Results:** 7.3% hit rate on Sedona (3 contacts from 41 domains)

### 2. Google Reviews (Phase 2)
- **API:** New Places API v1 — `https://places.googleapis.com/v1/places/{placeId}`
- **Auth:** Header-based (`X-Goog-Api-Key`, `X-Goog-FieldMask: displayName,reviews`)
- **Config flag:** `SKIP_GOOGLE_REVIEWS`
- **What it does:** Fetches Google Place profile. Method 1 compares `displayName.text` to company name — if the profile name looks like a person's name (validated against ~400 common first names), it's extracted as a contact.
- **Code location:** `find-contacts.js` lines 666–729
- **Current state:** ENABLED
- **Results:** 0% on Sedona (legitimate — small metro with few personalized profiles)
- **Note:** Method 2 (sign-off parsing from review responses) was removed — see BUG-045. The Places API v1 Review object does not have an `ownerResponse` field.
- **ADR-036:** Migrated from legacy Places API to New Places API v1 for structured `displayName` field.
- **ADR-038:** Relaxed Method 1 criteria — removed 3 overly-strict gates that blocked valid matches (e.g., "Jane Smith Massage" profile was rejected because it matched company name).

### 3. Yelp Owner (Phase 3)
- **API:** Direct HTTP fetch of Yelp business page HTML
- **Config flag:** `SKIP_YELP_OWNER`
- **Rate limit:** 3 seconds between requests
- **What it does:** Fetches Yelp business page, parses HTML for owner name from "About the Business" section. Also detects `yelp_is_claimed` status and PATCHes it to the companies table.
- **Code location:** `find-contacts.js` lines 730–849
- **Current state:** ENABLED
- **Results:** Debug logging deployed, awaiting analysis of next run output
- **ADR-037:** Added `yelp_is_claimed` column and comprehensive debug logging

### 4. Facebook Page (Phase 4)
- **API:** Direct HTTP fetch of public Facebook page HTML
- **Config flag:** `SKIP_FACEBOOK`
- **Rate limit:** 2 seconds between requests
- **What it does:** Fetches Facebook page HTML, extracts email addresses via regex. Does NOT require Facebook API credentials — works on public page HTML.
- **Code location:** `find-contacts.js` lines 850–900
- **Current state:** DISABLED (`SKIP_FACEBOOK = true`)
- **Results:** Not yet tested

---

## Progressive Rollout Results

| Phase | Source | Exec | Companies | Contacts Found | Hit Rate | Errors |
|-------|--------|------|-----------|----------------|----------|--------|
| 0 (Baseline) | All new SKIP=true | #289 | — | 13 (existing sources) | — | 0 |
| 1 | Hunter Domain Search | #295 | 41 domains | 3 | 7.3% | 0 |
| 2 | Google Reviews | #313 | 41 places | 0 | 0% | 0 |
| 3 | Yelp Owner | #343 | — | — | Pending analysis | 0 |
| 4 | Facebook | — | — | — | Not tested | — |

**Note:** Sedona AZ (test metro) is a small market. Hit rates will likely be higher on larger metros like Tampa, Nashville, or Austin.

---

## Schema Changes

### SQL Migration (executed Session 63)
**File:** `scripts/supabase/enrichment-sources-migration.sql`

```sql
-- Update contacts source CHECK to include new sources
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_source_check
  CHECK (source IN (
    'apollo', 'solo_detection', 'website', 'google', 'manual', 'import', 'other',
    'hunter', 'google_reviews', 'facebook', 'yelp'
  ));

-- Backfill on_yelp for existing companies with Yelp URLs
UPDATE companies
SET on_yelp = true
WHERE source_urls::text LIKE '%yelp%'
  AND (on_yelp IS NULL OR on_yelp = false);
```

### Pending SQL (ADR-037)
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS yelp_is_claimed BOOLEAN DEFAULT NULL;
```
This migration has NOT been executed yet. The code handles its absence gracefully (non-blocking PATCH).

---

## Bugs Found & Fixed

### BUG-045: Google Reviews Method 2 Dead Code (FIXED)
- **Severity:** MEDIUM
- **Problem:** Places API v1 Review object does NOT have `ownerResponse` field. Method 2 (sign-off parsing) was dead code since ADR-036.
- **Fix:** Removed Method 2 entirely. Added debug logging to verify API response fields.

### BUG-046: Sub-workflow Webhook Deregistration (FIXED)
- **Severity:** HIGH
- **Problem:** Saving the sub-workflow in n8n editor triggers deactivate → save → reactivate. Webhook re-registration silently failed, causing "User attempted to access workflow without permission" errors on all batch dispatches.
- **Fix:** Toggle sub-workflow off/on via API to force webhook re-registration.
- **Gotcha:** This will recur any time the sub-workflow is saved in the n8n editor while active.

### BUG-047: Apify Monthly Usage Hard Limit (FIXED)
- **Severity:** HIGH
- **Problem:** Apify account hit monthly usage hard limit, returning 403 on all actor start requests.
- **Fix:** User increased Apify monthly hard limit. Verified with successful Sedona exec #343.

---

## ADRs Created

| ADR | Title | Summary |
|-----|-------|---------|
| ADR-035 | Add 4 New Contact-Finding Sources | Architecture: extend find-contacts.js, waterfall order, SKIP flags, progressive rollout |
| ADR-036 | Google Reviews API Migration | Legacy Places API → New Places API v1 for structured displayName field |
| ADR-037 | Add yelp_is_claimed + Debug Logging | New column, enhanced debug logging for Google Reviews and Yelp Owner |
| ADR-038 | Relax Google Reviews Method 1 | Removed 3 overly-strict gates, added business suffixes, kept safety via isLikelyFirstName() |

---

## Key Files

| File | Description |
|------|-------------|
| `scripts/nodes/find-contacts.js` | Main code — 931 lines, all 4 new sources |
| `scripts/supabase/enrichment-sources-migration.sql` | SQL migration for contacts source CHECK + on_yelp backfill |
| `scripts/deploy-find-contacts.py` | Deploy script (doesn't work from CLI — see Gotchas) |
| `docs/decisions/DECISIONS.md` | ADR-035, ADR-036, ADR-037, ADR-038 |
| `projects/enrichment-enhancement-v1/progressive-rollout-handoff.md` | Phase-by-phase rollout results |
| `projects/enrichment-enhancement-v1/Contact_Enrichment_Sources_Outline.md` | Original research/outline |

---

## Pending Work

1. **Facebook Phase 4** — Enable `SKIP_FACEBOOK = false`, test on Sedona, analyze results
2. **`yelp_is_claimed` SQL migration** — Execute `ALTER TABLE companies ADD COLUMN IF NOT EXISTS yelp_is_claimed BOOLEAN DEFAULT NULL;` in Supabase
3. **Larger metro validation** — Run enrichment on Tampa or Nashville to get meaningful hit rates (Sedona is too small to validate Google Reviews and Yelp Owner)
4. **Yelp Owner HTML analysis** — Review debug logging output from next run to confirm HTML parsing works
5. **Google Reviews on bigger metro** — Method 1 (relaxed per ADR-038) needs a larger sample size

---

## Gotchas

1. **Deploy process for find-contacts.js:** The file is ~45KB (931 lines). MCP `n8n_update_partial_workflow` fails with large jsCode. The `deploy-find-contacts.py` script can't run from CLI because `N8N_API_KEY` is only available in the MCP process. **Working method:** Edit the local file, then manually paste the full content into the n8n editor Code node and save.

2. **n8n editor save breaks webhooks (BUG-046):** Saving an active workflow in the n8n editor can silently break webhook registration. After any editor save, toggle the workflow off/on via API to re-register webhooks.

3. **Places API v1 has no `ownerResponse`:** Despite documentation suggestions, the Google Places API v1 Review object does not include owner responses. Only Method 1 (profile name extraction) works.

4. **Rate limits matter:** Hunter (1s), Yelp (3s), Facebook (2s) delays are intentional. Removing them risks API blocks.

5. **SKIP flags are hardcoded in the Code node:** They're constants at the top of `find-contacts.js`, not n8n environment variables. Changing them requires redeploying the code.
