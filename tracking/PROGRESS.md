# Progress Tracker

## Current Phase
**Phase 0: Setup** ✅ Complete
**Phase 1: Node Inventory** ✅ Complete
**Phase 2: Connection Map** ✅ Complete
**Phase 3: Code Audit** ✅ Complete
**Phase 4: Issue Registry** ✅ Complete
**Phase 5: Fix Plan** ✅ Complete
**Phase 6: Pre-Generation Review** ✅ Complete
**Phase 7: Generate Fixed Workflow** ✅ Complete
**Pipeline Simplification** ✅ Deployed (127 → 27 nodes)
**Parallelized Batch Enrichment** ✅ Deployed (ADR-029 — main 22 nodes + sub-workflow 6 nodes)

## API STATUS: 5 of 6 APIs Enabled
- **Apollo:** ✅ Enabled and verified (exec 109: 36 searched, 8 contacts created)
- **NamSor:** ✅ Enabled and verified
- **Hunter Verifier:** ✅ Enabled and verified
- **Hunter Finder:** ✅ Enabled and verified (1 email found in exec 106)
- **Telnyx Phone Verification:** ✅ Enabled and verified — contact phones (exec 129: 9/9 valid) AND company phones (exec 131: 8 verified)
- **Snov.io:** ⏸ Blocked — no API key/account

### Current Config (Simplified Pipeline — config embedded in Code nodes)
- **Enrich Companies:** `SKIP_GOOGLE_DETAILS=false`, `HTTP_TIMEOUT=15000`
- **Find Contacts:** `SKIP_APOLLO=false`, `SKIP_WEBSITE_SCRAPE=false`, `APOLLO_ENRICH_ENABLED=true`
- **Enrich Contacts:** `skip_hunter="false"`, `skip_snovio="true"`, `skip_hunter_verifier="false"`, `skip_namsor="false"`, `skip_phone_verifier="false"`, `batch_size="1000"`
- **Discovery:** 12 search queries per metro, Apify/Yelp `searchLimit=100`, per-metro radius (15-25km)

