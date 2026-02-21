# Known Bugs

## Open

### BUG-017: Steps 3a/4 have no metro filter — cross-metro data contamination
- **Severity:** CRITICAL
- **Location:** Step 3a → Fetch Companies, Step 4 → Fetch Companies1, Filter & Merge Contacts
- **Symptom:** Denver pipeline run (exec 121) processed 37 Austin contacts in Step 4 instead of Denver ones. `has_updates = false` for all because Austin contacts were already enriched.
- **Root cause:** Three Supabase fetch nodes had no `discovery_metro` filter — they returned ALL companies/contacts globally.
- **Status:** FIXED — see BUG-F017 below

### BUG-018: Parse About Page only tries /about path
- **Severity:** HIGH
- **Location:** Step 3a → Parse About Page
- **Symptom:** Run Summary3 shows `website_names_found = 0` even for companies with team pages. Many businesses use /about-us, /about-me, /our-team, /team, /our-story instead of /about.
- **Status:** FIXED — see BUG-F018 below

### BUG-021: Enrichment gap — Step 2 misses partially_enriched companies
- **Severity:** HIGH
- **Location:** Step 2 → Fetch Batch from Supabase
- **Symptom:** Boise exec #146 discovered 174 companies but Step 2 only enriched 50. Prior failed runs (#143/#144) set some companies to `partially_enriched`, and the fetch filter `enrichment_status=eq.discovered` excluded them.
- **Root cause:** Fetch Batch only fetched `discovered` companies. Failed runs that crashed mid-enrichment left companies at `partially_enriched`, making them invisible to subsequent runs.
- **Status:** FIXED — see BUG-F021 below

