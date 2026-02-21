# Task List

## Priority: CRITICAL (Must fix before production)

- [x] **Fix Step 4 multi-path convergence** — Fixed via ADR-007: single Code node replaces 31-node pipeline (2026-02-17)
- [x] **Fix $http is not defined** — Replaced with `this.helpers.httpRequest()` (2026-02-18, BUG-F005)
- [x] **Fix 4x duplicate Step 4 execution** — Added static data dedup in Filter & Merge Contacts (2026-02-18, BUG-F007)
- [x] **Run all-skips-true test** — Passed: execution 100, 0 errors, 10 contacts processed (2026-02-18)
- [x] **Add contact deduplication** — Unique index + on_conflict ignore-duplicates. Verified in exec 117: 0 new contacts, 0 errors. (2026-02-18, BUG-F014)
- [x] **Add company email column** — Added `email` + `email_status` columns to companies table. Website scraper populates, Step 4 routes role-based emails. (2026-02-18, Session 10)

## Priority: HIGH (Fix before scaling)

- [x] **Fix role-based email handling** — Layer 1 now keeps role-based emails (flagged as `_role_based_kept`). Step 4 routes to company.email if company has no email. (2026-02-18, Session 10)
- [x] **Fix booking platform domains** — 20-platform blocklist added to all 3 domain extraction nodes. SQL remediation complete. (2026-02-18, BUG-F013)
- [x] **Fix metro-scoped pipeline execution (BUG-017)** — Added `discovery_metro` filter to Fetch Companies, Fetch Companies1, and Filter & Merge Contacts. Denver run now processes only Denver data. (2026-02-19, Session 17, BUG-F017)
- [x] **Improve about page scraping (BUG-018)** — Parse About Page now tries 6 URL paths instead of just /about. (2026-02-19, Session 17, BUG-F018)
- [x] **Enable Google Details** — Flipped `skip_google_details` from "true" to "false". (2026-02-19, Session 17)
- [ ] **Integrate pipeline with dashboard** — Trigger runs, view enrichment results, and manage metros from the React dashboard UI. Prerequisite: user must clean up `dashboard/` folder and upload new guide document first. See `docs/HANDOFF-dashboard-integration.md`.
- [ ] **Add email-domain mismatch detection (ISSUE-012)** — 4 contacts have emails not matching company domain (college email, scheduling platform, different brand). Need cross-check in Enrich Contacts.
- [x] **Add business type filtering** — 10-keyword blocklist added to Normalize Google + Yelp Results. Filters schools, associations, etc. before Supabase insert. (2026-02-19, Session 16)
- [x] **Phone length validation** — validatePhone() now rejects NA numbers > 11 digits, allows international up to 15 (ITU max). (2026-02-19, Session 16, BUG-006 CLOSED)
- [x] **Enable NamSor** — Passed: execution 102, cultural_affinity populated (2026-02-18)
- [x] **Enable Hunter Verifier** — Passed: execution 103, email_status → verified (2026-02-18)
- [x] **Enable Hunter Finder** — Passed: execution 104, 0 errors, no eligible contacts in batch (2026-02-18)
- [ ] **Enable Snov.io** — Blocked: no API key/account yet
- [x] **Scale to batch_size=100** — All 4 nodes updated: Google Places 10→20, Yelp 5→20, Step 3a 50→100, Step 4 5→100 (2026-02-17)
- [x] **Enable Apollo** — Enabled in exec 109: 36 searched, 8 contacts created (2026-02-18)
- [x] **Run follow-up exec to enrich Apollo contacts** — Completed in exec 111: all 8 Apollo contacts enriched (2026-02-18)
- [x] **Convergence batch suppression (ADR-024)** — Collapse to Single1/2 now fire once per execution. Per-contact dedup in Enrich Contacts. Exec #154 first clean success. (2026-02-20, Session 30)
- [x] **Step 1→2 timing fix (ADR-025)** — Stabilization polling in Collapse to Single2 waits for all Step 1 inserts before triggering Step 2. Fixes Yelp companies stuck in 'discovered'. Exec #155 verified. (2026-02-20, Session 31)
- [x] **Step 2→3 timing fix (ADR-026)** — Stabilization polling in Collapse to Single1 waits for Step 2 to finish enriching ALL companies before triggering Step 3a. Fixes new cities only seeing ~5% of companies. Portland OR test pending. (2026-02-20, Session 33)
- [x] **Pipeline Simplification (ADR-027)** — Collapsed Steps 2, 3a, 3b into 2 Code nodes. 127 → 27 nodes. Deployed 2026-02-20, Session 34.
- [x] **Parallelized Batch Enrichment (ADR-029)** — Split into main workflow (22 nodes) + sub-workflow (6 nodes). Batches of 25 companies dispatched in parallel. Deployed 2026-02-20, Session 36.
- [x] **Set `BATCH_ENRICHMENT_WEBHOOK_URL` in Coolify** — Set by user. Value: `http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/batch-enrichment-v1` (2026-02-20)
- [x] **Fix webhook body unwrapping (BUG-033)** — Added `payload = inputData.body || inputData` unwrap to all 3 sub-workflow Code nodes. Pre-flight fix before first test. (2026-02-20, Session 37)
- [x] **Test parallelized pipeline** — Sedona AZ exec #170: 128 companies, 8 batches dispatched in 32s, all sub-workflows succeeded, lead scoring SUCCESS. (2026-02-20, Session 38)
- [x] **Pipeline recovery: Fix zero digital signals (ADR-031)** — Fixed 5 issues: Insert node field drops, nonexistent PATCH columns, early-exit propagation. Verified in exec #179: 0 update errors, booking platforms detected, metro propagation working. (2026-02-20, Session 42)
- [ ] **Backfill `on_yelp` for existing companies** — SQL provided: `UPDATE companies SET on_yelp = true WHERE source_urls::text LIKE '%yelp_apify%' AND (on_yelp IS NULL OR on_yelp = false);`
- [x] **Re-run a metro to populate newly-saved fields** — Sedona AZ exec #180: 125 companies re-discovered, 153 re-enriched across 7 batches, digital signals now populated (booking platforms, paid ads, Google ratings). (2026-02-20, Session 43)
- [ ] **Investigate NamSor API failure (BUG-040)** — NamSor returning null for ALL contacts (including full-name). Check API key validity, test direct API call, check NamSor account dashboard. Code fix (IMP-014) is correct — this is an API-level issue.
- [ ] **Investigate 27.5% Enrich Companies update_errors** — 89 errors in 324 companies across Nashville #227 (up from ~13% in Sedona #180). Down from ~50-70% pre-fix but worsening again. Need to check Supabase error responses.
- [x] **Add Scottsdale, AZ metro** — 11th metro. Exec #189: 196 unique companies, 8 batches, 7/7 sub-workflows SUCCESS. (2026-02-20, Session 44)
- [ ] **Re-run Portland, OR** — After successful test with new architecture.
- [ ] **Re-run Asheville, NC** — Exec #165 timed out at 300s pre-fix. Should work now with 1800s timeout + convergence fix.
- [ ] **Clean Portland stale data** — Delete companies, contacts, and social_profiles for `discovery_metro = 'Portland, OR'` from failed execs #158/#159. Run in Supabase SQL Editor.
- [ ] **End-to-end email test** — Need contacts with first_name + domain but no email to truly test Hunter Finder discovery
- [x] **Update contacts.source CHECK** — Added 'solo_detection' + 'import' to constraint, schema docs updated. SQL executed and verified live. (2026-02-18, BUG-F015)
- [x] **Clean up blocked domains in Supabase** — Cleared booking platform domains from existing companies (20 platforms). (2026-02-18, BUG-F013 remediation)

