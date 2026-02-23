# Progressive Source Rollout — Handoff Document

**Date:** 2026-02-22 (Session 63), updated 2026-02-23 (Session 65)
**Branch:** `enrichment-enhancement-v1`
**Status:** Phases 0-2 complete, Phase 2 bug fix (BUG-045), Phase 3 debug logging ready, Phases 3-4 testing remaining

---

## Summary

The Enrichment Enhancement v1 (ADR-035) added 4 new contact-finding sources to `find-contacts.js`. Each source was deployed with `SKIP=true` and is being enabled one at a time ("progressive rollout") against Sedona AZ as a test metro.

## Completed Phases

### Phase 0: Baseline (Exec #289)
- **All 4 new sources SKIP=true** — establishes baseline contact counts
- **Result:** 13 contacts found (all from existing sources: solo detection, Apollo, website scrape)
- **No errors** — confirms deployment didn't break existing functionality

### Phase 1: Hunter Domain Search (Exec #295)
- **Config:** `SKIP_HUNTER_DOMAIN_SEARCH = false`
- **Result:** 41 domains searched, 3 contacts found (7.3% hit rate)
- **Zero errors** — Hunter API worked cleanly
- **Notes:** Low hit rate expected for massage therapy vertical (small businesses, personal domains)

### Phase 2: Google Reviews (Exec #313)
- **Config:** `SKIP_GOOGLE_REVIEWS = false`
- **Result:** 41 places searched, 0 contacts found
- **Zero errors** — API calls succeeded, just no matches
- **Notes:** 0% hit rate is legitimate for Sedona AZ:
  - Method 1 (profile name ≠ company name) requires the Google profile to show a person's name
  - Method 2 (review sign-offs) requires owner responses to reviews with sign-off patterns
  - Sedona's spa businesses may not have personalized Google profiles or review responses
  - Need to test on a larger metro (e.g., Tampa, Nashville) for meaningful hit rate data

### Major Fix During Phase 2: Google Reviews API Migration (ADR-036)
- **Problem:** Original code used legacy Places API (`maps.googleapis.com/maps/api/place/details/json`) which doesn't expose review owner responses in a structured way
- **Fix:** Rewrote to **New Places API v1** (`places.googleapis.com/v1/places/{placeId}`) with header-based auth:
  - `X-Goog-Api-Key` header (instead of query param)
  - `X-Goog-FieldMask: displayName,reviews` header
  - Response uses `displayName.text` and `review.ownerResponse.text` (structured fields)
- **Lines changed:** 666-738 in `find-contacts.js`
- **Debug logging added:** First API response per batch logged for verification

## Remaining Phases

### Phase 2 Bug Fix: BUG-045 — Google Reviews Method 2 Dead Code (Session 65)
- **Finding:** The Places API v1 Review object has NO `ownerResponse` field. Method 2 (sign-off parsing from `review.ownerResponse`) was dead code since ADR-036.
- **Fix:** Method 2 removed entirely. Enhanced debug logging added (first review keys + JSON snippet).
- **Method 1 still active** but has low yield — requires Google profile name to differ from company name AND look like a person's name.

### Phase 3 Prep: Yelp Owner Debug Logging + yelp_is_claimed (Session 65)
- **Debug logging added:** First Yelp response (HTML length, content checks), per-company claimed status logging
- **yelp_is_claimed PATCH added:** Detects claimed status from HTML, PATCHes companies table (non-blocking)
- **SQL migration required:** `ALTER TABLE companies ADD COLUMN IF NOT EXISTS yelp_is_claimed BOOLEAN DEFAULT NULL;`

### Phase 3: Yelp Owner (Next)
- **Config change:** `SKIP_YELP_OWNER = true` → `false` (line 30)
- **Pre-requisites:** Run yelp_is_claimed SQL migration, deploy updated find-contacts.js
- **Expected behavior:** Scrapes Yelp business pages for owner name from "About the Business" section
- **Expected hit rate:** Unknown — debug logging will reveal if Yelp returns real content or blocks
- **Rate limiting:** 3s delay between requests (built in)
- **Extraction patterns:** "Business Owner" label, "Meet the Owner" section, JSON-LD structured data
- **What to check in execution logs:**
  - `Yelp HTML length:` — if <1000 chars, likely blocked
  - `Yelp content check: hasAboutBusiness=...` — if false for all, Yelp may not serve this section
  - `Yelp no owner for X: claimed=true/false` — shows claimed ratio

### Phase 4: Facebook Page (Last)
- **Config change:** `SKIP_FACEBOOK = true` → `false` (line 31)
- **Expected behavior:** Fetches public Facebook page HTML, extracts email addresses
- **Expected hit rate:** ~10-20% email extraction rate
- **Risk:** Facebook login walls may block requests. Monitor for high error rates.
- **Rate limiting:** 2s delay between requests (built in)

## Deployment Process

**Important:** The `N8N_API_KEY` environment variable is NOT available in the bash shell — it's injected directly into the MCP process by Claude Code. This means:

1. `scripts/deploy-find-contacts.py` **cannot be run from CLI** (`python deploy-find-contacts.py` fails with missing env var)
2. MCP `n8n_update_partial_workflow` also fails with ~45KB jsCode (known pitfall — node name parses as empty string)
3. **Working deployment process:**
   - Edit `scripts/nodes/find-contacts.js` locally
   - User copies the full file content
   - User pastes into n8n editor → Find Contacts node → Code field
   - User clicks Save, then Publish/Activate

## Verification Process

Each phase follows this pattern:
1. Edit SKIP flag in local file
2. User deploys via manual paste into n8n editor
3. Trigger Sedona AZ pipeline run (from dashboard or webhook)
4. Wait for all sub-workflow batches to complete
5. Check execution results — look at batch-level counters in Run Summary
6. Compare contact counts/sources to Phase 0 baseline

## Open Questions

1. **Method 1 effectiveness for Google Reviews:** Does the "profile name ≠ company name" heuristic work for larger metros? Sedona had 0 hits but may not be representative. Test on Tampa or Nashville.
2. **Debug log output:** Session 63 added `console.log` for the first Google Reviews API response per batch. Check n8n execution logs for the debug line: `Google Reviews API check: profileName="...", reviews=N, keys=...`
3. **Yelp HTML stability:** The Yelp scraping patterns ("Business Owner" label, "Meet the Owner", JSON-LD) were written against current Yelp HTML. If Yelp changes their layout, these regex patterns will silently return 0 results.
4. **Facebook login walls:** Unknown how often Facebook blocks unauthenticated page fetches for business pages. If >50% of requests get blocked, may need to skip this source.

## Key Files

| File | Description |
|------|-------------|
| `scripts/nodes/find-contacts.js` | Main code (932 lines), SKIP flags at lines 28-31 |
| `scripts/supabase/enrichment-sources-migration.sql` | SQL migration (run before enabling sources) |
| `projects/enrichment-enhancement-v1/Contact_Enrichment_Sources_Outline.md` | Original design doc |
| `docs/decisions/DECISIONS.md` | ADR-035 (4 sources), ADR-036 (Google API fix), ADR-037 (yelp_is_claimed + debug logging) |

## Phase Results Summary

| Phase | Source | Searched | Found | Hit Rate | Errors |
|-------|--------|----------|-------|----------|--------|
| 0 | Baseline (all skip) | — | 13 total contacts | — | 0 |
| 1 | Hunter Domain Search | 41 | 3 | 7.3% | 0 |
| 2 | Google Reviews | 41 | 0 | 0% | 0 |
| 3 | Yelp Owner | — | — | — | — |
| 4 | Facebook Page | — | — | — | — |