### BUG-024: n8n Task Runner crash loop from stuck execution
- **Severity:** CRITICAL
- **Location:** n8n infrastructure (Task Runner / Bull queue)
- **Symptom:** After exec #147 (Austin TX) completed all 84 nodes but didn't finalize, the JS Task Runner entered a persistent crash-restart loop. Every ~10-15s: runner registers → receives stale tasks → tasks rejected ("Offer expired - not accepted within validity window") → runner crashes → restarts. Survives Coolify restarts.
- **Root cause:** Exec #147 completed all pipeline work but remained in `status: running` with `stoppedAt: null`. On restart, n8n tried to resume/dispatch remaining convergence batch tasks. The runner spun up, received these stale expired tasks, and crashed. The execution persisted across restarts, so the cycle repeated indefinitely.
- **Why #147 got stuck:** Run Summary1 has 7 upstream convergence paths. First batch completed the full 84-node pipeline. Secondary batches tried to dispatch through Bridge to 3b but the runner context was already corrupted/expired.
- **Fix:** User manually cancelled exec #147 from n8n UI. Execution moved to `status: canceled`, `stoppedAt` set. Runner re-registered cleanly. No more stale task dispatches.
- **Data impact:** None — all 84 nodes wrote to Supabase before the execution got stuck. Austin TX discovery (178 records), enrichment (34 contacts, 2 updated), and lead scoring all completed successfully.
- **Prevention:** This is a known pattern with n8n Task Runner + multi-path convergence workflows. May recur on any execution where secondary convergence batches fail to dispatch. Monitor for `stoppedAt: null` on executions that appear complete. Consider reducing convergence paths in Run Summary nodes.
- **Status:** FIXED (manually cancelled exec #147)

### BUG-026: Run Summary1 convergence causes systemic Task Runner crash loop
- **Severity:** CRITICAL
- **Location:** Step 2 → Run Summary1 (7 upstream convergence paths)
- **Symptom:** Every execution that reaches Run Summary1 gets stuck in `status: running` with `stoppedAt: null`, causing Task Runner crash-restart loop. Exec #147, #149 both affected. All data written to Supabase, but execution never finalizes.
- **Root cause:** 7 paths converge on Run Summary1 (Insert Social Profiles, Needs Social Discovery? FALSE, Discovery Queries Exist? FALSE, FB Matches Found? FALSE, Insert FB Social Profiles, IG Matches Found? FALSE, Insert IG Social Profiles). Each creates a separate execution batch. First batch completes the full pipeline; secondary batches dispatch stale tasks that the Task Runner can't handle.
- **Status:** FIXED — see BUG-F026 below

### BUG-025: Insert Flagged node crashes pipeline on phone uniqueness conflict
- **Severity:** HIGH
- **Location:** Step 1 → Insert Flagged (Needs Review)
- **Symptom:** Exec #148 (Austin TX) failed at `Insert Flagged (Needs Review)` with 409: `duplicate key value violates unique constraint "idx_companies_phone"` — Key (phone)=(+15129670624) already exists. Only 18 of 84 nodes executed before the error killed the pipeline.
- **Root cause:** `Insert Flagged` used `on_conflict=google_place_id` for merge-duplicates, but the conflict was on the `phone` column (a different unique index). A new company (by google_place_id) shared a phone number with an existing company.
- **Status:** FIXED — see BUG-F025 below

### BUG-027: Yelp companies stuck in 'discovered' after ADR-024 convergence suppression
- **Severity:** HIGH
- **Location:** Step 1 → Collapse to Single2 → Step 2
- **Symptom:** Austin TX has 219 companies but only 99 enriched — 119 stuck in `discovered` status and never processed by Step 2. Requires re-running the pipeline to catch missed companies.
- **Root cause:** After ADR-024, Collapse to Single2 fires on the first convergence batch (Google results, ~5s) and suppresses subsequent batches (Yelp results, 60-120s). `Merge All Sources` (typeVersion 3, Append mode) fires per-input, so Google results flow through first. By the time Yelp inserts complete, Collapse to Single2 has already fired and triggered Step 2, which only sees the Google-discovered companies.
- **Status:** FIXED — see BUG-F027 below

### BUG-028: Collapse to Single2 race condition — Insert to Supabase completes after polling
- **Severity:** CRITICAL
- **Location:** Step 1 → Collapse to Single2 → Step 2
- **Symptom:** Exec #156 (San Diego, CA) completed `status: success` but Steps 2-5 processed 0 companies. Discovery found 190 unique records, Insert to Supabase succeeded (170 companies in Supabase), but Fetch Batch returned 0.
- **Root cause:** Collapse to Single2's stabilization polling (ADR-025) found `_discovered_count: 0` because Insert to Supabase hadn't committed yet. Insert to Supabase was the LAST node in execution order (position 46/46) — n8n task runner scheduled it AFTER Collapse to Single2's polling loop due to contention. After 3 polls at 15s (45s total), count stabilized at 0. Step 2 started with 0 companies.
- **Why Austin TX worked:** Prior runs left companies at `discovered` status. On re-run, polling found those immediately (count = 118). San Diego hadn't been re-run since ADR-024/025, so all companies were `fully_enriched`.
- **Status:** FIXED — see BUG-F028 below

### BUG-029: Collapse to Single1 fires too early — Step 3a misses ~95% of companies for new cities
- **Severity:** CRITICAL
- **Location:** Step 2 → Collapse to Single1 → Step 3a
- **Symptom:** For a brand-new city (no prior data), Step 3a sees only ~5-10 of ~200 companies. ~95% of companies get no contact discovery. A second run is required to pick up the rest.
- **Root cause:** Collapse to Single1 has 7 input paths (all Step 2 exit points). With ADR-024 fire-once guard, it triggers on the FIRST company to exit Step 2. But Step 2 processes companies sequentially (~5s each), so ~200 companies take ~17 min. Step 3a's `Fetch Companies` queries `enrichment_status=in.(partially_enriched,fully_enriched)` and only sees the handful that finished Step 2 before the query.
- **Why existing metros worked:** Prior runs left companies at `partially_enriched`/`fully_enriched`, so Fetch Companies returned a full set regardless of Step 2 timing.
- **Status:** FIXED (ADR-026), then SUPERSEDED by ADR-027 (Session 34) — Collapse to Single1 removed entirely in pipeline simplification

### BUG-030: Companies domain/phone unique constraints block franchise chain inserts
- **Severity:** CRITICAL
- **Location:** Step 1 → Insert to Supabase
- **Symptom:** Portland OR exec #159 (simplified pipeline) failed with 409 errors: `duplicate key value violates unique constraint "idx_companies_domain"` for `thenowmassage.com`. Insert to Supabase has `onError: continueRegularOutput`, so 409s are swallowed silently → Collapse to Single2 polls for `discovered` companies, finds 0 → entire pipeline produces nothing.
- **Root cause:** `idx_companies_domain` and `idx_companies_phone` are UNIQUE indexes, but franchise chains (The Now Massage, Massage Envy, Elements Massage) have multiple locations sharing one domain/phone. The upsert uses `on_conflict=google_place_id`, so only google_place_id conflicts are handled. Domain/phone conflicts on different google_place_ids → unrecoverable 409.
- **Impact:** Portland OR execs #158 and #159 both likely affected. Very few Portland companies exist in DB. Also likely caused the Phoenix exec #139 409 on elementsmassage.com (noted in Session 24).
- **Status:** FIX PENDING — user needs to run SQL in Supabase (drop unique, recreate as non-unique). See BUG-F030 when done.

### BUG-031: First-run `_discovered_count: 0` — Collapse to Single2 convergence reference bug
- **Severity:** CRITICAL
- **Location:** Collapse to Single2 → `$('Metro Config').first().json.metro_name`
- **Symptom:** Nashville TN exec #160: Insert to Supabase succeeded (161 items, 0 errors), but Collapse to Single2 polled for 454s (30 iterations × 15s) and found 0 discovered companies. Steps 2-5 processed 0.
- **Root cause:** Collapse to Single2 is a convergence node (receives from both Insert to Supabase and Insert Flagged). The `$('Metro Config').first().json.metro_name` reference resolves incorrectly in the convergence batch context, possibly returning wrong data or encoding `Nashville, TN` differently.
- **Status:** FIXED — ADR-029 (Session 36). Batch Dispatcher reads metro from input items, not `$('Metro Config')`.

### BUG-032: Find Contacts only processed 27 of 161 companies
- **Severity:** HIGH
- **Location:** Find Contacts Code node
- **Symptom:** Nashville TN exec #161: Enrich Companies processed companies, but Find Contacts only found/processed 27 of 161.
- **Root cause:** Monolithic enrichment of 161 companies exceeded the 300s task runner hard cap. Enrich Companies PATCHed ~27 before timeout. Find Contacts' query only found those 27.
- **Status:** FIXED — ADR-029 (Session 36). Batches of 25 companies, each ~125-200s, safely under 300s cap.

### BUG-033: Webhook body unwrapping — sub-workflow Enrich Companies reads wrong fields
- **Severity:** CRITICAL
- **Location:** Sub-workflow → Enrich Companies, Find Contacts, Enrich Contacts (lines 9-11)
- **Symptom:** n8n Webhook v2 wraps POST body under `$json.body`. Enrich Companies reads `$input.first().json.metro` which is `undefined` because the actual data is at `$json.body.metro`. Throws `missing metro in input` immediately. Since sub-workflow already returned 200 (fire-and-forget), Batch Dispatcher thinks dispatch succeeded. Completion polling waits 15 min, then times out.
- **Root cause:** Webhook node (typeVersion 2) outputs `{ body: {...}, headers: {...}, params: {}, query: {} }`. Respond to Webhook passes this through unchanged. Code nodes expected flat `{ metro, company_ids }`.
- **Status:** FIXED — see BUG-F033 below

### BUG-034: Batch Dispatcher timeout at 300s — N8N_RUNNERS_TASK_TIMEOUT
- **Severity:** HIGH
- **Location:** Main workflow → Batch Dispatcher Code node
- **Symptom:** Asheville NC exec #165 — Batch Dispatcher timed out at exactly 300s (default `N8N_RUNNERS_TASK_TIMEOUT`).
- **Root cause:** Task runner timeout was still at default 300s. Batch Dispatcher's Phase 1 discovery polling (30 iterations × 15s = 450s max) plus Phase 4 completion polling easily exceeded 300s.
- **Status:** FIXED — see BUG-F034 below

### BUG-035: Convergence ordering — Insert Flagged fires Batch Dispatcher before Insert to Supabase
- **Severity:** HIGH
- **Location:** Main workflow → Insert Flagged → Batch Dispatcher connection
- **Symptom:** Sedona AZ exec #167 — Batch Dispatcher dispatched 0 batches after 438s of polling. Discovery found 128 companies, but Batch Dispatcher's Supabase poll returned 0 discovered companies throughout.
- **Root cause:** Both `Insert to Supabase` (127 items) and `Insert Flagged` (2 items) connected to Batch Dispatcher. Insert Flagged processes fewer items and completes first, triggering Batch Dispatcher. The ADR-024 convergence guard (`_batch_dispatcher_fired`) blocks the second trigger from Insert to Supabase. Since n8n serializes execution, Insert to Supabase doesn't run until AFTER Batch Dispatcher completes — so the companies are not yet in Supabase when Batch Dispatcher polls.
- **Status:** FIXED — see BUG-F035 below

### BUG-036: Insert to Supabase drops 8 fields — zero digital signals
- **Severity:** CRITICAL
- **Location:** Main workflow → Insert to Supabase, Insert Flagged (Needs Review)
- **Symptom:** Sedona diagnostic revealed ALL digital signals are zero: 0 booking, 0 ratings, 0 on_yelp/groupon, 0 paid ads. Fields computed by Normalize/Prepare nodes but dropped by Insert HTTP body.
- **Root cause:** Insert to Supabase HTTP body only included 14 of 22+ fields from Prepare for Supabase. Missing: `google_rating`, `google_review_count`, `has_online_booking`, `booking_platform`, `has_paid_ads`, `estimated_size`, `on_yelp`, `on_groupon`.
- **Status:** FIXED — see BUG-F036 below

### BUG-037: Enrich Companies PATCH includes nonexistent Supabase columns
- **Severity:** HIGH
- **Location:** Sub-workflow → Enrich Companies Code node
- **Symptom:** ~50-70% update_errors in sub-workflow executions. Companies left at `partially_enriched` instead of progressing.
- **Root cause:** PATCH payload included `opening_hours`, `business_status`, `photo_count`, `price_level` — columns that were never added to the companies table in Supabase. Google Details API returns these values but the schema doesn't have them.
- **Status:** FIXED — see BUG-F037 below

### BUG-038: Early-exit paths in enrichment Code nodes drop metro/company_ids
- **Severity:** HIGH
- **Location:** Sub-workflow → Enrich Companies, Find Contacts, Enrich Contacts (early-exit paths)
- **Symptom:** When Enrich Companies exits early (e.g., 0 companies found in Supabase), downstream Find Contacts fails with "missing metro in input" because the early-exit return was a bare `[]` without `metro` and `company_ids`.
- **Root cause:** 4 early-exit paths returned empty items without propagating the `metro` and `company_ids` fields needed by downstream nodes.
- **Status:** FIXED — see BUG-F038 below

### BUG-039: Double-trigger incidents — no pre-flight execution check
- **Severity:** MEDIUM (procedural)
- **Location:** Pipeline trigger process (human/AI operator error)
- **Symptom:** Pipeline triggered twice for the same metro because the first execution wasn't visible in the execution list yet. Sedona exec #181 (Apify memory exceeded from collision with #180's Apify runs) and Austin exec #212 (cancelled by user, but sub-workflow batches may have already dispatched).
- **Root cause:** After triggering via webhook, the n8n execution list API doesn't immediately show the new execution. Operator assumed the trigger failed and re-triggered. In both cases the first execution was still running.
- **Impact:** Wasted API credits, Apify memory collisions, confusing `partial_dispatch` results, cancelled executions
- **Prevention:** Added CLAUDE.md Rule 12: mandatory pre-flight check before any pipeline trigger. List recent executions, check for running/recent starts, never re-trigger if unsure.
- **Status:** PROCEDURAL FIX — Rule 12 added to CLAUDE.md