## Priority: MEDIUM (Quality improvements)

- [x] **Enable Telnyx phone verification** — Tested with batch_size=10 (exec 129): 9 phones verified, all valid, 0 errors. Config restored to production (batch_size=100, phone_verifier enabled). (2026-02-19, Session 21)
- [x] **Fix company phone verification (BUG-F019)** — Stale `$getWorkflowStaticData` keys blocked company phone verification across executions. Fixed by clearing all keys at start of each execution. Verified in exec 131: 8 company phones verified. (2026-02-19, Session 22)
- [ ] **Social profile URL validation** — Validate platform domain matches (instagram.com, etc.)
- [ ] **Domain validation** — Check company domains aren't IPs or social media sites
- [x] **Verify company emails** — Company emails now verified via Hunter Verifier in Step 4 Enrich Contacts (2026-02-18, Session 10)
- [ ] **Personal email verification** — Some contacts have email_personal but no email_business
- [ ] **Improve solo_detection name extraction** — 15 of 22 solo contacts have no name; limits NamSor and Hunter Finder enrichment
- [x] **Data inspection: add new metros** — Phoenix, AZ fully operational (exec 139). Denver, Austin, Toronto also live. (2026-02-19, Session 24, BUG-F020)
- [x] **Apollo rate limit handling** — Fixed: Apollo People Search now batches 3 contacts at a time with 2s delay. Verified in San Diego (#141) and Boise (#146). (2026-02-19, Session 26)
- [ ] **Choose search size** — There currently isn't a way for the user to decide the search size; need to add ability to decide in config/dashboard
- [x] **Dynamic Metro Config** — Replaced static Set node with Code node that reads metro_name from webhook query parameter. No more manual config changes. (2026-02-19, Session 25, ADR-017)
- [x] **Re-run Boise after SQL reset** — SQL reset done, exec #242 SUCCESS: 165 companies, 7 batches, 7/7 sub-workflows succeeded. (2026-02-20, Session 48)
- [ ] **Investigate Apify memory limits** — Boise exec #143 failed due to Yelp actor memory. May need to reduce searchLimit for larger metros or split into sub-batches

## Completed (Session 19)

- [x] **Outreach CSV export** — Created `exports/outreach-ready.sql` for Supabase SQL Editor export. Deleted temp n8n workflow. (2026-02-18, Session 19)

## Priority: LOW (Future enhancements)

- [ ] **Search query generator** — Multiple terms per metro for 1000+ businesses
- [ ] **API credit budgeting** — Track/limit per-metro API spend
- [x] **Step 5: Lead scoring** — Supabase RPC function + n8n integration. 6 scoring rules, idempotent recalculation. (2026-02-19, Session 15)
- [ ] **Rate limiting dashboard** — Monitor API usage across all services

## Investigation Phases

- [x] **Phase 1: Node Inventory** — `docs/investigation/phase1-node-inventory.md` (151 nodes, 6,973 lines)
- [x] **Phase 2: Connection Map** — `docs/investigation/phase2-connection-map.md` (180 edges, 19 convergence points, 1,486 lines)
- [x] **Phase 3: Code Audit** — `docs/investigation/phase3-code-audit.md` (72 nodes, 6 CRITICAL, 22 HIGH)
- [x] **Phase 4: Issue Registry** — `docs/investigation/phase4-issue-registry.md` (15 issues)
- [x] **Phase 5: Fix Plan** — `docs/investigation/phase5-fix-plan.md`
- [x] **Phase 6: Pre-Generation Review** — `docs/investigation/phase6-review.md` (5 dry-runs passed)
- [x] **Phase 7: Generate Fixed Workflow** — `workflows/generated/spa-waterfall-fixed.json` (122 nodes, 0 Step 4 convergence)

## Completed

- [x] Layer 1 validation nodes (5 copies in Step 3a)
- [x] Schema migration (email_status, email_verified_at)
- [x] Existing data cleanup (bad phones, LinkedIn normalization, credential last names)
- [x] Run Summary3 with validation metrics
- [x] Run Summary4 with verification metrics
- [x] Hunter Email Verifier node (code correct, routing broken)
- [x] NamSor integration (working)
- [x] Phase 2: Connection Map (2026-02-17)
- [x] Phases 3-7: Code Audit through Fixed Workflow (2026-02-17)
- [x] Phase 1: Node Inventory (2026-02-17)