### Next Steps
- [x] ~~Set `BATCH_ENRICHMENT_WEBHOOK_URL` env var in Coolify~~ — Done (2026-02-20)
- [x] ~~Test parallelized pipeline~~ — Sedona AZ exec #170 full success (2026-02-20, Session 38)
- [ ] Re-run Portland, OR after SQL cleanup
- [ ] Set up Snov.io account and API key
- [ ] Add email-domain mismatch detection (ISSUE-012)
- [ ] Step 6: Dashboard (next major milestone)
- [ ] Re-run Boise, ID after SQL reset of stuck companies
- [ ] Re-run Asheville, NC (exec #165 timed out pre-fix)

## Session Log

### Session 41 — 2026-02-20 (Diagnostic SQL + Root Cause Analysis)
- **Created `scripts/diagnostic.sql`** — single SELECT returning one JSON blob via `json_build_object()`. User runs in Supabase SQL Editor, copies the JSON cell, pastes it back for diagnosis.
- **9 sections:** company_funnel, company_verification, contact_funnel, contacts_by_source, enrichment_depth, score_distribution, quality_flags, samples (dead_leads/stuck/no_name_contacts/email_mismatches × 5 each), booking_platforms.
- **Diagnostic results revealed ALL digital signals are zero** for Sedona: 0 booking, 0 ratings, 0 emails, 0 paid ads, 0 on_yelp/groupon. 50 stuck companies (25%). Only 13 contacts (all solo_detection, zero Apollo).
- **Root cause identified:** "Insert to Supabase" HTTP Request node body sends 14 of 26 fields computed by "Prepare for Supabase". Drops `google_rating`, `google_review_count`, `on_yelp`, `on_groupon`, `has_online_booking`, `booking_platform`, `has_paid_ads`, `estimated_size`. The enrichment code (`enrich-companies.js`) SHOULD backfill some of these, but `on_yelp`/`on_groupon` are never written by any node.
- **Created `docs/HANDOFF-pipeline-recovery.md`** — comprehensive handoff doc with investigation steps, fix plan, success criteria, and file reference.
- **Decision: No rebuild needed.** The enrichment code is comprehensive and correct. The issue is 2 HTTP Request node body templates missing fields — a targeted fix.

### Session 40 — 2026-02-20 (Sedona SQL Rewrite for Supabase Compatibility)
- **Rewrote `scripts/sedona-data-quality.sql`** — reduced from ~25 SELECT statements (in 5 groups) to **10 single-SELECT queries**. Supabase SQL Editor only returns the result of the last SELECT, so the old format was unusable (user only saw the last SELECT of whichever group they ran).
- **Consolidation strategy:**
  - Merged "Field Coverage" + "Digital Signals" into Q3 (1 wide row, ~19 columns)
  - Merged phone/email verification into Q4 (1 wide row, ~16 columns)
  - Merged contact email/phone/linkedin/role into Q6 (1 wide row, ~20 columns)
  - Merged contacts-per-company + channel availability into Q7 (CTE + GROUP BY)
  - Merged all 5 quality flag checks into Q9 (UNION ALL with flag_type label)
  - Removed all `SELECT '--- SECTION ---' AS section;` label rows (these were the "extra" SELECTs)
- **10 queries:** Executive Summary, Enrichment Status, Coverage+Signals, Phone/Email Verification, Contact by Source, Contact Channel Quality, Enrichment Depth+Readiness, Top 20 Leads, Data Quality Flags, Booking Platforms

### Session 39 — 2026-02-20 (Sedona AZ Data Quality Inspection)
- **Created `scripts/sedona-data-quality.sql`** — comprehensive 5-query data quality inspection for Sedona AZ exec #170 output.
  - **Query 1:** Company enrichment overview — enrichment status, field coverage %, digital signals, phone/email verification status, booking platforms
  - **Query 2:** Contact coverage & quality — source breakdown, name completeness, email/phone/LinkedIn coverage, role distribution
  - **Query 3:** Enrichment depth per company — contact count distribution, company-level channel coverage (verified email, valid phone)
  - **Query 4:** Sales-ready leads — outreach readiness by channel (both/email/phone/neither), top 20 highest-scored leads with best contact info
  - **Query 5:** Data quality flags — booking platform domains that slipped through, email-domain mismatches, dead leads, nameless contacts, companies stuck in non-final status
  - Includes one-row executive summary scorecard
- **Next:** User runs queries in Supabase SQL Editor, review results together

### Session 38 — 2026-02-20 (Sedona AZ E2E Test + Convergence Ordering Fix — ADR-030)
- **Sedona, AZ metro added:** 10th operational metro. Coords 34.8697, -111.7610, radius 15km. Used as clean test metro for parallelized pipeline (zero existing data).
- **BUG-034 RESOLVED (Path A):** `N8N_RUNNERS_TASK_TIMEOUT=1800` IS working. Exec #167 Batch Dispatcher ran 438s without timeout (>300s default). No code split needed.
- **BUG-035 FOUND & FIXED (HIGH):** Convergence ordering bug — Insert Flagged (2 items, fast) fired Batch Dispatcher BEFORE Insert to Supabase (127 items, slower). ADR-024 convergence guard blocked the second trigger. Batch Dispatcher polled Supabase but companies weren't inserted yet → found 0 discovered companies after 438s.
  - **Fix (ADR-030):** Removed `Insert Flagged → Batch Dispatcher` connection. Batch Dispatcher now receives input only from Insert to Supabase.
- **Phase 4 completion polling removed:** Sub-workflows are fire-and-forget. Lead scoring recalculates from current Supabase data. Removed wasteful 15+ min polling. Batch Dispatcher reduced from ~197 to ~151 lines.
- **Phase 1 discovery polling reduced:** 30 → 20 max iterations (450s → 300s max). Sufficient since Insert to Supabase is now the only trigger.
- **Exec #167 (Sedona, AZ — partial success):** 13.3 min, 22 nodes. Discovery OK (128 companies), but Batch Dispatcher found 0 companies due to convergence ordering bug. BUG-034 (timeout) confirmed NOT an issue.
- **Exec #170 (Sedona, AZ — FULL SUCCESS):** 6.9 min, 22 nodes. After convergence fix:
  - Insert to Supabase: 128 companies (2.5s)
  - Batch Dispatcher: **32 seconds** (was 438s in #167). 199 discovered companies, 8 batches dispatched, 8/8 successful
  - Calculate Lead Scores: SUCCESS
  - Run Summary5: scoring_status SUCCESS
- **Sub-workflow verification:** All 8 sub-workflow executions (#171-#178 minus #176) completed successfully. All 6 nodes executed in ~72s each. BUG-033 fix verified (body unwrapping working — no "missing metro" errors).
- **Deployed changes:**
  1. Metro Config: Added Sedona, AZ (MCP updateNode)
  2. Batch Dispatcher: Removed Phase 4, reduced Phase 1 (MCP updateNode)
  3. Main workflow: Removed Insert Flagged → Batch Dispatcher connection (MCP removeConnection)

### Session 37 — 2026-02-20 (Pre-Flight Fix: Webhook Body Unwrapping — BUG-033)
- **BUG-033 FIXED (CRITICAL):** n8n Webhook v2 wraps POST body under `$json.body`. Sub-workflow Code nodes read `$input.first().json.metro` which resolved to `undefined` because actual data was at `$input.first().json.body.metro`. Every batch would have failed with `missing metro in input`. Since sub-workflow returns 200 immediately (fire-and-forget), Batch Dispatcher would think dispatch succeeded, then timeout after 15 min.
- **Fix:** Added `const payload = inputData.body || inputData;` unwrap in 3 Code nodes:
  - `enrich-companies.js` — primary fix (receives directly from Respond to Webhook)
  - `find-contacts.js` — defensive (receives clean objects from Enrich Companies return)
  - `enrich-contacts.js` — defensive (same reasoning)
- **Deployed:** MCP `n8n_update_partial_workflow` — 3 updateNode ops on sub-workflow `fGm4IP0rWxgHptN8`, all applied. Workflow confirmed active.
- **No SQL changes needed.** Schema already supports all required values.
- **Sub-workflow regenerated:** `workflows/generated/sub-workflow.json` rebuilt from updated source files.

### Session 36 — 2026-02-20 (Parallelized Batch Enrichment — ADR-029)
- **MAJOR ARCHITECTURE CHANGE: Parallelized batch enrichment deployed.** Monolithic pipeline split into main workflow (22 nodes) + sub-workflow (6 nodes).
- **BUG-031 FIXED (CRITICAL):** `$('Metro Config').first().json.metro_name` reference fails in convergence batch context. Nashville exec #160: 161 companies inserted, but Collapse to Single2 found 0 after 7.5 min polling. Fixed by reading metro from input items in all nodes.
- **BUG-032 FIXED (HIGH):** Monolithic enrichment of 161 companies exceeds 300s task runner hard cap. Nashville exec #161: Find Contacts only processed 27 of 161. Fixed by splitting into batches of 25 companies (~125-200s each).
- **BUG-030 CONFIRMED WORKING:** Nashville exec #160 Insert to Supabase: 161 items, 0 constraint violations — dropped unique domain/phone indexes work.
- **New architecture:**
  - Main workflow: Webhook → Metro Config → [Discovery] → Insert to Supabase / Insert Flagged → **Batch Dispatcher** → Calculate Lead Scores → Run Summary5
  - Sub-workflow (`fGm4IP0rWxgHptN8`): Webhook (POST) → Respond to Webhook (200 OK) → Enrich Companies → Find Contacts → Enrich Contacts → **Mark Fully Enriched**
  - Batch Dispatcher: polls for discovery completion, fetches company IDs, splits into batches of 25, dispatches all batches simultaneously via `Promise.all()`, polls for all batches to finish
  - Sub-workflow returns 200 immediately (fire-and-forget), processes batch asynchronously
- **New files:** `batch-dispatcher.js` (197 lines), `mark-fully-enriched.js` (42 lines)
- **Modified files:** `enrich-companies.js`, `find-contacts.js`, `enrich-contacts.js` (batch mode + input-based metro), `metro-config.js` (new flag cleanup), `build-simplified-workflow.py` (two-workflow generation)
- **Sub-workflow deployed:** ID `fGm4IP0rWxgHptN8`, webhook `batch-enrichment-v1`, activated and verified (200 OK on test POST)
- **Main workflow updated:** ID `yxvQst30sWlNIeZq`, 22 nodes, active
- **PENDING:** Set `BATCH_ENRICHMENT_WEBHOOK_URL` env var in Coolify before testing

### Session 35 — 2026-02-20 (Fix Franchise Chain Unique Constraint Bug — BUG-030, ADR-028)
- **BUG-030 IDENTIFIED (CRITICAL):** Portland OR exec #159 (first simplified pipeline test) failed because `Insert to Supabase` hit 409 errors on `idx_companies_domain` unique constraint. Franchise chains (The Now Massage, Massage Envy, Elements Massage) share domains across locations. The upsert uses `on_conflict=google_place_id`, but domain/phone unique constraints on different google_place_ids cause unrecoverable 409s. Since the node has `onError: continueRegularOutput`, errors are swallowed → 0 companies discoverable → pipeline produces nothing.
- **ADR-028:** Drop `idx_companies_domain` and `idx_companies_phone` unique constraints, recreate as regular (non-unique) indexes. `google_place_id` stays unique — it's the only truly unique-per-location identifier.
- **Schema docs updated:** `docs/architecture/schema.sql` — indexes changed from UNIQUE to regular with explanatory comment.
- **SQL provided for user:** (1) Drop/recreate indexes, (2) Clean Portland stale data.
- **Pending:** User runs SQL in Supabase SQL Editor, then test with new metro + re-run Portland.

### Session 34 — 2026-02-20 (Pipeline Simplification: 127 → 27 Nodes — ADR-027)
- **MAJOR ARCHITECTURE CHANGE: Simplified pipeline deployed.** Workflow reduced from 127 nodes to 27 nodes.
- **Steps 2, 3a, 3b collapsed into 2 Code nodes:**
  - `Enrich Companies` (~540 lines) — replaces ~40 nodes: Enrichment Config, Fetch Batch, Parse Batch, domain backfill, website scrape, Google Details, company update, social profiles insert
  - `Find Contacts` (~615 lines) — replaces ~25 nodes: Step 3a Config, Fetch Companies, solo detection, Apollo search/enrich, about page scraping, name extraction, validation, contact insert
- **Step 4 simplified:** `Enrich Contacts` modified to include inline Supabase fetch + Filter & Merge logic (previously 5 separate nodes). `Run Summary4` modified to use embedded config.
- **Eliminated:**
  - 3 of 4 Collapse nodes (Collapse to Single1, Collapse to Single3, Collapse to Single)
  - All stabilization polling in Collapse to Single1 (ADR-026 no longer needed)
  - All Bridge nodes (Bridge to 3b, Bridge to 3a, Bridge to 4)
  - All Step Config Set nodes (Enrichment Config, Step 3a Config, Step 3b Config, Step 4 Config)
  - All intermediate Run Summary nodes (Run Summary1, Run Summary3)
  - ~100 branching IF/HTTP/Code nodes from Steps 2-3
- **Kept:** Step 1 discovery pipeline (21 nodes), Collapse to Single2 (with stabilization polling), Calculate Lead Scores, Run Summary5
- **Pipeline flow:** Webhook → Metro Config → [Discovery] → Collapse to Single2 → Enrich Companies → Find Contacts → Enrich Contacts → Run Summary4 → Calculate Lead Scores → Run Summary5
- **Build system:** Python script (`scripts/build-simplified-workflow.py`) reads deployed workflow from MCP, filters to kept nodes, adds new/modified nodes, builds connections, outputs JSON
- **Deploy:** `scripts/deploy-simplified.py` — direct REST API deploy (117KB payload)
- **Validation:** n8n validator passed — 6 known false positives (Code node return type, intentional Apify loop), 54 cosmetic warnings
- **PREREQUISITE:** `N8N_RUNNERS_TASK_TIMEOUT=1800` must be set in Coolify before testing (Enrich Companies processes ~200 companies at ~5s each = ~17 min)
- **Workflow snapshot saved:** `workflows/current/deployed-fixed.json`, `workflows/generated/simplified-workflow.json`
- **Backup saved:** `workflows/backups/pre-simplification-20260220-075736.json`

### Session 33 — 2026-02-20 (Fix Collapse to Single1 Timing Gap — ADR-026)
- **BUG-029 FIXED (CRITICAL):** Collapse to Single1's fire-once guard (ADR-024) triggered on the FIRST company to exit Step 2, starting Step 3a while Step 2 was still processing ~190+ companies. For brand-new cities, Step 3a only saw ~5-10 companies (~95% missed). Existing metros unaffected because prior runs left companies at `partially_enriched`/`fully_enriched`.
- **ADR-026 deployed:** Added stabilization polling to Collapse to Single1 (same pattern as ADR-025). Polls `enrichment_status=eq.discovered` every 15s. When count = 0 for 2 consecutive polls (30s), Step 2 is done. Max 80 iterations (20 min).
- **Portland, OR metro added:** New metro in METROS lookup table (latitude 45.5152, longitude -122.6784, 15km radius).
- **Exec #158 (Portland, OR) — TRIGGERED:** First brand-new city test with ADR-026. Results pending.

### Session 32 — 2026-02-20 (Fix Collapse to Single2 Race Condition — BUG-028)
- **BUG-028 FIXED (CRITICAL):** Collapse to Single2 stabilization polling allowed `count === 0` to stabilize. San Diego exec #156 completed `status: success` but Steps 2-5 processed 0 companies. Insert to Supabase was the LAST node (position 46/46) — n8n task runner scheduled it after the polling loop.
- **Fix deployed via MCP:**
  1. Added `&& count > 0` to stability check — prevents 0 from being treated as stable
  2. Increased max iterations from 10 to 30 (450s max) — safety margin for heavy task runner load
- **Exec #157 (San Diego, CA) — SUCCESS (all data in Supabase, 83 nodes):**
  - Collapse to Single2: `_discovered_count: 186` (was **0** in exec #156!), polling took 45s
  - Discovery: 192 unique records (112 Google, 97 Yelp, 17 overlap), 1 flagged
  - Step 2: **186 companies enriched**, 124 websites fetched, 198 social profiles, 91 booking platforms, 17 paid ads
  - Step 3a: 143 companies, 28 solo detected, 6 contacts inserted, Apollo 0 searched (all previously searched)
  - Step 4: 28 contacts processed, 27 updated, **0 errors** — Phone: 26 valid, 1 VoIP, 27 company phones verified, 21 company emails verified
  - Step 5: Lead scoring SUCCESS
  - **Note:** Execution shows `status: running` / `stoppedAt: null` — known BUG-F024 pattern (secondary convergence batches). All data written to Supabase. Cancel from n8n UI if it stays stuck.

### Session 31 — 2026-02-20 (Step 1→2 Timing Fix — ADR-025 Stabilization Polling)
- **BUG-027 FIXED (HIGH):** Yelp companies stuck in `discovered` status after ADR-024 convergence batch suppression. 119 of 219 Austin companies were never enriched because Collapse to Single2 fired on the fast Google batch and suppressed the slower Yelp batch.
- **ADR-025 deployed:** Added stabilization polling to Collapse to Single2. After setting the ADR-024 suppression flag, polls Supabase every 15s counting `discovered` companies. When count is stable for 30s, all inserts are done and Step 2 begins.
- **`scripts/actionable-leads.sql` updated:** Removed `enrichment_status` filter — now shows all companies with any outreach channel regardless of enrichment status.
- **Exec #155 (Austin TX) — SUCCESS:**
  - Status: `success`, `stoppedAt` set, `finished: true`
  - Duration: 18m 47s, 89 nodes executed
  - Collapse to Single2: stabilization polling took ~45s (3 poll cycles), `_discovered_count: 118`
  - Discovery: 184 unique records (108 Google, 91 Yelp, 15 overlap), 4 flagged
  - Step 2: **216 companies enriched** (151 websites, 259 social profiles, 118 booking platforms)
  - Step 3a: 96 companies processed, 4 solo, 1 contact inserted, Apollo 0 searched
  - Step 4: 70 contacts processed, 4 updated, 0 errors — 3 phones valid, 1 VoIP, 4 company phones verified, 3 company emails verified
  - Step 5: Lead scoring SUCCESS

### Session 30 — 2026-02-20 (Convergence Batch Suppression — ADR-024)
- **Deployed convergence batch suppression** to eliminate redundant Step 2-5 re-runs caused by multi-path convergence.
- **4 nodes modified atomically via MCP:**
  1. `Collapse to Single2`: Added `$getWorkflowStaticData('global')._collapse2_fired` guard — only fires once per execution
  2. `Collapse to Single1`: Added `$getWorkflowStaticData('global')._collapse1_fired` guard — only fires once per execution
  3. `Enrich Contacts`: Added per-contact dedup via `staticData._enriched_contact_ids` — contacts enriched exactly once even across 4 convergence batches
  4. `Metro Config`: Added static data cleanup at start — clears `_collapse1_fired`, `_collapse2_fired`, `_enriched_contact_ids` from previous execution
- **Exec #154 (Austin TX) — FIRST CLEAN SUCCESS:**
  - Status: `success`, `stoppedAt` set, `finished: true`
  - Duration: 17m 7s, 92 nodes executed, zero runner crashes
  - Collapse to Single2: 1 output (was 2) — 50% reduction
  - Collapse to Single1: 1 output (was 7) — 86% reduction
  - Step 4: 4 batches (down from ~9), but dedup ensured only 59 unique contacts processed
  - 2 new contacts enriched (solo practitioners), 57 already had data from prior runs
  - 0 update errors
- **Key insight:** Collapse to Single3 and Collapse to Single remain unsuppressed (safe — contacts may not be in Supabase yet when first batch fires). The remaining 4 batches are handled by per-contact dedup.

### Session 29 — 2026-02-19 (Fix Task Runner Crash Loop)
- **BUG-024 FIXED (CRITICAL):** n8n JS Task Runner was in a persistent crash-restart loop. Exec #147 (Austin TX) completed all 84 nodes but got stuck in `status: running` with `stoppedAt: null`. Runner kept receiving stale expired tasks, crashing, restarting — survived Coolify restarts.
- **Root cause:** Multi-path convergence (7 paths to Run Summary1) meant secondary batches were still queued when runner context expired. On restart, n8n re-dispatched stale tasks to the runner.
- **Fix:** User cancelled exec #147 from n8n UI. Runner re-registered cleanly. No data loss.
- **Exec #147 data (Austin TX — all written to Supabase before stuck):**
  - Discovery: 178 unique records (103 Google, 91 Yelp, 16 overlap), 3 flagged
  - Step 3a: 46 companies, 1 new contact, 0 Apollo (all previously searched)
  - Step 4: 34 contacts, 2 updated, 0 errors. 2 phones verified valid, 5 company emails verified
  - Step 5: Lead scoring SUCCESS
- **Key finding:** Contacts table has grown to ~19,400 rows. `Fetch Existing Contacts` returned 77,812 items (4 convergence batches × ~19,400). Filter & Parse Batch correctly deduplicates, but this is increasingly wasteful.
- **Pending:** Test run to verify runner stability, Boise re-run preparation

### Session 28 — 2026-02-19 (Revert Session 27 + Correct Tracking)
- **Reverted Session 27 changes:** Session 27 deployed a "performance fix" for `Fetch Existing Contacts` based on false premises. Investigation found:
  - The "147,195 items" claim was fabricated — Supabase has ~197 contacts total
  - In exec #141 (last successful run), `Fetch Existing Contacts` returned 9,322 items in **661ms** — not a bottleneck
  - All 5 Boise executions (#142-146) **failed** due to Apify memory limits and n8n worker instability, NOT slow contact fetches
  - Exec #146 had `executedNodes: 0` — it never ran, so "1h21m execution time" was worker retry time, not node execution time
- **Reverted 2 nodes via MCP:**
  1. `Filter & Parse Batch`: Restored `$input.all()` from Fetch Existing Contacts (removed inline `this.helpers.httpRequest()`)
  2. `Fetch Existing Contacts`: Restored original URL without `&limit=1`
- **Deleted false tracking entries:** BUG-F023, ADR-021, Session 27 changelog/progress entries
- **Reopened IMP-004:** `Fetch Existing Contacts` has no limit — deferred optimization, not a current problem
- **Real Boise failure causes identified:**
  - Apify memory: 12 queries × 4096MB each exceeded 32GB account limit
  - n8n worker/task runner instability: executions never start or timeout at first Code node
  - Infrastructure issues, not workflow logic

### Session 26 — 2026-02-19 (Apollo 429 Fix + Boise Metro + Scaled Config + Enrichment Gap Fix)
- **Apollo 429 fix deployed:** Added batching to Apollo People Search — 3 contacts per batch with 2-second delay between batches. Confirmed working in San Diego (#141) and Boise (#146) with zero 429 errors.
- **Boise, ID metro added:** New metro in METROS lookup table. 174 businesses discovered (102 Google, 89 Yelp). Config: 12 search queries, Yelp searchLimit 100, 25km radius.
- **Scaled-up search config deployed (ADR-018):** All metros now use 12 search queries (was 5), Yelp searchLimit 100 (was 20), per-metro radius instead of fixed 15km. batch_size raised from 100 to 300 during session.
- **Key finding (ADR-019):** Apollo has ~0% contact data for local massage therapy businesses. Company phone from Google Places is the primary outreach channel — not personal email.
- **Enrichment gap discovered:** Boise exec #146 discovered 174 companies but Step 2 only enriched 50. Root cause: prior failed runs (#143/#144) set some companies to `partially_enriched`, and Step 2's `Fetch Batch from Supabase` only fetched `enrichment_status=eq.discovered`.
- **Enrichment gap fix deployed (ADR-020):**
  - `Fetch Batch from Supabase` URL changed from `enrichment_status=eq.discovered` to `enrichment_status=in.(discovered,partially_enriched)` — companies from failed runs are now re-processed
  - `batch_size` raised from 300 to 1000 in all 3 config nodes (Enrichment Config, Step 3a Config, Step 4 Config)
  - Pipeline is idempotent — re-enriching partially_enriched companies just fills in missing data
- **Execution results:**
  - **Exec #141 (San Diego):** Apollo 429 fix verified — 0 rate limit errors
  - **Exec #143 (Boise, FAILED):** Apify Yelp actor memory limit exceeded
  - **Exec #144 (Boise, FAILED):** n8n task runner timeout
  - **Exec #146 (Boise, FAILED):** `executedNodes: 0` — worker retry exhausted after 1h21m. Data in Supabase (174 discovered, 50 enriched) is accumulated across partial runs, not from this execution.
- **Pending:** Need to run SQL to reset 124 stuck Boise companies to `discovered`, then re-trigger pipeline
- **Pending:** Fix Apify memory limits (12 queries × 4096MB > 32GB account) + n8n worker stability
- **Workflow snapshot saved:** `workflows/current/deployed-fixed.json` (124 nodes)

### Session 25 — 2026-02-19 (Dynamic Metro Config + San Diego Pipeline)
- **Dynamic Metro Config deployed (ADR-017):** Replaced static Set node with Code node that reads `metro_name` from webhook query parameter. Built-in METROS lookup table with 5 metros (Austin TX, Denver CO, Phoenix AZ, Toronto ON, San Diego CA). No more manual MCP config changes between runs.
  - Node type: `n8n-nodes-base.set` → `n8n-nodes-base.code`
  - Same name, position, connections — downstream nodes unchanged
  - Also removed disconnected manual trigger node (124 nodes total)
- **San Diego, CA pipeline run (Exec #140 — SUCCESS, all 5 steps):**
  - Step 1: 81 unique businesses (63 Google, 20 Yelp, 2 overlap), 1 flagged
  - Step 2: 79 companies enriched, 59 websites fetched, 106 social profiles, 47 booking platforms, 11 paid ads
  - Step 3a: 63 companies processed, 10 solo detected, 2 contacts inserted. Apollo: 0 searched (429 rate limited). About pages: 51 fetched, 2 names found.
  - Step 4: 12 contacts processed, 10 updated, **0 update errors**
    - Phone: 10 valid, 10 company phones verified
    - Company emails: 7 verified
    - Phones added: 10
  - Step 5: Lead scoring SUCCESS
- **Apollo 429 rate limit:** Still persisting from prior dashboard runs. Not a bug — needs retry/backoff strategy.
- **Workflow snapshot saved:** `workflows/current/deployed-fixed.json` (124 nodes)

### Session 24 — 2026-02-19 (BUG-F020 Fix + Phoenix Pipeline Verification)
- **BUG-F020 FIXED (CRITICAL):** `Prepare for Supabase` Code node was missing `discovery_metro` from its explicit field whitelist. All new discoveries inserted with `discovery_metro = NULL`, making them invisible to metro-scoped fetch nodes in Steps 2-5.
  - **Fix 1:** Added `discovery_metro` to Prepare for Supabase via MCP
  - **Fix 2:** SQL backfill — tagged 121 Phoenix companies + 10 AZ suburbs, plus Denver/Austin/Toronto
  - **Fix 3:** Verified auth headers, metro filters, bridge connections, alwaysOutputData intact
- **Phoenix, AZ pipeline run (Exec #139 — SUCCESS, all 5 steps):**
  - Step 1: 76 unique records (59 Google, 19 Yelp, 2 overlap), 0 flagged
  - Step 2: 71 companies enriched, 43 websites fetched, 73 social profiles, 33 booking platforms, 9 paid ads
  - Step 3b: 100 social profiles (all skipped — social discovery disabled)
  - Step 3a: 70 companies processed, 15 solo, 2 contacts inserted. Apollo: 0 searched (429 rate limited). About pages: 43 fetched.
  - Step 4: 20 contacts processed, 19 updated, **0 update errors**
    - Phone: 19 valid, 0 invalid, 0 VoIP, 0 disconnected
    - Company phones: 19 verified
    - Company emails: 12 verified
    - Phones added: 14
  - Step 5: Lead scoring SUCCESS
- **Apollo 429 rate limit:** All Apollo People Search requests rate-limited. Prior executions 134-138 (dashboard runs) exhausted quota. Pipeline handled gracefully via continueOnError. Not a bug — needs retry/backoff strategy.
- **One 409:** `elementsmassage.com` domain uniqueness conflict (franchise). Known pattern from BUG-F013.
- **Workflow snapshot saved:** `workflows/current/deployed-fixed.json` (125 nodes)
- **ADR-016:** Prepare for Supabase field whitelisting audit rule

### Session 23 — 2026-02-19 (Dashboard: .xlsx Report Download)
- **Feature:** Added Download button to completed runs in dashboard
  - `src/lib/export.ts` — queries companies + contacts by metro, builds 2-sheet .xlsx, triggers browser download
  - `RunHistoryTable.tsx` + `RecentRunsTable.tsx` — Download button (with spinner) next to Re-run
  - Companies sheet: 18 columns (lead score, name, category, phone, email, website, address, ratings, booking, etc.)
  - Contacts sheet: 15 columns (company name, name, role, emails, phone, status, linkedin, source, etc.)
- **Dependency:** `xlsx` (SheetJS) installed — client-side .xlsx generation
- **Build:** clean, 711KB JS (xlsx adds ~290KB)
- **ADR-010 (dashboard):** Client-side .xlsx over server-side export

### Session 22 — 2026-02-19 (Fix BUG-F019 + Full E2E Verification)
- **Full pipeline E2E run: Exec #132 — 0 ERRORS across all 5 steps**
  - Step 1: 59 unique records discovered (45 Google, 19 Yelp, 5 overlap), 1 flagged
  - Step 2: 45 companies enriched, 34 websites fetched, 81 social profiles created
  - Step 3b: 100 social profiles processed (all previously enriched)
  - Step 3a: 35 companies processed, 24 Apollo searched, 24 about pages scraped, 0 new contacts (Austin already saturated)
  - Step 4: 48 contacts processed, 40 updated, 0 errors. Phone: 32 valid, 8 VoIP, 40 company phones verified
  - Step 5: Lead scoring SUCCESS
- **Root cause found:** `$getWorkflowStaticData('global')._companyEmailsSet` persists across EXECUTIONS, not just batches. Exec #129 set `companyId + '_phone_verified'` keys that permanently blocked company phone verification in all future runs.
- **Diagnostic deployed (exec #130):** Added `_company_phone_debug` to capture all 4 condition values at runtime. Confirmed `c4` (stale dedup key) was the only failing condition.
- **v1 fix deployed:** Clear `_phone_verified` keys at start of each execution.
- **v2 fix deployed:** Clear ALL stale keys from `companyEmailsSet` at start of each execution. Within a single execution, keys are rebuilt as contacts are processed — clearing at start is safe.
- **Exec #131 (SUCCESS, v2 verification):**
  - `company_phones_verified: 8` (was 0 before fix)
  - `email_verification.verified: 1`, `update_errors: 0`
  - Individual contacts show `_company_phone_verified: true`
  - All enrichments enabled (Hunter, NamSor, phone verifier)
- **Production config restored:** `batch_size=100`, all enrichments enabled (except Snov.io)
- **ADR-015:** Static data lifecycle — clear `companyEmailsSet` at start of each execution
- **Scripts created:** `scripts/fix-company-phone.py` (v1), `scripts/fix-company-phone-v2.py` (v2), `scripts/deploy-diagnostic-api.py`, `scripts/restore-production-config.py`

### Session 21 — 2026-02-19 (Telnyx Phone Verification Test Run)
- **Phone verification test: SUCCESS (Exec #129)**
  - Triggered via webhook with isolated config: `skip_phone_verifier="false"`, all other enrichments skipped, `batch_size="10"`
  - **9 contacts processed, 9 updated, 0 errors**
  - Phone verification results:
    - `verified_valid: 9` — all phones verified as valid
    - `invalid_removed: 0`, `voip_flagged: 0`, `disconnected_removed: 0`
    - `company_phones_verified: 0` (needs investigation — companies had eligible phones but weren't verified)
  - Sample results:
    - Hands On You Massage: `valid`, `mobile`, Cingular Wireless/2
    - Jenny Rice LMT: `valid`, `mobile`, T-Mobile US-SVR-10X/2
    - Ocio Massage: `valid`, `landline`, BANDWIDTH.COM-NSR-10X/1
    - Mantis Massage: `valid`, `landline`, BANDWIDTH.COM-NSR-10X/1
  - Execution time: ~4.5 min total (2.9s for Enrich Contacts — ~300ms per Telnyx call)
  - Lead scoring: SUCCESS
- **Config restored to production:** `batch_size="100"`, all enrichments enabled (except Snov.io), `skip_phone_verifier="false"` (phone verification stays on)
- **Telnyx phone verification is now in production.**

### Session 20 — 2026-02-18 (Telnyx Phone Verification - Level 2)
- **Telnyx phone verification deployed (6 node updates via MCP):**
  1. `Step 4 Config`: Added `skip_phone_verifier="true"` toggle (starts disabled)
  2. `Fetch Contacts`: Expanded filter to catch contacts with verified email + unverified phone. Added `phone_status,phone_line_type,phone_carrier` to select.
  3. `Fetch Companies1`: Added `phone_status,phone_line_type` to select
  4. `Filter & Merge Contacts`: Added `phoneNeedsVerification` to enrichment filter, passes through company phone status fields
  5. `Enrich Contacts`: Added `verifyPhone()` helper using Telnyx Number Lookup API. Contact phone + company phone verification with dedup guard. Invalid/disconnected → null phone_direct (keep status for audit).
  6. `Run Summary4`: Added `phone_verification` section with valid/invalid/voip/disconnected/company counts
- **New files:**
  - `scripts/deploy-phone-verification.sql` — schema migration for phone verification columns
  - `docs/architecture/schema.sql` — updated with new columns
- **ADR-014:** Telnyx phone verification strategy
- **Prerequisites for user:** Create Telnyx account, add `TELNYX_API_KEY` to n8n Coolify env vars, run SQL migration in Supabase
- **Feature guide:** `docs/features/phone-verification-strategy.md` (Level 2 now implemented)

### Session 19 — 2026-02-18 (Outreach CSV Export)
- **Created `exports/outreach-ready.sql`** — SQL query for extracting outreach-ready leads from Supabase.
  - LEFT JOIN companies ↔ contacts, filters to rows with at least one contact channel (email or phone)
  - Excludes `needs_review` companies
  - Sorted by lead_score DESC
  - User runs in Supabase SQL Editor → Download CSV
- **Deleted temp workflow `xd9ox5wghRgQfZar`** ("TEMP - Outreach CSV Export") from n8n — no longer needed.

### Session 18 — 2026-02-19 (Denver Verification Run + Tracking Cleanup)
- **Denver verification run (Exec #125, SUCCESS):** Triggered via webhook with Denver, CO config. ~7 min total.
  - Discovery: 76 unique businesses (62 Google, 20 Yelp, 6 overlap)
  - Step 2: 61 companies enriched, 48 websites fetched, 86 social profiles, Google Details: 50 items
  - Step 3a: 52 companies processed, Apollo searched 45 → 0 people, 45 about pages scraped → 0 names (multi-path code ran, no parseable names in Denver businesses), 0 contacts inserted
  - Step 4: 17 Denver contacts processed, 0 updated (all previously enriched), **0 errors**
  - Step 5: Lead scoring SUCCESS
  - **Metro scoping VERIFIED:** Filter & Merge Contacts output all Denver companies (Atwood Therapeutics Denver, Heavy Elbow BodyWork Denver, etc.). Zero cross-metro contamination.
  - **Google Details VERIFIED:** 50 items through Google Places Details API
- **Tracking cleanup:** Corrected Session 17 exec #123 stats to match actual execution data (Run Summary numbers were partially inaccurate in original tracking).
- **Note:** Exec #124 (Austin, TX) appeared between sessions — likely triggered by n8n editor or another source. Not part of our verification.
- **Metro Config restored to Austin, TX** after verification.

### Session 17 — 2026-02-19 (Pipeline Quality Audit: Metro Scoping + About Page Fix)
- **BUG-F017 FIXED (CRITICAL):** Metro-scoped pipeline execution. Added `discovery_metro` filter to Fetch Companies (Step 3a) and Fetch Companies1 (Step 4). Added metro filtering in Filter & Merge Contacts (Step 4). Previously, Steps 3a/4 processed ALL companies/contacts globally, causing Denver run to enrich 37 Austin contacts instead of Denver ones.
- **BUG-F018 FIXED (HIGH):** Multi-path about page scraping. Parse About Page now tries 6 URL paths instead of just `/about`.
- **Google Details enabled:** `skip_google_details` flipped from `"true"` to `"false"`.
- **Schema change:** Added `discovery_metro TEXT` column to companies table. Backfilled Austin/Denver. Updated Insert to Supabase + Insert Flagged nodes to persist the field.
- **Exec #122 (FAILED):** First attempt — `discovery_metro` column didn't exist in DB. Root cause: field was computed in Normalize nodes but never saved (Insert nodes explicitly whitelist fields).
- **Exec #123 (SUCCESS, verification):** Full Denver pipeline run after schema fix:
  - Discovery: 75 unique businesses (62 Google, 20 Yelp, 7 overlap)
  - Step 3a: 53 companies processed, 1 solo contact with name, Apollo searched 0 (all previously searched), website scraped 0 (all previously scraped), 1 contact inserted
  - Step 4: 16 Denver contacts processed (was 37 Austin in exec #121!), 1 updated (NamSor + phone), 1 company email verified, 0 errors
  - Step 5: Lead scoring SUCCESS
  - **Metro scoping VERIFIED:** Fetch nodes returning only Denver data, Filter & Merge excluding non-Denver contacts
- **Metro Config switched back to Austin, TX** after verification.
- **ADR-013:** Metro-scoped pipeline execution.
- **IMP-001 through IMP-011:** 11 improvement opportunities catalogued in BUGS.md.

### Session 16 — 2026-02-19 (Quick Fixes + Denver CO Pipeline Run)
- **BUG-006 FIXED:** Phone validation — `validatePhone()` now rejects NA numbers > 11 digits (starting with '1'). International numbers allowed up to 15 digits (ITU max). David Lauterstein's `+1512374922214` (14 digits) would now be rejected.
- **Business type filtering deployed:** Added `BUSINESS_TYPE_BLOCKLIST` (10 keywords: school, college, university, association, federation, union, board of, institute, academy, program) to both `Normalize Google Results` and `Normalize Yelp Results`. Non-target businesses filtered BEFORE Supabase insert.
- **Denver, CO pipeline run (Exec 121 — SUCCESS):** 14m 35s, 0 errors.
  - Discovery: 76 unique businesses (62 Google, 20 Yelp, 6 overlap)
  - Step 2: 74 companies enriched, 59 websites, 107 social profiles
  - Step 3a: 40 companies processed, Apollo searched 24 → 0 people found (data gap for Denver massage businesses)
  - Step 4: 37 existing contacts processed, 0 updated (all previously enriched)
  - Step 5: Lead scoring SUCCESS — all company scores recalculated including Denver
- **Metro Config switched back to Austin, TX** after Denver verification.
- **MCP lesson learned:** `n8n_update_partial_workflow` updateNode operations require `nodeName` (not `name`) field. Previous sessions used `name` which happened to work due to different MCP version behavior.
- **ADR-012:** Business type blocklist strategy.

### Session 15 — 2026-02-19 (Step 5: Lead Scoring)
- **SQL deployed to Supabase:** `scoring_rules` table (6 seed rules), `calculate_lead_scores()` PL/pgSQL function, `high_priority_leads` view.
- **Bug encountered:** Supabase PostgREST blocked bare `UPDATE companies SET lead_score = 0` (error 21000: "UPDATE requires a WHERE clause"). Fixed with `WHERE TRUE` + `SECURITY DEFINER`.
- **n8n nodes deployed:** 2 new nodes + 3 connections via MCP (workflow now 125 nodes):
  - `Calculate Lead Scores` (HTTP Request → Supabase RPC)
  - `Run Summary5` (Code node, logs success/failure)
  - Wired from `Run Summary4` and `No Records - Done3` (mutually exclusive IF branches)
- **Exec 119 (FAILED scoring):** Pipeline completed cleanly, but RPC returned error 21000. Run Summary5 correctly caught and logged the failure. No data lost.
- **Exec 120 (SUCCESS):** Full pipeline, ~8 min. `Calculate Lead Scores` returned `{}` (void = success). `Run Summary5`: `scoring_status: "SUCCESS"`. All lead scores recalculated.
- **ADR-011:** Supabase RPC for lead scoring (Option A over n8n Code node).
- **Schema updated:** `docs/architecture/schema.sql` — added `WHERE TRUE` and `SECURITY DEFINER` to function.

### Session 14 — 2026-02-18 (Doc Cleanup + Production Readiness)
- **Doc cleanup:** Removed 3 stale fixed-bug stubs from BUGS.md Open section. Updated TODO.md stale descriptions. Cleaned PROGRESS.md "What's Broken" and "Next Steps".
- **Production readiness assessment:** No blocking bugs. All 11 CRITICAL/HIGH bugs fixed. 2 remaining open issues are quality improvements (MEDIUM/LOW).

### Session 13 — 2026-02-18 (SQL Remediation + Verification Run)
- **CHECK constraint live (BUG-F015):** `contacts_source_check` now enforced in Supabase. Verified: constraint includes all 7 values (`apollo`, `solo_detection`, `website`, `google`, `manual`, `import`, `other`).
- **Blocked domain cleanup (BUG-F013):** Cleared booking platform domains from existing companies. UPDATE covered all 20 blocked platforms.
- Both operations executed by user in Supabase SQL Editor and verified.
- **Notification system added:** CLAUDE.md updated with ping-zack.vercel.app notification instructions (Section 11).
- **Exec 118 (SUCCESS):** 8m 16s, verification run post-SQL remediation.
  - Discovery: 60 unique businesses (45 Google, 20 Yelp, 5 overlap)
  - Step 2: 45 companies enriched, 33 websites fetched, 75 social profiles
  - Step 3a: 38 companies processed, 0 new contacts (dedup confirmed), Apollo searched 0 (all already searched)
  - Step 4: 37 contacts processed, 1 updated (phone), 36 no changes, **0 update errors**
  - **No CHECK constraint violations, no 409 errors, no blocked domain issues**

### Session 12 — 2026-02-18 (Contact Dedup + CHECK Constraint)
- **BUG-002 CLOSED (BUG-F014):** Contact deduplication now enforced. Unique index `idx_contacts_company_source_name` on `(company_id, source, COALESCE(first_name, ''))` + n8n `Insert Contact to Supabase` uses `on_conflict` + `ignore-duplicates`.
- **BUG-004 CLOSED (BUG-F015):** `contacts_source_check` constraint updated to include `solo_detection` and `import`.
- **Schema docs updated:** `docs/architecture/schema.sql` CHECK constraint now matches live DB.
- **Exec 117 (SUCCESS):** 8m 41s, 0 errors. 62 businesses discovered, 47 companies enriched, 0 new contacts (dedup confirmed), 35 contacts processed in Step 4 (1 updated, 34 no changes, 0 errors). Existing enriched data preserved.

### Session 11 continued — 2026-02-18 (Fix 409 Errors + Domain Blocklist)
- **BUG-F013 found & fixed:** 409 errors in `Update Company in Supabase` caused by PATCH payload always including `domain`/`google_place_id` even when unchanged. Combined with BUG-003 (booking platform domains).
- **5-node atomic deploy via MCP:**
  1. `Normalize Google Results` — 20-platform domain blocklist
  2. `Normalize Yelp Results` — 20-platform domain blocklist
  3. `Extract & Patch Domain` — 20-platform domain blocklist in backfill
  4. `Prepare Company Update` — PATCH payload scoped to `_backfill_patch` only
  5. `Merge Website Results` — `_backfill_patch` pass-through (discovered during verification)
- **Exec 115 (SUCCESS):** Zero 409 errors, schedulista.com blocked, non-backfill PATCHes clean
- **Exec 116 (SUCCESS):** Zero 409 errors, wixsite.com blocked in backfill, `_backfill_patch` flows through pipeline
- **BUG-003 CLOSED**, ADR-010 added
- **SQL remediation COMPLETE (Session 13):** CHECK constraint live, blocked domains cleared

### Session 11 — 2026-02-18 (Fix BUG-F012: Website Email Pipeline)
- **BUG-F012 found & fixed:** `Merge Website Results` dropped `emails_found` and `best_email` from pipeline. `Prepare Company Update` referenced `item._website_enrichment.best_email` which no longer exists after Merge flattens the enrichment object.
- **Fix deployed via MCP:** 2-node atomic update:
  1. `Merge Website Results` — added `_emails_found` and `_best_email` to enriched object
  2. `Prepare Company Update` — changed reference from `(item._website_enrichment || {}).best_email` to `item._best_email`
- **Exec 114 (SUCCESS):** Full pipeline, 0 errors
  - Discovery: 62 unique businesses
  - Step 2: 45 companies enriched, website emails now flowing through
  - Step 3a: 68 companies → 34 not solo, 28 Apollo searched
  - Step 4: 34 contacts processed, 0 updated (all already enriched), 16 company emails verified
  - **Proof:** "Summit Wellness Massage Clinic" `_update_payload` now includes `email: "info@unitywellness.health"`
- **Schema docs updated:** Added `companies.email` and `companies.email_status` to `docs/architecture/schema.sql`

### Session 10 — 2026-02-18 (Company Email Column + Role-Based Email Routing)
- **Implemented ADR-005 + ADR-006** — company email column + role-based email routing
- **Phase A: Schema migration** — User ran `ALTER TABLE companies ADD COLUMN email TEXT; ALTER TABLE companies ADD COLUMN email_status TEXT CHECK (...)` in Supabase. Updated Fetch Companies1 select to include `email,email_status`.
- **Phase B: Website email extraction** — Modified `Analyze Website HTML` to extract emails from HTML (regex + mailto: links, junk filtering, domain scoring). Modified `Prepare Company Update` to include `best_email` in company PATCH payload.
- **Phase C: Stop deleting role-based emails** — Updated all 5 `Validate & Clean Contact` copies to flag role-based emails (`_role_based_kept`) but NOT return null. Step 4 now handles routing.
- **Phase D: Company email routing** — Modified `Filter & Merge Contacts` to pass `_company_email` and `_company_email_status` to Enrich Contacts. Modified `Enrich Contacts` with:
  - Role-based email detection (same 20 patterns as Layer 1)
  - Free webmail domain exclusion (gmail, yahoo, etc.)
  - Company email routing: role-based emails → company.email if company has no email
  - Personal email promotion: if contact has personal + role-based, personal becomes email_business
  - Company email verification via Hunter Verifier (inline, 1 credit per unique company)
  - Dedup guard: `$getWorkflowStaticData('global')._companyEmailsSet` prevents duplicate PATCHes
  - Company PATCH to Supabase with email + email_status
- **Updated Run Summary4** with company email routing stats
- **10 node updates total** via MCP `n8n_update_partial_workflow`:
  1. Fetch Companies1 (URL update)
  2. Analyze Website HTML (email extraction added)
  3. Prepare Company Update (website email to PATCH)
  4-8. Validate & Clean Contact ×5 (role-based emails kept)
  9. Filter & Merge Contacts (company email fields)
  10. Enrich Contacts (routing + verification)
  11. Run Summary4 (routing stats)
- **ISSUE-011 CLOSED**, ADR-005 → ACTIVE, ADR-006 → ACTIVE

### Session 9 — 2026-02-18 (Supabase Data Inspection & Analysis)
- **Wrote 5 SQL inspection queries** — companies overview, contacts with emails, data quality summary, email status breakdown, duplicate check
- **User ran queries in Supabase SQL editor** — results saved to `query_tests/`
- **Full analysis written** at `query_tests/ANALYSIS.md`
- **Key findings:**
  - 97 companies, 58 contacts (36 Apollo, 22 solo_detection)
  - **19 contacts ready for outreach** (15 verified + 4 accept_all emails)
  - 38 contacts still missing email — primary enrichment gap
  - 0 duplicates — ADR-008 dedup working correctly
  - 7 booking platform domains confirmed (BUG-003)
  - 4 email-domain mismatches found (NEW: ISSUE-012)
  - 5 non-target businesses discovered (schools, associations, unions)
  - 1 invalid phone number (14 digits)
  - Solo detection contacts are very sparse — 68% lack names entirely

### Session 8 — 2026-02-18 (Fix Config Regression + Enable Apollo + Fetch Contacts Fix)
- **Root cause analysis:** Exec 108 (manual editor run) overwrote Session 7 configs — Step 3a reverted to `skip_apollo="true"`, Step 4 reverted to `batch_size="10"` and all APIs disabled
- **MCP bug discovered:** `n8n_update_partial_workflow` silently ignores array index notation (`parameters.assignments.assignments[2].value`) — returns success but changes nothing (BUG-F009)
- **Config fix deployed:** Used full `parameters` object replacement in `updateNode` operations — 2 atomic ops, both applied successfully
- **Exec 109 (SUCCESS):** Apollo enabled, 8 contacts created from 36 companies searched
- **Exec 110:** 28 contacts processed, 0 updated — 8 Apollo contacts missing from Step 4
- **BUG-F010 discovered:** Fetch Contacts query filtered `email_status=is.null` but column DEFAULT is `'unverified'`. Apollo contacts inserted without email_status get DEFAULT 'unverified', making them invisible to Step 4.
- **BUG-F010 FIXED:** Changed Fetch Contacts URL to `or=(email_status.is.null,email_status.eq.unverified)`
- **Exec 111 (SUCCESS):** Full pipeline, 0 errors
  - Discovery: 60 unique businesses
  - Step 3a: Apollo searched 28 companies, 0 new people (already found in exec 109)
  - **Step 4: 38 contacts processed (+10 vs before), 10 updated, 0 errors** ✅
    - Hunter Verifier: 4 checked → 1 verified, 1 invalid removed, 2 accept_all
    - NamSor: 8 cultural affinities set (all Apollo contacts!)
    - Phones: 10 added from company data
  - All 8 Apollo contacts now fully enriched

### Session 7 — 2026-02-18 (Scale to batch_size=100)
- **Increased discovery limits:** Google Places `maxResultCount` 10→20, Apify/Yelp `searchLimit` 5→20
- **Increased enrichment batches:** Step 3a `batch_size` 50→100, Step 4 `batch_size` 5→100
- All 4 changes deployed via MCP `n8n_update_partial_workflow` in a single atomic operation
- **Exec 105 (FAILED):** Enrich Contacts timed out after 60s — n8n task runner default limit too low for 47 contacts × 4 API calls
- **Fix:** User increased `N8N_RUNNERS_TASK_TIMEOUT` in Coolify env vars, restarted server
- **Exec 106 (SUCCESS):** Full pipeline in 10 min, 0 errors
  - Discovery: 61 unique businesses (46 Google + 20 Yelp)
  - Company enrichment: 11 companies, 15 social profiles
  - Contact discovery: 35 companies → 1 new contact (solo practitioner)
  - **Contact enrichment: 33 contacts processed, 12 updated**
    - Hunter Finder: 1 new email discovered
    - Hunter Verifier: 5 checked → 3 verified, 1 invalid, 1 risky
    - NamSor: 10 cultural affinities set
    - Phone: 6 phones added
    - 0 update errors

### Session 6 — 2026-02-18 (API Enablement Testing)
- **n8n MCP tools connected** — all workflow updates and execution inspection done via MCP
- **BUG-F008 FIXED:** `email_status: 'no_email'` violated Supabase CHECK constraint → removed, contacts without email keep NULL
- **NamSor test (exec 102):** 0 errors, Jenny Rice → cultural_affinity "Europe / Northern Europe / GB"
- **Hunter Verifier test (exec 103):** 0 errors, Jenny Rice → email_status "verified" (score 49)
- **Hunter Finder test (exec 104):** 0 errors, 0 new emails (no eligible contacts — all 4 unnamed contacts lack first_name)
- **Observation:** 4 of 5 contacts in batch have no first/last name — NamSor and Hunter Finder both require names. Need larger batch or different offset to find name-bearing contacts.
- **Next:** Set up Snov.io, increase batch size, fix dedup before scaling

### Session 5 — 2026-02-18 (n8n API Testing & Bug Fixes)
- **Connected to n8n API** — MCP config present but server didn't start; used direct API calls via curl instead
- **Discovered 7 workflows** in n8n, identified `yxvQst30sWlNIeZq` as the active FIXED workflow
- **Analyzed execution 96** — found 3 critical issues:
  1. `$http is not defined` in Enrich Contacts (blocked all API calls + Supabase updates)
  2. 4x duplicate execution of Step 4 (convergence in Steps 1-3 cascades downstream)
  3. Skip toggles misconfigured (APIs being called during testing)
- **BUG-005 FIXED:** Replaced `$http.request()` with `this.helpers.httpRequest()` in Enrich Contacts. Confirmed working in execution 97.
- **BUG-006 FIXED:** Skip toggles set to all-true via API. Confirmed in execution 97.
- **BUG-007 FIXED:** Added `$getWorkflowStaticData('global')` dedup in Filter & Merge Contacts. Execution 100: Enrich Contacts ran 1x (was 4x), 0 errors.
- **Deployment scripts:** `scripts/deploy-http-fix.py`, `scripts/deploy-dedup-fix-v2.py`
- **Next:** Enable APIs one at a time (NamSor first, then Hunter Verifier, then Hunter Finder)

### Session 3 — 2026-02-17 (Phases 3-7: Audit through Generation)
- **Phase 3: Code Audit** — Audited all 72 Code nodes. Found 6 CRITICAL (`.item.json` at convergence), 22 HIGH (`.all()` at convergence), 6 MEDIUM, 1 LOW, 50 OK.
- **Phase 4: Issue Registry** — 15 issues compiled (4 CRITICAL, 5 HIGH, 4 MEDIUM, 2 LOW). Dependency graph built.
- **Phase 5: Fix Plan** — Strategy: Replace 31-node Step 4 branching pipeline with single `Enrich Contacts` Code node. Zero convergence.
- **Phase 6: Pre-Generation Review** — 5 dry-run traces passed. All cross-checks passed. No contradictions.
- **Phase 7: Generated fixed workflow** at `workflows/generated/spa-waterfall-fixed.json`
  - 122 nodes (removed 31, added 2)
  - Zero convergence in Step 4 (was 7)
  - 12 remaining convergence points in Steps 1-3 (pre-existing, not broken)
  - Validation script: 0 errors, 24 pre-existing warnings
- **Next:** Import into n8n and test

### Session 2 — 2026-02-17 (Phase 2: Connection Map)
- Wrote `scripts/generate_phase2.py` to build connection graph from Phase 1 extracted data
- Generated `docs/investigation/phase2-connection-map.md` (1,486 lines) with:
  - 180 total connections (edges) across 151 nodes
  - ASCII flow diagrams for all 5 steps with TRUE/FALSE branch labels
  - Connection tables with source/target/label for every edge
  - Input count per node tables with CONVERGENCE markers
  - **19 convergence points** documented in registry format per investigation plan spec
  - Hand-drawn Step 4 deep-dive diagram showing the full cascade of 7 convergence points
  - Risk matrix: 17 CRITICAL + 2 HIGH convergence points
  - `.all()` usage analysis: 11 Code nodes using `.all()` at/downstream of convergence
  - Cross-step analysis note: within-step convergence is confirmed high risk, cross-step risk likely low (database fetch resets batching)
  - 4 inter-step bridges documented (Run Summary → Bridge → Config → Fetch pattern)
  - 1 entry point, 5 terminal points, 0 isolated nodes
- **Key finding:** Step 4 has 7 convergence points in a single unbroken batch chain, with `.item.json` pairing at Parse Hunter Response, Parse Snov.io Response, Parse Verifier Response, and Parse NamSor Response
- **Next:** Phase 3 — Code Audit

### Session 1 — 2026-02-17 (Phase 1: Node Inventory)
- Wrote Python extraction script (`scripts/extract_nodes.py`) to parse all 151 nodes from workflow JSON
- **Corrected node count:** 151 nodes (plan estimated 88 — actual is 72 Code, 36 HTTP, 32 IF, 5 Set, 3 Wait, 2 Merge, 1 Trigger)
- Generated comprehensive `docs/investigation/phase1-node-inventory.md` (6,973 lines) with:
  - Master node tables by step (5 steps: Discovery, Company Enrichment, Social Enrichment, Find People, Enrich People)
  - Full jsCode for all 72 Code nodes (duplicates documented once with cross-references)
  - All 32 IF node conditions with JSON and routing targets
  - All 36 HTTP Request nodes with method, URL, headers, body, batching, timeout
  - All 5 Set node assignments
  - 19 convergence points identified (multi-input nodes)
  - 60 cross-references ($('NodeName') usage across code nodes)
  - 12 dangerous `.item.json` patterns flagged for Phase 2
  - 2 duplicate code groups: Validate & Clean Contact (5 copies), Bridge nodes (3 copies)
- Completeness verified: 151/151 nodes documented, types sum to 151
- **Next:** Phase 2 — Connection Map

### Session 0 — 2026-02-17 (Setup)
- Created repo structure, CLAUDE.md, investigation plan
- Populated architecture docs from handoff
- Copied Supabase schema
- **Next:** Export full n8n workflow JSON to `workflows/current/`, then begin Phase 1

## What's Working
- Steps 1-3a (discover, enrich companies, find people)
- Layer 1 validation (email/phone/name/linkedin cleaning)
- Schema migrations (email_status, email_verified_at)
- NamSor cultural affinity integration
- Hunter Email Verifier (verified 1/13 — API works, routing broken)

## What's Broken
- **No blocking bugs.** All CRITICAL and HIGH bugs fixed (15 total: F004-F019). Pipeline runs cleanly with metro scoping, phone verification (contact + company), and all enrichments.
- BUG-005 (MEDIUM): Email-domain mismatch — 4 contacts have Apollo emails not matching company domain. Quality improvement, not a blocker.

## Blocked On
- Nothing.

## API Credits
- Hunter.io: check dashboard (was ~48.5, exec 106 used ~6 credits: 1 Finder + 5 Verifier)
- NamSor: check dashboard (exec 106 used 10 calls)
- Apollo: check dashboard