### BUG-040: NamSor API returning null for all contacts
- **Severity:** HIGH
- **Location:** Sub-workflow → Enrich Contacts → NamSor `/origin` API call
- **Symptom:** Nashville TN exec #227 — ALL contacts across ALL 13 sub-workflow batches have `_namsor_country: null` and `cultural_affinity: null`. This includes contacts with BOTH first AND last name (e.g., Melanie Joye, Laura Stendel), which should have high-confidence NamSor results.
- **Root cause:** NamSor API itself is failing silently. The try/catch on line 466 of `enrich-contacts.js` catches errors and logs to console, but the output only shows `_namsor_country: null`. Likely causes: (1) NamSor API key expired, (2) NamSor service outage, (3) rate limiting.
- **Evidence:** San Diego exec #213 also had 0 cultural_affinity across all batches (originally attributed to IMP-014, but same issue for full-name contacts). In early sessions (6-8), NamSor worked correctly (e.g., Jenny Rice → "Europe / Northern Europe / GB").
- **Distinction from IMP-014:** IMP-014 (guard too strict) is a separate code issue that was FIXED in Session 46. BUG-040 is an API-level failure affecting ALL contacts regardless of name completeness.
- **Investigation needed:** Check NamSor API key validity, test a direct API call, check NamSor account dashboard.
- **Status:** OPEN

### BUG-022: Apify Yelp actor memory limit exceeded
- **Severity:** MEDIUM
- **Location:** Step 1 → Start Apify Run (Yelp)
- **Symptom:** Boise exec #143 failed — Apify Yelp scraper ran out of memory with searchLimit=100 and 12 search queries
- **Note:** Apify account upgraded to 52GB (from 32GB). Boise's 12 queries × 4096MB = 49GB now fits within limits.
- **Status:** OPEN — needs verification with Boise re-run after SQL reset of stuck companies

### BUG-005: Email-domain mismatch not detected (ISSUE-012)
- **Severity:** MEDIUM
- **Location:** Step 4 → Enrich Contacts (or post-enrichment validation)
- **Symptom:** Apollo returns emails that don't match the company domain. These are low-quality or incorrect contacts.
- **Examples:**
  - Laura Candelaria: email `laura.candelaria@g.austincc.edu`, company domain `austindeep.com` (college email)
  - Felix: email `felix@schedulista.com`, company domain `riverstonemassagetherapy.schedulista.com` (platform email)
  - David Lauterstein: email `davidl@tlcschool.com`, company domain `tlcmassageschool.com` (different)
  - Kerry Coyle: email `kerrycoyle@thetox.com`, company domain `thetoxtechnique.com` (different brand)
- **Status:** OPEN — need email-domain cross-validation in Enrich Contacts or a post-processing step

### BUG-006: Invalid phone number length → FIXED as BUG-F016
- **Severity:** LOW
- **Status:** FIXED — see BUG-F016 below

## Fixed

### BUG-F029: Collapse to Single1 fires too early — Step 3a misses ~95% of new-city companies (BUG-029)
- **Fixed:** 2026-02-20 (Session 33), then superseded by ADR-027 (Session 34)
- **Severity:** CRITICAL
- **Root cause:** Collapse to Single1's ADR-024 fire-once guard triggered on the FIRST company to exit Step 2, starting Step 3a while Step 2 was still processing ~190 more companies. Step 3a's Fetch Companies only saw the few companies that had finished Step 2.
- **Fix (ADR-026):** Added stabilization polling — after the fire-once guard triggers, polls Supabase every 15s counting `enrichment_status=eq.discovered` companies for the current metro. When count reaches 0 and stays at 0 for 2 consecutive polls (30s), all companies have been enriched by Step 2. Max 80 iterations (20 min).
- **Deployed:** MCP `n8n_update_partial_workflow` — single updateNode on `Collapse to Single1`.
- **Superseded:** Session 34 pipeline simplification (ADR-027) removed Collapse to Single1 entirely. Enrich Companies and Find Contacts are now sequential Code nodes — no convergence, no timing issues.

### BUG-F021: Enrichment gap — Fetch Batch excludes partially_enriched companies (BUG-021)
- **Fixed:** 2026-02-19 (Session 26)
- **Severity:** HIGH
- **Root cause:** `Fetch Batch from Supabase` URL used `enrichment_status=eq.discovered`, which excluded companies from failed runs that were left at `partially_enriched` status. In Boise, 124 of 174 companies were stuck at `partially_enriched` after failed runs #143/#144.
- **Fix:** Changed URL filter from `enrichment_status=eq.discovered` to `enrichment_status=in.(discovered,partially_enriched)`. Also raised batch_size from 300 to 1000 in all 3 config nodes.
- **Deployed:** MCP `n8n_update_partial_workflow` — 4 atomic operations (3 config nodes + 1 HTTP Request node).
- **Pending verification:** Need SQL reset of stuck Boise companies + re-run to confirm all 174 are enriched.

### BUG-F016: Invalid phone number length (BUG-006)
- **Fixed:** 2026-02-19 (Session 16)
- **Severity:** LOW
- **Root cause:** `validatePhone()` in Enrich Contacts had a permissive `else if (cleaned.length > 11) { return '+' + cleaned; }` branch that accepted any phone over 11 digits. David Lauterstein had `+1512374922214` (14 digits) — an NA number that should have been rejected.
- **Fix:** Split the >11 branch into two:
  - `cleaned.length > 11 && cleaned.length <= 15`: Allow if NOT starting with '1' (international). Reject if starts with '1' (NA number too long).
  - `cleaned.length > 15`: Reject (ITU max is 15 digits).
- **Deployed:** MCP `n8n_update_partial_workflow` updateNode on "Enrich Contacts" — full jsCode replacement.
- **Note:** Existing bad phone in DB not retroactively fixed — will be corrected on next re-enrichment run or manual SQL.

### BUG-F015: contacts.source CHECK constraint missing solo_detection + import (BUG-004)
- **Fixed:** 2026-02-18 (Session 12)
- **Severity:** LOW
- **Root cause:** `contacts_source_check` constraint only allowed `('apollo', 'website', 'google', 'manual', 'other')`. Missing `solo_detection` (used by solo practitioner detection) and `import` (needed for future bulk imports).
- **Fix:** `ALTER TABLE contacts DROP CONSTRAINT contacts_source_check; ALTER TABLE contacts ADD CONSTRAINT contacts_source_check CHECK (source IN ('apollo', 'solo_detection', 'website', 'google', 'manual', 'import', 'other'));`
- **SQL executed (Session 13):** Constraint now live and enforced in Supabase. Verified via `pg_get_constraintdef`.

### BUG-F014: No contact deduplication (BUG-002)
- **Fixed:** 2026-02-18 (Session 12)
- **Severity:** HIGH
- **Root cause:** No unique constraint on contacts table. Re-running the same metro created duplicate contact rows for the same person at the same company.
- **Fix (2 parts):**
  1. **Schema:** Created unique index `idx_contacts_company_source_name` on `(company_id, source, COALESCE(first_name, ''))` to prevent duplicates at the database level.
  2. **n8n node:** Updated `Insert Contact to Supabase` HTTP Request to include `on_conflict=company_id,source,first_name` query param and `Prefer: resolution=ignore-duplicates` header.
- **Verification:** Exec 117 — Run Summary3 shows `total_contacts_inserted: 0` (all existing contacts silently skipped). Exec 117 Step 4 shows 35 contacts processed, 34 no changes, 0 errors — existing enriched data NOT overwritten.

### BUG-F013: 409 errors in Update Company in Supabase + Booking platform domain blocklist (BUG-003)
- **Fixed:** 2026-02-18 (Session 11 continued)
- **Severity:** HIGH (409 errors = lost company updates; blocked domains waste API credits)
- **Root cause (409s):** `Prepare Company Update` always included `domain` and `google_place_id` in PATCH payload even when unchanged. When duplicate company rows exist (BUG-002), PATCHing one row's domain conflicts with the other row's unique index.
- **Root cause (BUG-003):** No blocklist for booking platform subdomains. 7+ companies had domains like `calmspa.wixsite.com`, `riverstonemassagetherapy.schedulista.com`.
- **Fix (5 nodes):**
  1. `Normalize Google Results`: Added 20-platform domain blocklist after domain extraction. Blocked domains → `domain=''`, `has_website=false`, `_domain_blocked=true`
  2. `Normalize Yelp Results`: Same blocklist after hostname extraction
  3. `Extract & Patch Domain`: Same blocklist in backfill path. Blocked domains excluded from `_backfill_patch`
  4. `Prepare Company Update`: Scoped `domain`/`google_place_id`/`google_rating`/`google_review_count` to `_backfill_patch` only. Non-backfill companies' PATCHes no longer include these fields.
  5. `Merge Website Results`: Added `_backfill_patch` pass-through (was being dropped by explicit field construction)
- **Blocklist (20 platforms):** wixsite.com, wix.com, setmore.com, schedulista.com, glossgenius.com, square.site, genbook.com, jane.app, acuityscheduling.com, mindbodyonline.com, mindbody.io, vagaro.com, fresha.com, schedulicity.com, booksy.com, massagebook.com, noterro.com, clinicsense.com, calendly.com, squarespace.com
- **Verification:**
  - Exec 115: Zero 409 errors (all 38 items returned `{}`). schedulista.com blocked in discovery. Non-backfill PATCHes have no `domain`.
  - Exec 116: Zero 409 errors (47 items). wixsite.com blocked in backfill path. `_backfill_patch` passes through `Merge Website Results`.
- **SQL remediation COMPLETE (Session 13):** Blocked domains cleared from existing companies via `UPDATE companies SET domain = NULL, has_website = false WHERE domain LIKE '%<blocked>%'`. All 20 platforms covered.

### BUG-F012: Merge Website Results drops email fields from pipeline
- **Fixed:** 2026-02-18 (Session 11)
- **Severity:** HIGH (website-scraped emails never reach Supabase)
- **Root cause:** `Merge Website Results` node builds a flat `enriched` object from `item._website_enrichment` but omitted `emails_found` and `best_email`. Downstream, `Prepare Company Update` tried to read `item._website_enrichment.best_email` — but `_website_enrichment` no longer exists at that point (flattened by Merge).
- **Fix (2 nodes):**
  - `Merge Website Results`: Added `_emails_found: enrichment.emails_found || []` and `_best_email: enrichment.best_email || null` to the enriched object
  - `Prepare Company Update`: Changed `(item._website_enrichment || {}).best_email` → `item._best_email`
- **Verification:** Exec 114 — "Summit Wellness Massage Clinic" now has `email: "info@unitywellness.health"` in `_update_payload`. Previously this field was missing.

### BUG-F011: ISSUE-011 — Missing company email column + role-based email over-rejection
- **Fixed:** 2026-02-18 (Session 10)
- **Severity:** HIGH (34% email coverage, role-based emails permanently lost)
- **Root cause:** No `email` column on companies table. Layer 1 validation blanket-NULLed all role-based emails (info@, contact@, etc.), permanently losing the only contact method for solo practitioners.
- **Fix (4 phases):**
  - Schema: Added `companies.email` + `companies.email_status` columns
  - Website extraction: `Analyze Website HTML` now extracts emails from HTML (regex + mailto scoring)
  - Validation: All 5 `Validate & Clean Contact` nodes now flag but keep role-based emails
  - Routing: `Enrich Contacts` routes role-based emails to `companies.email`, verifies via Hunter, promotes personal email if available
- **Result:** Company emails now captured from 2 sources (website scraping + contact role-based routing). Verified inline via Hunter Verifier.

### BUG-F010: Fetch Contacts excludes contacts with DEFAULT email_status
- **Fixed:** 2026-02-18
- **Severity:** HIGH (Apollo contacts invisible to Step 4)
- **Root cause:** `contacts.email_status` column has `DEFAULT 'unverified'`. When Apollo contacts are inserted without specifying `email_status`, they get `'unverified'`. But `Fetch Contacts` query filtered `email_status=is.null`, so these contacts were never picked up for enrichment.
- **Fix:** Changed Fetch Contacts URL from `email_status=is.null` to `or=(email_status.is.null,email_status.eq.unverified)`. Now fetches contacts needing either initial enrichment (NULL) or verification (unverified).
- **Result:** Exec 111 processed 38 contacts (was 28), 10 updated, 8 NamSor cultural affinities set, 4 emails verified.

### BUG-F009: MCP array index notation silently ignored
- **Fixed:** 2026-02-18
- **Severity:** MEDIUM (config regression)
- **Root cause:** `n8n_update_partial_workflow` with `updateNode` operation used dot-path notation like `parameters.assignments.assignments[2].value`. The MCP docs state "Array index notation is not supported" — the tool returns `operationsApplied: 1` (success) but the value is NOT changed.
- **Compounding factor:** Exec 108 was triggered from n8n editor UI, which saved stale config over the API-deployed values, reverting Session 7 configs.
- **Fix:** Use full `parameters` object replacement instead of array index paths. Pass the complete `assignments` array in the `updates` object.
- **Result:** Exec 109 confirmed correct config values in live execution.

### BUG-F008: email_status 'no_email' violates CHECK constraint
- **Fixed:** 2026-02-18
- **Severity:** MEDIUM
- **Root cause:** Enrich Contacts set `email_status: 'no_email'` for contacts without email. Supabase CHECK constraint only allows: unverified, verified, invalid, risky, accept_all.
- **Fix:** Removed the `no_email` fallback. Contacts without email keep `email_status: NULL`. Cross-batch dedup is already handled by static data (ADR-008), so the marker was unnecessary.
- **Result:** 0 update errors in execution 102 (was 4 errors in execution 101).

### BUG-F007: Step 4 4x duplicate execution from upstream convergence
- **Fixed:** 2026-02-18
- **Severity:** HIGH
- **Root cause:** 13 convergence points in Steps 1-3 (Run Summary, Run Summary1 with 7 inputs, Run Summary3 with 3 inputs) cascade into 4 batches reaching Bridge to 4. Each batch triggered a full Step 4 run on the same 10 contacts.
- **Fix:** Added `$getWorkflowStaticData('global')` dedup in `Filter & Merge Contacts` — tracks processed contact IDs across convergence batches, returns `_empty` for subsequent batches. See ADR-008.
- **Result:** Enrich Contacts now runs 1x (was 4x). Verified in execution 100.

### BUG-F006: Skip toggles misconfigured for testing
- **Fixed:** 2026-02-18
- **Severity:** MEDIUM
- **Root cause:** Step 4 Config had `skip_hunter="false"`, `skip_hunter_verifier="false"`, `skip_snovio=""` (empty, not "true")
- **Fix:** Set all 4 skip toggles to "true" via API deployment script

### BUG-F005: $http is not defined in Enrich Contacts
- **Fixed:** 2026-02-18
- **Severity:** CRITICAL
- **Root cause:** n8n Code nodes don't have `$http` built-in. The generated Enrich Contacts code used `$http.request()` which doesn't exist.
- **Fix:** Replaced all 5 `$http.request()` calls with `this.helpers.httpRequest()` (the correct n8n Code node HTTP helper). Also adjusted response parsing — `this.helpers.httpRequest` with `json: true` returns parsed JSON directly (no `.body` wrapper).
- **Result:** Zero errors in execution 97 (was failing every call before)

### BUG-F004: Step 4 multi-path convergence causes item loss (was BUG-001)
- **Fixed:** 2026-02-17
- **Severity:** CRITICAL
- **Root cause:** n8n creates separate execution batches per upstream path. 7 convergence points in Step 4 caused `.item.json` to pair with wrong items across batches.
- **Fix:** Architectural redesign — replaced 31-node Step 4 branching pipeline with single `Enrich Contacts` Code node using `this.helpers.httpRequest()` loops. Zero convergence points. See ADR-007.
- **Workflow:** `workflows/generated/spa-waterfall-fixed.json` (122 nodes, down from 151)

### BUG-F001: Bad phones from pre-validation data
- **Fixed:** 2026-02-17
- **Fix:** SQL cleanup `UPDATE contacts SET phone_direct = NULL WHERE LENGTH(phone_direct) > 12`

### BUG-F002: LinkedIn http vs https
- **Fixed:** 2026-02-17
- **Fix:** Layer 1 validation normalizes http → https. SQL backfill applied.

### BUG-F018: Parse About Page only tries /about path (BUG-018)
- **Fixed:** 2026-02-19 (Session 17)
- **Severity:** HIGH
- **Root cause:** `Fetch About Page` (HTTP Request node) hardcoded `/about` as the only URL path. `Parse About Page` only processed the upstream response — no fallback paths.
- **Fix:** Updated `Parse About Page` to use `this.helpers.httpRequest()` in a loop over 5 additional paths (`/about-us`, `/about-me`, `/our-team`, `/team`, `/our-story`) when the upstream `/about` response doesn't yield a name match. Extracted name-matching logic into a reusable `extractName()` function. Stops at first successful match.
- **Tracking:** `_source_method` now shows `website_scrape_about-us` (etc.) to indicate which path succeeded.
- **Deployed:** MCP `n8n_update_partial_workflow` updateNode on "Parse About Page" — full jsCode replacement.

### BUG-F017: No metro filter on Steps 3a/4 Supabase fetches (BUG-017)
- **Fixed:** 2026-02-19 (Session 17)
- **Severity:** CRITICAL
- **Root cause:** `Fetch Companies` (Step 3a), `Fetch Companies1` (Step 4), and `Filter & Merge Contacts` (Step 4) had no `discovery_metro` filter. They returned/processed ALL companies and contacts globally, causing cross-metro contamination.
- **Fix (3 nodes):**
  1. `Fetch Companies`: Added `&discovery_metro=eq.{{ $('Metro Config').first().json.metro_name }}` to URL
  2. `Fetch Companies1`: Same metro filter added to URL
  3. `Filter & Merge Contacts`: Added `.filter(c => companyMap[c.company_id])` after `needsEnrichment` to exclude contacts whose company isn't in the metro-scoped companyMap. Added logging for cross-metro skipped count.
- **Deployed:** MCP `n8n_update_partial_workflow` — 3 atomic operations in a single call. ADR-013.

### BUG-F019: Company phone verification blocked by stale static data
- **Fixed:** 2026-02-19 (Session 22)
- **Severity:** HIGH
- **Root cause:** `$getWorkflowStaticData('global')._companyEmailsSet` persists across workflow EXECUTIONS, not just batches within an execution. Exec #129 (first Telnyx test) set `companyId + '_phone_verified' = true` for 9 companies. In all subsequent executions, these keys were still present, causing the company phone verification `if` condition's 4th check (`!companyEmailsSet[companyId + '_phone_verified']`) to evaluate to `false` — permanently blocking company phone verification.
- **Diagnosis:** Added `_company_phone_debug` diagnostic output to capture all 4 condition values at runtime. Exec #130 showed `c4_value: true, c4_negated: false` for every contact while all other conditions were true.
- **Fix (v2):** Clear ALL keys from `companyEmailsSet` at the start of each Enrich Contacts execution. Within a single execution, keys are rebuilt from scratch as contacts are processed, so clearing at start is safe. v1 only cleared `_phone_verified` keys; v2 clears everything to prevent any stale static data issues (email dedup guards, company email routing guards, phone dedup guards).
- **Verification:** Exec #131 — `company_phones_verified: 8` (was 0), `update_errors: 0`.
- **Lesson:** `$getWorkflowStaticData('global')` is a footgun — any keys set persist forever unless explicitly cleared. All dedup guards using static data need execution-boundary cleanup. See ADR-015.

### BUG-F020: Prepare for Supabase missing discovery_metro field
- **Fixed:** 2026-02-19 (Session 24)
- **Severity:** CRITICAL (blocks all new metros from being processed in Steps 2-5)
- **Root cause:** `Prepare for Supabase` Code node explicitly whitelists fields for the INSERT payload. `discovery_metro` was not in the whitelist, so it was silently dropped. The Normalize nodes correctly set `discovery_metro` from Metro Config, and Deduplicate Records passes it through, but Prepare for Supabase stripped it.
- **Impact:** All 121 Phoenix companies inserted with `discovery_metro = NULL`. Metro-scoped fetch nodes (Fetch Batch from Supabase, Fetch Companies, Fetch Companies1) returned 0 results for Phoenix. Steps 2-5 never processed Phoenix data. The same bug would affect ANY new metro.
- **Fix:** Added `discovery_metro: r.discovery_metro || null` to the Prepare for Supabase jsCode field whitelist. Deployed via MCP `n8n_update_partial_workflow`.
- **Backfill:** SQL `UPDATE companies SET discovery_metro = 'Phoenix, AZ' WHERE discovery_metro IS NULL AND LOWER(city) = 'phoenix' AND state = 'AZ'` to fix existing companies.
- **Verification:** Exec #139 (Phoenix, AZ) — 76 companies discovered with correct `discovery_metro`, 71 enriched in Step 2, 70 processed in Step 3a, 20 contacts enriched in Step 4, lead scoring SUCCESS. 0 update errors.
- **Lesson:** When adding a new field to the pipeline, audit ALL nodes in the insert chain: Normalize → Deduplicate → **Prepare for Supabase** → Insert to Supabase. See ADR-016.

### BUG-F028: Collapse to Single2 race condition — count stabilized at 0 (BUG-028)
- **Fixed:** 2026-02-20 (Session 32)
- **Severity:** CRITICAL
- **Root cause:** ADR-025 stabilization polling allowed `count === 0` to be a "stable" state. When n8n task runner schedules Insert to Supabase AFTER Collapse to Single2's polling (due to contention), the polling sees 0 discovered companies, stabilizes at 0 after 30s, and triggers Step 2 with empty data. The inserts complete later but Step 2 has already started.
- **Fix (2 changes):**
  1. Added `&& count > 0` to the stability check: `if (count === prevCount && count > 0)`. Prevents "0 companies" from being treated as stable — polling continues until companies actually appear.
  2. Increased max iterations from 10 to 30 (150s → 450s max). Gives Insert to Supabase ample time to complete under heavy task runner load. In normal cases, polling exits quickly (2-3 rounds after count > 0).
- **Deployed:** MCP `n8n_update_partial_workflow` — single updateNode operation on `Collapse to Single2`, full jsCode replacement.
- **Verification:** Exec #157 (San Diego, CA) — `_discovered_count: 186` (was 0 in #156). 186 companies enriched, 28 contacts processed, 0 errors. All 5 steps completed. Fix confirmed.

### BUG-F027: Yelp companies stuck in 'discovered' after ADR-024 (BUG-027)
- **Fixed:** 2026-02-20 (Session 31)
- **Severity:** HIGH
- **Root cause:** ADR-024 convergence batch suppression in Collapse to Single2 fires on the first batch (Google results, ~5s) and suppresses subsequent batches. Yelp results arrive 60-120s later via Apify polling, get inserted into Supabase, but Collapse to Single2 is already suppressed — so Step 2 never sees these companies.
- **Fix (ADR-025):** Added stabilization polling to Collapse to Single2. After setting the ADR-024 suppression flag, the node polls Supabase every 15s counting `discovered` companies for the current metro. When count is stable for 2 consecutive checks (30s of stability), all inserts are done and the trigger fires. Max wait: 150s.
- **Verification:** Exec #155 (Austin TX) — Collapse to Single2 took ~45s. Step 2 fetched 216 companies (all Austin companies). Status: success, 0 errors.

### BUG-F026: Run Summary1 convergence crash loop (BUG-026)
- **Fixed:** 2026-02-19 (Session 29)
- **Severity:** CRITICAL
- **Root cause:** 7 paths converged directly on Run Summary1, creating 7 execution batches. The Task Runner completed the first batch (full pipeline) but crashed on secondary batches with stale expired tasks, entering an infinite crash-restart loop.
- **Fix (ADR-022):** Added `Collapse to Single1` Code node between all 7 convergence paths and Run Summary1. The Code node runs in `runOnceForAllItems` mode and outputs a single trigger item, collapsing all batches into one. Run Summary1's `$('NodeName').all()` references still work because they resolve globally by name. Workflow now 125 nodes.
- **Pattern:** Same as existing `Collapse to Single` before `Fetch Companies1` in Step 4 (ADR-007).

### BUG-F025: Insert Flagged pipeline crash on phone uniqueness conflict (BUG-025)
- **Fixed:** 2026-02-19 (Session 29)
- **Severity:** HIGH
- **Root cause:** `Insert Flagged (Needs Review)` was the only Insert HTTP node without `onError: continueRegularOutput`. When a fuzzy-matched company had a phone number already used by another company, the `idx_companies_phone` unique index caused a 409 conflict that crashed the entire pipeline.
- **Fix:** Applied `onError: continueRegularOutput` to `Insert Flagged (Needs Review)` node via MCP partial update. The 409 conflict is now silently handled (the record is skipped, pipeline continues).
- **Note:** All other Insert nodes (`Insert to Supabase`, `Insert Social Profiles`, `Insert FB/IG Social Profiles`, `Insert Contact to Supabase`) already had this protection.

### BUG-F024: n8n Task Runner crash loop from stuck execution (BUG-024)
- **Fixed:** 2026-02-19 (Session 29)
- **Severity:** CRITICAL
- **Root cause:** Exec #147 (Austin TX) completed all 84 nodes but remained in `status: running` with `stoppedAt: null`. Multi-path convergence (7 upstream paths to Run Summary1) meant secondary batches were still queued when the runner context expired. On each n8n restart, the stuck execution dispatched stale tasks to the runner, causing an infinite crash-restart loop.
- **Fix:** User manually cancelled exec #147 from n8n UI. Runner re-registered cleanly at 22:47:45. No data loss — all Supabase writes completed before the execution got stuck.
- **Key finding:** `Fetch Existing Contacts` returned 77,812 items (4 batches × ~19,400 contacts). Contacts table has grown to ~19,400 rows across 6 metros.
- **Prevention:** Monitor for executions stuck in "running" with `stoppedAt: null`. This is a systemic risk with n8n Task Runner + multi-path convergence workflows.

### BUG-F033: Webhook body unwrapping — sub-workflow Code nodes fail on wrapped POST body (BUG-033)
- **Fixed:** 2026-02-20 (Session 37)
- **Severity:** CRITICAL
- **Root cause:** n8n Webhook v2 wraps POST body under `$json.body`. Respond to Webhook passes the full wrapper object through. Enrich Companies (first Code node after Respond) read `$input.first().json.metro` — but actual data was at `$input.first().json.body.metro`. Result: `throw new Error('missing metro in input')` on every batch.
- **Fix:** Added `const payload = inputData.body || inputData;` unwrap in all 3 sub-workflow Code nodes:
  1. `enrich-companies.js` (lines 10-13): Primary fix — this node receives directly from Respond to Webhook
  2. `find-contacts.js` (lines 10-13): Defensive — receives clean objects from Enrich Companies return, but protected against node rearrangement
  3. `enrich-contacts.js` (lines 10-13): Defensive — same reasoning
- **Fallback:** `|| inputData` preserves compatibility when called from main workflow legacy mode (flat object input).
- **Deployed:** MCP `n8n_update_partial_workflow` — 3 updateNode operations on sub-workflow `fGm4IP0rWxgHptN8`. All applied, workflow remains active.

### BUG-F034: Batch Dispatcher timeout at 300s (BUG-034)
- **Fixed:** 2026-02-20 (Session 38)
- **Severity:** HIGH
- **Root cause:** `N8N_RUNNERS_TASK_TIMEOUT` was at default 300s. Batch Dispatcher's Phase 1 polling + Phase 4 completion polling easily exceeded this.
- **Fix:** User set `N8N_RUNNERS_TASK_TIMEOUT=1800` in Coolify and restarted. Confirmed working: exec #167 ran Batch Dispatcher for 438s without timeout. Additionally, Phase 4 completion polling removed (sub-workflows are fire-and-forget), Phase 1 reduced from 30→20 iterations.

### BUG-F035: Convergence ordering — Insert Flagged fires Batch Dispatcher before Insert to Supabase (BUG-035)
- **Fixed:** 2026-02-20 (Session 38)
- **Severity:** HIGH
- **Root cause:** Both Insert to Supabase and Insert Flagged connected to Batch Dispatcher. Insert Flagged (2 items) completes first, triggering Batch Dispatcher. ADR-024 convergence guard blocks the second trigger from Insert to Supabase. Since n8n serializes execution within a branch, Insert to Supabase doesn't run until Batch Dispatcher completes — companies not yet in Supabase when Batch Dispatcher polls.
- **Fix (ADR-030):** Removed `Insert Flagged (Needs Review)` → `Batch Dispatcher` connection via MCP `removeConnection`. Batch Dispatcher now receives input only from Insert to Supabase, which always has the bulk of the data.
- **Verification:** Exec #170 (Sedona, AZ) — Batch Dispatcher found 199 discovered companies in 32s (was 0 in #167), dispatched 8/8 batches successfully.

### BUG-F036: Insert to Supabase drops 8 fields — zero digital signals (BUG-036)
- **Fixed:** 2026-02-20 (Session 42)
- **Severity:** CRITICAL
- **Root cause:** Insert to Supabase and Insert Flagged HTTP Request node bodies explicitly listed fields. 8 fields computed by Prepare for Supabase were silently dropped: `google_rating`, `google_review_count`, `has_online_booking`, `booking_platform`, `has_paid_ads`, `estimated_size`, `on_yelp`, `on_groupon`.
- **Fix:** Added all 8 fields to both Insert node JSON bodies via MCP `n8n_update_partial_workflow`. Both nodes now pass through the full field set.
- **Note:** `on_yelp` and `on_groupon` are set during discovery normalization but were NEVER written to the DB before this fix. Existing data needs SQL backfill.

### BUG-F037: Enrich Companies PATCH includes nonexistent columns (BUG-037)
- **Fixed:** 2026-02-20 (Session 42)
- **Severity:** HIGH
- **Root cause:** `enrich-companies.js` PATCH payload included `opening_hours`, `business_status`, `photo_count`, `price_level` — columns that don't exist in the Supabase companies table. Google Details API returns these values, but the columns were never created in the schema. Supabase returns 400 errors for unknown columns.
- **Fix:** Removed all 4 nonexistent columns from the PATCH payload in `enrich-companies.js`. Deployed via MCP updateNode on sub-workflow.

### BUG-F038: Early-exit paths drop metro/company_ids (BUG-038)
- **Fixed:** 2026-02-20 (Session 42)
- **Severity:** HIGH
- **Root cause:** 4 early-exit paths in enrichment Code nodes (Enrich Companies, Find Contacts, Enrich Contacts) returned bare `[]` without `metro` and `company_ids` fields. In the parallelized architecture, these fields are required by downstream nodes (passed via input items, not `$('Metro Config')` reference).
- **Fix:** All 4 early-exit paths now return `[{ json: { metro, company_ids: companyIds } }]` to propagate the batch context. Deployed via MCP updateNode on sub-workflow.

### BUG-F003: Credentials stored as last names (Lmt, Cmt, Rmt)
- **Fixed:** 2026-02-17
- **Fix:** Layer 1 validation rejects credential patterns. SQL cleanup applied.

---

## Improvement Opportunities

Enhancement ideas discovered during the Session 17 pipeline quality audit. These are NOT bugs — they're potential improvements for pipeline quality and efficiency.

| ID | Area | Finding | Potential Improvement |
|----|------|---------|----------------------|
| IMP-001 | Step 3a | Apollo returns 0 people for ~100% of local massage businesses | Investigate alternative people discovery APIs (LinkedIn Sales Navigator API, ZoomInfo, Clearbit) or expand website scraping to extract team pages more aggressively |
| IMP-002 | Step 3a | Solo contacts created with `first_name: null` when name can't be extracted from business name | These contacts can never be enriched (Hunter needs first_name, NamSor needs last_name). Consider not creating contactless solo stubs, or using business owner lookup APIs |
| IMP-003 | Step 3a | `Parse About Page` requires BOTH first AND last name from `commonFirstNames` set | Relax to accept first-name-only matches (like solo detection does). Also, uncommon/international names miss the `commonFirstNames` check entirely |
| IMP-004 | Step 3a | `Fetch Existing Contacts` has no limit — fetches ALL contacts globally | Deferred: With ~200 contacts, query takes 661ms — not a bottleneck. Revisit when contacts table reaches thousands |
| IMP-005 | Step 4 | `Fetch Companies1` has no limit/pagination | Fetches all enriched companies into memory. Fine for ~200 companies, but will degrade at scale |
| IMP-006 | Step 4 | Contacts with no email, no last name, and Snov.io disabled always get `has_updates = false` | Hunter needs domain+first_name; NamSor needs first+last name. Solo-detected contacts without last names have no enrichment path. Consider alternative enrichment strategies |
| IMP-007 | Step 4 | `_enrichedContactIds` in `$getWorkflowStaticData('global')` is dead code | Accumulated from previous dedup implementation. Never read by current code. Could be cleaned up |
| IMP-008 | Config | Snov.io still disabled (no API key) | Would provide email fallback when Hunter returns nothing. Priority if Hunter coverage stays low |
| IMP-009 | Config | Social discovery + SociaVault disabled (no Apify/SociaVault credentials) | Facebook/Instagram profile discovery and enrichment would provide social presence data for lead scoring |
| IMP-010 | Step 4 | No re-enrichment path for previously enriched contacts | Once a contact is marked as enriched (email_status != unverified/null), it's never re-processed even if new data sources become available |
| IMP-011 | Step 3a | BUG-005 still open: email-domain mismatch detection | Apollo sometimes returns emails that don't match the company domain (college emails, platform emails). Need cross-validation logic |
| IMP-012 | Enrich Companies | Website email scraping has no counter — `best_email` is written to `companies.email` but the summary stats don't track how many emails were scraped | Add `emails_scraped` counter to the Enrich Companies stats object and summary output |
| IMP-013 | Enrich Contacts | Company emails only get verified when a contact exists for that company — companies with website-scraped emails but no contacts never get Hunter verification | Add company email verification directly in Enrich Companies (or a separate post-enrichment step) so all scraped emails get verified regardless of contact existence |
| IMP-014 | Enrich Contacts | ~~NamSor cultural_affinity guard requires BOTH first_name AND last_name~~ **FIXED (Session 46):** Guard relaxed to only require `first_name`. Deployed to sub-workflow. However, NamSor API itself is failing (BUG-040) — verification deferred until API works. | ~~Relax the guard on line 448 to only require `first_name`.~~ **DONE.** |
