# Changelog

## 2026-02-21 (Session 54 — Tampa FL E2E Test + Webhook Fix)

### Bug Fixes
- **BUG-041 FIXED:** Webhook `multipleMethods: true` routed POST to output 1 (no connection). Changed to POST-only webhook with single output → Metro Config.
- **Tampa FL metro added** to Metro Config lookup table (coords 27.9506, -82.4572, radius 20km).

### Pipeline Run
- **Tampa FL exec #262 (SUCCESS):** 6m 53s, 23/23 nodes
  - Discovery: 180 Google + 97 Yelp = 277 raw → 161 deduplicated → 159 inserted + 2 flagged
  - Batch Dispatcher: 31.7s, 7 batches dispatched (all_dispatched)
  - Sub-workflows #263-#269: 7/7 SUCCESS (all 7 nodes each, 77-101s per batch)
  - 0 update errors (sampled batches)
  - NamSor cultural affinity working again (Irena→IL, Joshua→GB, Rain→EE, Gennell→GB)
  - Lead Scoring: SUCCESS

### Dashboard Integration Verified
- First successful dashboard-triggered pipeline run with full run_id lifecycle
- pipeline_runs row: queued → running → completed (7/7 batches tracked)
- Dashboard properly sent POST with metro_name, run_id, lat/lng/radius

### Observations
- **BUG-040 (NamSor) possibly resolved** — NamSor returning data for Tampa contacts after being null for Nashville/San Diego
- **0 update errors** — significant improvement vs Nashville (27.5%) and Sedona (13%)

---

## 2026-02-21 (Session 53 — Backfill Historical Pipeline Runs)

### New Files
- `scripts/backfill-pipeline-runs.sql` — SQL INSERT to populate `pipeline_runs` table with historical run data for 7 metros.

### Data
- 7 metros backfilled: Austin TX, Boise ID, Nashville TN, San Diego CA, Scottsdale AZ, Sedona AZ, Asheville NC
- Asheville marked `'failed'` (2 companies, 0 enriched)
- All others marked `'completed'` with accurate company/contact counts and timestamps
- `triggered_by = 'backfill'` for all rows
- 4 metros deferred (Denver, Phoenix, Toronto, Portland) — ran before `discovery_metro` column existed

### Pending
- User runs `scripts/backfill-pipeline-runs.sql` in Supabase SQL Editor
- Verify dashboard History page shows 7 runs and stat cards show aggregate totals

---

## 2026-02-21 (Session 52 — Fix Dashboard "Invalid API Key" Error)

### Dashboard Fix
- **Root cause:** Coolify build args may corrupt env var values (whitespace, newlines) during Docker rebuild. The JS bundle had the correct anon key character-for-character, but Coolify's build arg mechanism is unreliable for long JWT strings.
- **Fix:** Committed `dashboard/.env.production` with all three public env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_N8N_WEBHOOK_URL`). Vite reads `.env.production` during `npm run build` with higher priority than build args — eliminates the Coolify dependency entirely.
- **`.gitignore` updated:** Added `!dashboard/.env.production` exception so the file is tracked. The anon key is public by design (appears in every browser request to Supabase).

### Modified Files
- `dashboard/.env.production` (NEW) — Public env vars for Vite production build
- `.gitignore` — Exception for `dashboard/.env.production`
- `dashboard/.env` — Added missing `VITE_N8N_WEBHOOK_URL` value for local dev

### Pending
- User must run `scripts/dashboard-schema.sql` in Supabase SQL Editor (creates `pipeline_runs`, `search_query_templates`, `run_coverage_stats` view, RLS policies, `increment_completed_batches()` RPC)
- After Coolify redeploy: verify new JS bundle hash, test login, navigate dashboard pages

---

## 2026-02-21 (Session 51 — Deployment Verification + Snapshot Sync)

### Verification
- Confirmed all 3 n8n workflows (main, sub, error handler) are deployed and active with correct node counts and code.
- Compared deployed jsCode against local `scripts/nodes/` source files — all match.

### Bug Fix
- `scripts/nodes/track-batch-completion.js` — Synced to deployed version. Local file had inefficient contact counting (fetched ALL contacts, filtered in JS). Now uses Supabase server-side `company_id=in.(...)` filter.

### Snapshot Updates
- Pulled fresh workflow JSON for all 3 workflows into `workflows/current/`.
- Added new file: `workflows/current/error-handler-deployed.json` (Pipeline Error Handler).

---

## 2026-02-21 (Session 50 — Dashboard-Pipeline Integration)

### Workflow Changes (Main Workflow `yxvQst30sWlNIeZq` — 22→23 nodes)
- **Webhook node:** Changed from GET-only to GET+POST (multipleMethods). Dashboard sends POST with JSON body; legacy curl GET still works.
- **Metro Config rewrite:** Now reads POST body first (run_id, metro_name, lat/lng, radius, search_queries, yelp_location), falls back to GET query param + hardcoded 11-metro lookup for legacy triggers. Always outputs `run_id` (null for legacy).
- **Mark Running node (NEW):** Code node between Metro Config and Split Search Queries. PATCHes `pipeline_runs` to status='running' with started_at and n8n_execution_id. Skips if no run_id. Non-blocking error handling.
- **Batch Dispatcher:** Added run_id extraction from Metro Config, total_batches PATCH to pipeline_runs, and run_id in sub-workflow POST body. All additions guarded with `if (runId)`.
- **Error workflow:** Set `settings.errorWorkflow` to point at new Pipeline Error Handler workflow.

### Workflow Changes (Sub-Workflow `fGm4IP0rWxgHptN8` — 6→7 nodes)
- **Track Batch Completion node (NEW):** Terminal Code node after Mark Fully Enriched. Calls `increment_completed_batches()` RPC atomically. If last batch, queries metro totals and PATCHes pipeline_runs to status='completed'. Skips if no run_id.

### New Workflow: Pipeline Error Handler (`ovArmKkj1bs5Af3G`)
- Error Trigger → Mark Failed Code node. Looks up pipeline_runs by n8n_execution_id, PATCHes status to 'failed'.
- Set as errorWorkflow on main pipeline.

### Database Schema (SQL ready, not yet run)
- `scripts/dashboard-schema.sql` — Creates pipeline_runs table (with total_batches/completed_batches), search_query_templates table, run_coverage_stats view, RLS policies, `increment_completed_batches()` RPC function, and safety-net cron SQL.

### Dashboard Changes
- `src/types/index.ts` — Added `total_batches`, `completed_batches` to PipelineRun interface.
- `src/pages/DashboardPage.tsx` — Added 30s polling when active/queued run exists.
- `src/pages/NewRunPage.tsx` — Single-run enforcement: checks for running pipelines before triggering webhook. Creates queued run either way.
- `src/components/dashboard/ActiveRunBanner.tsx` — Shows batch progress bar ("Enrichment: 3/8 batches (38%)") during enrichment phase, "Discovery phase" before batches are set.

### New Files
- `scripts/nodes/mark-running.js` — Source for Mark Running node
- `scripts/nodes/track-batch-completion.js` — Source for Track Batch Completion node
- `scripts/dashboard-schema.sql` — Combined schema SQL for Supabase
- `workflows/backups/pre-dashboard-main-20260221.json` — Pre-change main workflow backup
- `workflows/backups/pre-dashboard-sub-20260221.json` — Pre-change sub-workflow backup

---

## 2026-02-21 (Session 49 — Production Baseline + Dashboard Handoff)

### Git Housekeeping
- **Production baseline snapshot:** Pulled fresh workflow JSON from n8n (main workflow `yxvQst30sWlNIeZq` + sub-workflow `fGm4IP0rWxgHptN8`). Committed all changes to `master` as commit `a2ec77c`.
- **Created `attempt-improve-enrichment` branch** from `master` for next phase of work.

### New Files
- `docs/HANDOFF-dashboard-integration.md` — Handoff document for the next major task: connecting the React dashboard to the n8n pipeline. Documents integration points, constraints, and prerequisites.

### Tracking Updates
- Updated PROGRESS.md, TODO.md, CHANGELOG.md with Session 49 entries.
- No new bugs found. No new ADRs needed.

---

## 2026-02-20 (Session 48 — Boise, ID Pipeline Re-Run)

### Pipeline Trigger
- **Boise, ID re-run** after SQL reset of `partially_enriched` companies from failed execs #143/#146
- Pre-flight checks passed: no running executions, both workflows active
- User ran SQL: `UPDATE companies SET enrichment_status = 'discovered' WHERE discovery_metro = 'Boise, ID' AND enrichment_status = 'partially_enriched'`

### Exec #242 Results (Boise, ID — FULL SUCCESS)
- **Status:** success, 6m 51s (411s), 22 nodes
- Discovery: 240 Google + 89 Yelp → 329 merged → 168 deduplicated → 165 inserted + 3 flagged
- Batch Dispatcher: **31.6s** — 165 companies, 7 batches of 25, 7/7 dispatched
- Sub-workflows #244-#250: ALL SUCCESS (7/7), 51-103s per batch
- Calculate Lead Scores: SUCCESS
- Run Summary5: SUCCESS

### Failed Executions (no damage)
- **Exec #241:** MCP `n8n_test_workflow` bug — stripped query params from webhook URL. Metro Config error.
- **Exec #243:** Accidental double-trigger — Apify memory exceeded (all memory used by #242's runs). Failed before data writes.

### Lesson Learned
- n8n MCP `n8n_test_workflow` tool does NOT forward query parameters in `webhookPath`. Use direct `curl` for GET webhooks with query params.

---

## 2026-02-20 (Session 47 — Nashville Exec #227 Aggregate Analysis)

### Research Only — No Code Changes
- **Full aggregate analysis** of Nashville TN exec #227 across all 13 sub-workflow batches (#228-#240)
- 8 batches inspected with full detail, 5 with structure-only (contact counts confirmed for all 13)
- Key findings: 324 companies enriched, 33 new contacts, 37 total enriched, 0 emails, 0 NamSor, 89 update errors (27.5%)
- Update errors investigation escalated from ~13% to 27.5% — needs priority investigation
- Tracking files updated with complete per-batch breakdown

## 2026-02-20 (Session 46 — Fix NamSor Guard + Nashville TN Re-run)

### Bug Fix
- **IMP-014 CODE FIX DEPLOYED:** Relaxed NamSor `cultural_affinity` guard in `enrich-contacts.js` line 448. Removed `&& (contact.last_name || '').length > 0` — guard now only requires `first_name`. Line 450 already sends `'Unknown'` as fallback last_name. Deployed to sub-workflow `fGm4IP0rWxgHptN8` via MCP `n8n_update_partial_workflow` (updateNode on `Enrich Contacts`).

### Nashville TN Exec #227 Results (SUCCESS)
- **Status:** success, 7m 52s (472s), 22 nodes
- Discovery: 239 Google + 95 Yelp → 334 raw → 158 unique → 156 inserted + 2 flagged
- Batch Dispatcher: 60.5s, 297 discovered companies, **9/13 batches dispatched** (partial_dispatch), 324 companies in batches of 25
- Calculate Lead Scores: SUCCESS
- Run Summary5: scoring_status SUCCESS

### Sub-workflow executions #228-#240 — ALL SUCCESS (13/13)
- All 13 executions completed with 6 nodes each
- Spot-check batch #228 (25 companies): 14 websites, 9 booking platforms, 1 paid ad. Find Contacts: 5 contacts (2 Apollo + 2 solo + 1 website). Phones verified (valid landline/mobile).
- Spot-check batch #233 (25 companies): 19 websites, 15 booking platforms, 3 paid ads. Find Contacts: 3 contacts (3 solo). Phones verified.
- Digital signals confirmed flowing: booking platforms, paid ads, Google Details

### NamSor API Failure (NEW FINDING — BUG-040)
- **NamSor `cultural_affinity` = null across ALL contacts in ALL batches**, including contacts with BOTH first AND last name (e.g., Melanie Joye, Laura Stendel).
- IMP-014 code fix is structurally correct (verified: old `last_name` guard is gone from deployed code), but NamSor API itself is returning no data.
- Likely cause: NamSor API key expired or service down. Try/catch silently catches errors.
- This is a separate issue from IMP-014 — the code fix is correct but unverifiable until NamSor API works.

### Modified Files
- `scripts/nodes/enrich-contacts.js` — Line 448: removed `last_name` guard from NamSor condition

### Handoff Doc Updated
- `docs/HANDOFF-namsor-nashville.md` created (Session 45) — plan followed for this session

---

## 2026-02-20 (Session 45 — Pre-Flight Check Rule + Austin TX Results + San Diego Re-run)

### New Rule
- **CLAUDE.md Rule 12: Pre-Flight Check Before Pipeline Triggers.** Mandatory check for running/recent executions before any webhook trigger. Must list main workflow and sub-workflow recent executions. Never re-trigger if unsure — wait and check again. Added to prevent double-trigger incidents (Sedona #181, Austin #212).

### Bug Logged
- **BUG-039 (MEDIUM, procedural):** Double-trigger incidents from missing pre-flight check. n8n execution list API has latency — new executions may not appear for several minutes after trigger. Operator assumed trigger failed and re-triggered. Prevention: Rule 12.

### Improvement Items
- **IMP-012:** Website email scraping has no counter in Enrich Companies stats.
- **IMP-013:** Company emails only get verified when a contact exists — companies with scraped emails but no contacts skip Hunter verification.
- **IMP-014:** NamSor cultural_affinity guard too strict — requires both `first_name` AND `last_name`, but ~90% of contacts are solo-detected with first_name only. NamSor effectively never called. Fix: relax guard to only require `first_name` (line 448 of `enrich-contacts.js`).

### Handoff Doc
- Created `docs/HANDOFF-namsor-nashville.md` — Fix IMP-014 (NamSor guard too strict) + verify with Nashville TN re-run. Includes exact before/after code change, deploy steps, pre-flight check, success criteria.

### Memory Updated
- Added "Pipeline Trigger Safety" section to MEMORY.md.

### Austin TX Exec #198 Results (SUCCESS)
- **Status:** success, 6m 12s, 22 nodes
- Discovery: 168 inserted + 3 flagged → 171 companies
- Batch Dispatcher: **60.5s** — 212 discovered, 9/13 batches dispatched (partial_dispatch), 314 companies
- Sub-workflows: 13 executions (#199-#211), all SUCCESS, 75-137s each
- Spot-check batch #203: 25 companies, 14 websites, 11 booking platforms, 8 update errors, 4 contacts inserted (2 Apollo + 1 solo + 1 website), phones verified
- Lead scoring: SUCCESS

### Exec #212 (Austin TX — CANCELLED)
- Double-trigger. Started 23:36:51 while #198's sub-workflows were still running. Cancelled by user at 23:38:08. May have dispatched 4 sub-workflow batches before cancellation — those 4 (#208-#211) all succeeded harmlessly (idempotent enrichment).

### San Diego CA Exec #213 Results (SUCCESS — Backfill Re-run)
- **Status:** success, 7m 34s (454s), 22 nodes
- Discovery: 178 unique → 177 inserted + 1 flagged
- Batch Dispatcher: **60.4s** — 216 discovered, 9/13 batches dispatched (partial_dispatch), 303 companies
- Sub-workflows: 10 executions (#214-#225), all SUCCESS, 20-139s each
- Spot-check batch #214: 25 companies, 18 websites, 15 booking platforms, 3 paid ads, 30 social profiles, 16 update errors. 4 contacts inserted (2 Apollo + 2 solo). Phone verification: valid mobile (Verizon), VoIP (Twilio).
- Spot-check batch #216: 25 companies, 19 websites, 17 booking platforms, 0 paid ads, 0 update errors. 5 contacts inserted (4 Apollo + 1 website).
- Spot-check batch #219: 25 companies, 18 websites, 17 booking platforms, 3 paid ads, 0 update errors. 1 contact inserted (Apollo).
- **Digital signals confirmed flowing:** booking platforms (~60-68%), paid ads (0-12%), Google Details (~92-96%), social profiles.
- **NamSor cultural_affinity: 0 across all batches** — all contacts have `_namsor_country: null`. Root cause: IMP-014 (guard too strict).
- Lead scoring: SUCCESS

---

## 2026-02-20 (Session 44 — Scottsdale, AZ Metro Expansion)

### New Metro
- **Scottsdale, AZ** added to Metro Config lookup table (latitude 33.4942, longitude -111.9261, 15km radius). 11th operational metro. ~20km east of Phoenix; overlap handled by google_place_id upsert.

### Modified Files
- `scripts/nodes/metro-config.js` — Added Scottsdale, AZ to METROS lookup

### Deployment
- Metro Config: MCP `updateNode` on main workflow `yxvQst30sWlNIeZq`

### Exec #189 Results (Scottsdale, AZ — FULL SUCCESS)
- **Status:** success, 6m 46s, 22 nodes
- Discovery: 239 Google + 84 Yelp → 196 unique → 193 inserted + 3 flagged
- Batch Dispatcher: **31.6s** — 193 companies, 8 batches, 8/8 dispatched
- Sub-workflows: 7 executions (#190-#197), all 6 nodes, 84-89s each, all SUCCESS
- Spot-check batch #193: 25 companies enriched, 0 update errors, 13 booking platforms, 6 contacts inserted (5 Apollo + 1 website), phones verified
- Lead scoring: SUCCESS

---

## 2026-02-20 (Session 43 — Sedona AZ Backfill Re-run)

### Backfill Run
- **Exec #180 (Main workflow — SUCCESS):** Re-ran Sedona AZ pipeline to backfill digital signal fields after Session 42 fixes. 125 companies inserted, 7 batches dispatched in 31.8s, all sub-workflows succeeded. Lead scoring SUCCESS.
- **Sub-workflow executions #182-#188:** 7/7 SUCCESS. 153 companies enriched across all batches. Digital signals confirmed flowing: booking platforms (37%), paid ads (14%), Google Details (74%).
- **Remaining issue:** ~13% Enrich Companies update_errors (10/78 sampled). Down from ~50-70% pre-Session 42 but not zero. Needs investigation.
- **Diagnostic SQL** at `scripts/diagnostic.sql` — user should re-run to verify before/after digital signals.

---

## 2026-02-20 (Session 42 — Pipeline Recovery: Fix Zero Digital Signals)

### Bug Fixes
- **BUG-036 (CRITICAL):** Insert to Supabase and Insert Flagged HTTP Request nodes dropped 8 fields from the insert payload: `google_rating`, `google_review_count`, `has_online_booking`, `booking_platform`, `has_paid_ads`, `estimated_size`, `on_yelp`, `on_groupon`. All digital signal fields were being computed by discovery normalization but silently dropped at the insert stage. Added all 8 fields to both node bodies via MCP.
- **BUG-037 (HIGH):** Enrich Companies PATCH payload included 4 nonexistent Supabase columns (`opening_hours`, `business_status`, `photo_count`, `price_level`). Caused ~50-70% update_errors in sub-workflow executions, leaving companies stuck at `partially_enriched`. Removed from PATCH payload in `enrich-companies.js`.
- **BUG-038 (HIGH):** 4 early-exit paths in enrichment Code nodes returned bare `[]` without `metro`/`company_ids`, breaking downstream nodes. Fixed to pass through `{ metro, company_ids: companyIds }`.

### Modified Files
- `scripts/nodes/enrich-companies.js` — Removed 4 nonexistent columns from PATCH payload; fixed early-exit propagation
- `scripts/nodes/find-contacts.js` — Fixed early-exit propagation
- `scripts/nodes/enrich-contacts.js` — Fixed early-exit propagation

### Deployment
- **Sub-workflow `fGm4IP0rWxgHptN8`:** 3 Code node updates via MCP `n8n_update_partial_workflow`
- **Main workflow `yxvQst30sWlNIeZq`:** 2 Insert node updates via MCP `n8n_update_partial_workflow` (8 new fields each)

### Snapshots Updated
- `workflows/current/deployed-fixed.json` — Main workflow (22 nodes)
- `workflows/current/sub-workflow-deployed.json` — Sub-workflow (6 nodes)

### Verification
- Sub-workflow test with 5 Sedona company IDs: webhook returned 200 OK, `company_count: 5`

### SQL Provided
- Backfill `on_yelp` from `source_urls` for existing companies
- Re-run metros to populate newly-saved fields (google_rating, booking_platform, etc.)

### Decisions
- **ADR-031:** Pipeline Recovery — Fix Zero Digital Signals

---

## 2026-02-20 (Session 41 — Diagnostic SQL + Root Cause Analysis)

### New Files
- `scripts/diagnostic.sql` — Single-SELECT diagnostic returning one JSON blob (9 sections). Run in Supabase SQL Editor → copy JSON → paste for analysis.
- `docs/HANDOFF-pipeline-recovery.md` — Comprehensive handoff doc for pipeline recovery. Includes: root cause analysis (Insert to Supabase drops 12 of 26 fields), investigation steps (inspect sub-workflow executions, compare San Diego), fix plan (update 2 HTTP node bodies, possibly fix enrichment code), success criteria.

### Root Cause Found
- "Insert to Supabase" HTTP Request node sends 14 fields, drops 12 — including google_rating, google_review_count, on_yelp, on_groupon, has_online_booking, booking_platform, has_paid_ads, estimated_size
- `on_yelp` and `on_groupon` are NEVER written to DB by any node
- 50/201 Sedona companies stuck in non-final enrichment status

---

## 2026-02-20 (Session 40 — Sedona SQL Rewrite for Supabase Compatibility)

### Modified Files
- `scripts/sedona-data-quality.sql` — **Complete rewrite.** Reduced from ~25 SELECT statements to 10 single-SELECT queries. Supabase SQL Editor only returns the last SELECT, so each query must be run individually. Consolidated related sub-queries using FILTER aggregates, CTEs, and UNION ALL.

### Queries (10 total)
1. **Q1: Executive Summary Scorecard** — 1 row, ~9 columns (scalar subqueries)
2. **Q2: Enrichment Status Breakdown** — GROUP BY enrichment_status
3. **Q3: Company Coverage + Digital Signals** — 1 wide row (~19 columns)
4. **Q4: Company Phone & Email Verification** — 1 wide row (~16 columns)
5. **Q5: Contact Overview by Source** — GROUP BY source
6. **Q6: Contact Channel Quality** — 1 wide row (~20 columns)
7. **Q7: Enrichment Depth + Sales Readiness** — CTE with contact buckets + channel flags
8. **Q8: Top 20 Leads** — CTE for best_contact ranking
9. **Q9: Data Quality Flags** — UNION ALL of 5 flag types (blocked_domain, email_mismatch, dead_lead, no_name_contact, stuck_status)
10. **Q10: Booking Platform Distribution** — GROUP BY booking_platform

---

## 2026-02-20 (Session 39 — Sedona AZ Data Quality Inspection)

### New Files
- `scripts/sedona-data-quality.sql` — 5-query data quality inspection script for Sedona AZ exec #170 output. Covers: enrichment overview, contact coverage, enrichment depth, sales-ready leads, data quality flags. Run in Supabase SQL Editor.

---

## 2026-02-20 (Session 38 — Sedona AZ E2E Test + Convergence Ordering Fix — ADR-030)

### New Metro
- **Sedona, AZ** added to Metro Config lookup table (latitude 34.8697, longitude -111.7610, 15km radius). 10th operational metro. Used as clean test for parallelized pipeline.

### Bug Fixes
- **BUG-034 (HIGH):** Batch Dispatcher timeout at 300s (Asheville NC exec #165). User set `N8N_RUNNERS_TASK_TIMEOUT=1800` in Coolify. Confirmed working: exec #167 ran 438s without timeout. Path A from plan confirmed — no code split needed.
- **BUG-035 (HIGH):** Convergence ordering — Insert Flagged (2 items, fast) fires Batch Dispatcher before Insert to Supabase (127 items) runs. ADR-024 guard blocks second trigger → Batch Dispatcher polls empty Supabase → 0 batches dispatched.
  - **Fix (ADR-030):** Removed `Insert Flagged (Needs Review)` → `Batch Dispatcher` connection. Batch Dispatcher now only receives from Insert to Supabase.

### Optimization
- **Phase 4 completion polling removed** from Batch Dispatcher. Sub-workflows are fire-and-forget; lead scoring recalculates from current Supabase data. Saves 15+ min per run.
- **Phase 1 discovery polling reduced:** 30 → 20 max iterations (450s → 300s max). Sufficient since Insert to Supabase is the only trigger now.

### Modified Files
- `scripts/nodes/metro-config.js` — Added Sedona, AZ to METROS lookup
- `scripts/nodes/batch-dispatcher.js` — Removed Phase 4 completion polling, reduced Phase 1 iterations, updated comments

### Deployment
- Metro Config: MCP `updateNode` on main workflow `yxvQst30sWlNIeZq`
- Batch Dispatcher: MCP `updateNode` on main workflow
- Connection removal: MCP `removeConnection` — `Insert Flagged (Needs Review)` → `Batch Dispatcher`

### Exec #167 Results (Sedona, AZ — partial success, pre-fix)
- **Status:** success, 13.3 min, 22 nodes
- Discovery: 240 Google + 97 Yelp → 129 unique → 128 inserted + 2 flagged
- Batch Dispatcher: **438s, 0 batches dispatched** (convergence ordering bug — Insert Flagged triggered first)
- 1800s timeout confirmed working (ran 438s > 300s default)

### Exec #170 Results (Sedona, AZ — FULL SUCCESS, post-fix)
- **Status:** success, 6.9 min, 22 nodes
- Discovery: 128 companies inserted (2.5s)
- Batch Dispatcher: **32 seconds** — 199 discovered companies, 8 batches of 25, 8/8 dispatched successfully
- Calculate Lead Scores: SUCCESS
- Run Summary5: scoring_status SUCCESS
- Sub-workflows: 8 executions (#171-#178 minus #176), all 6 nodes, ~72s each, BUG-033 fix verified

### Decisions
- **ADR-030:** Remove Insert Flagged → Batch Dispatcher connection + remove Phase 4 completion polling

## 2026-02-20 (Session 37 — Pre-Flight Fix: Webhook Body Unwrapping — BUG-033)

### Bug Fix
- **BUG-033 (CRITICAL):** n8n Webhook v2 wraps POST body under `$json.body`, but sub-workflow Code nodes read `$input.first().json.metro` directly. Every batch dispatch would fail with `missing metro in input` immediately. Since the sub-workflow already returned 200 (fire-and-forget), the main workflow's Batch Dispatcher would think dispatch succeeded, then timeout after 15 min of completion polling.
  - **Fix:** Added `const payload = inputData.body || inputData;` unwrap pattern to all 3 sub-workflow Code nodes (Enrich Companies, Find Contacts, Enrich Contacts). The `|| inputData` fallback preserves compatibility for legacy/main-workflow mode.
  - **Deployed:** MCP `n8n_update_partial_workflow` — 3 updateNode operations on sub-workflow `fGm4IP0rWxgHptN8`, all applied successfully.

### Modified Files
- `scripts/nodes/enrich-companies.js` — Lines 10-13: webhook body unwrap (primary fix)
- `scripts/nodes/find-contacts.js` — Lines 10-13: defensive unwrap
- `scripts/nodes/enrich-contacts.js` — Lines 10-13: defensive unwrap

### Regenerated Files
- `workflows/generated/sub-workflow.json` — Rebuilt from updated source files
- `workflows/backups/pre-batch-architecture-20260220-103855.json` — Auto-backup from build script

### Verification
- Sub-workflow `fGm4IP0rWxgHptN8` updated and confirmed active (6 nodes)
- All 3 Code nodes verified to contain the `inputData.body || inputData` unwrap pattern
- No SQL changes needed (schema already supports all required values)

## 2026-02-20 (Session 36 — Parallelized Batch Enrichment Architecture — ADR-029)

### Architecture
- **ADR-029: Parallelized Batch Enrichment.** Split monolithic pipeline into main workflow (22 nodes) + sub-workflow (6 nodes).
  - Main workflow: Discovery → Batch Dispatcher → Lead Scoring
  - Sub-workflow: Webhook → Respond to Webhook → Enrich Companies → Find Contacts → Enrich Contacts → Mark Fully Enriched
  - Batch Dispatcher replaces Collapse to Single2 + Run Summary + entire enrichment chain
  - 25 companies per batch, dispatched in parallel via `Promise.all()`
  - Sub-workflow returns 200 immediately (fire-and-forget), processes batch async

### Bug Fixes
- **BUG-031 (CRITICAL):** `$('Metro Config').first().json.metro_name` resolves incorrectly in convergence batch context → 0 discovered companies after 7.5 min polling. Fixed by reading metro from input items.
- **BUG-032 (HIGH):** Monolithic enrichment of 161 companies exceeds 300s task runner hard cap → Find Contacts only processes 27. Fixed by splitting into batches of 25 (each ~125-200s).
- **BUG-030 CONFIRMED:** Nashville exec #160 Insert to Supabase succeeded with 161 items, 0 constraint violations — dropped unique domain/phone indexes work.

### New Files
- `scripts/nodes/batch-dispatcher.js` — Batch Dispatcher Code node (~197 lines)
- `scripts/nodes/mark-fully-enriched.js` — Mark Fully Enriched Code node (~42 lines)
- `workflows/generated/sub-workflow.json` — Sub-workflow JSON (6 nodes)
- `workflows/current/sub-workflow-deployed.json` — Deployed sub-workflow snapshot

### Modified Files
- `scripts/nodes/enrich-companies.js` — Reads metro + company_ids from input (batch mode)
- `scripts/nodes/find-contacts.js` — Reads metro + company_ids from input (batch mode)
- `scripts/nodes/enrich-contacts.js` — Reads metro + company_ids from input, local dedup for parallel safety
- `scripts/nodes/metro-config.js` — Clears `_batch_dispatcher_fired` static data flag
- `scripts/build-simplified-workflow.py` — Generates both main and sub-workflow

### Deployment
- Sub-workflow created: ID `fGm4IP0rWxgHptN8`, webhook path `batch-enrichment-v1`, activated
- Main workflow updated: ID `yxvQst30sWlNIeZq`, 22 nodes (down from 27)
- Webhook URL: `http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/batch-enrichment-v1`

### Decisions
- **ADR-029:** Parallelized Batch Enrichment Architecture

### Pending
- User sets `BATCH_ENRICHMENT_WEBHOOK_URL` env var in Coolify
- Test with Nashville TN (or any metro)

## 2026-02-20 (Session 35 — Fix Franchise Chain Unique Constraint Bug)

### Bug Fix
- **BUG-030 (CRITICAL):** Companies table `idx_companies_domain` and `idx_companies_phone` unique constraints block franchise chain inserts. Portland OR exec #159 failed with 409 on `thenowmassage.com` — a franchise with multiple locations sharing one domain. Insert to Supabase's `onError: continueRegularOutput` swallows the 409 → 0 companies discoverable → pipeline produces nothing.
  - **Root cause:** Domain and phone are not unique across locations. Franchise chains share them. `google_place_id` is the only truly unique-per-location identifier.
  - **Fix (ADR-028):** Drop unique indexes on domain/phone, recreate as regular (non-unique) indexes for query performance. `google_place_id` stays unique (it's the upsert conflict key).

### Schema Change
- `docs/architecture/schema.sql` updated: `idx_companies_domain` and `idx_companies_phone` changed from `CREATE UNIQUE INDEX` to `CREATE INDEX`. Added explanatory comment about franchise chains.

### SQL Provided for User
1. Drop/recreate indexes (Supabase SQL Editor)
2. Clean Portland stale data from failed execs #158/#159

### Decisions
- **ADR-028:** Convert companies domain/phone unique indexes to non-unique

### Pending
- User runs SQL in Supabase
- Test with new metro (Nashville TN or Salt Lake City UT)
- Re-run Portland after cleanup

## 2026-02-20 (Session 34 — Pipeline Simplification: 127 → 27 Nodes)

### Architecture
- **ADR-027: Collapse Steps 2 & 3a into single Code nodes.** Reduced workflow from 127 to 27 nodes.
  - `Enrich Companies` Code node replaces ~40 branching nodes (Step 2 + Step 3b)
  - `Find Contacts` Code node replaces ~25 branching nodes (Step 3a)
  - `Enrich Contacts` modified with inline Supabase fetch + filter/merge
  - `Run Summary4` modified with embedded config (no Step 4 Config reference)
  - `Metro Config` modified — removed stale collapse flag cleanup for deleted nodes
- **Eliminated:** 3 Collapse nodes, 3 Bridge nodes, 4 Config Set nodes, 2 intermediate Run Summaries, ~100 branching nodes
- **Kept:** Step 1 discovery (21 nodes), Collapse to Single2 (stabilization polling), Calculate Lead Scores, Run Summary5
- **Pipeline:** Webhook → Metro Config → Discovery → Collapse to Single2 → Enrich Companies → Find Contacts → Enrich Contacts → Run Summary4 → Calculate Lead Scores → Run Summary5

### New Files
- `scripts/build-simplified-workflow.py` — Assembly script (reads MCP output, builds simplified JSON)
- `scripts/deploy-simplified.py` — Direct REST API deploy script
- `scripts/nodes/metro-config.js` — Modified Metro Config code
- `scripts/nodes/enrich-companies.js` — NEW: ~540-line Code node (Step 2 + 3b)
- `scripts/nodes/find-contacts.js` — NEW: ~615-line Code node (Step 3a)
- `scripts/nodes/enrich-contacts.js` — Modified: inline fetch/merge + embedded config
- `scripts/nodes/run-summary4.js` — Modified: embedded config

### Deployment
- Deployed via `scripts/deploy-simplified.py` — 117KB payload, HTTP 200
- Backup at `workflows/backups/pre-simplification-20260220-075736.json`
- **PREREQUISITE:** `N8N_RUNNERS_TASK_TIMEOUT=1800` needed in Coolify before testing

## 2026-02-20 (Session 33 — Fix Collapse to Single1 Timing Gap: ADR-026)

### Bug Fix
- **BUG-029 (CRITICAL):** Collapse to Single1 fires on the first company to exit Step 2, causing Step 3a to start before Step 2 finishes. For brand-new cities, Step 3a sees only ~5-10 of ~200 companies (~95% missed). A second run was required to pick up the rest.
  - **Fix (ADR-026):** Added stabilization polling to Collapse to Single1 — same pattern as ADR-025 (Collapse to Single2), but inverted. Polls Supabase every 15s counting `discovered` companies for the current metro. When count reaches 0 and stays at 0 for 30s, Step 2 is done. Max 80 iterations (20 min).
  - **Deployed:** MCP `n8n_update_partial_workflow` — single updateNode on `Collapse to Single1`.

### Metro Added
- **Portland, OR** added to Metro Config lookup table (latitude 45.5152, longitude -122.6784, 15km radius).

### Verification
- Portland, OR test run triggered (exec #158) — first brand-new city run with ADR-026 active.

## 2026-02-20 (Session 32 — Fix Collapse to Single2 Race Condition: BUG-028)

### Bug Fix
- **BUG-028 (CRITICAL):** Collapse to Single2 stabilization polling (ADR-025) allowed `count === 0` to be a stable state. When n8n task runner schedules Insert to Supabase after the polling loop (task runner contention), the polling sees 0 discovered companies, stabilizes at 0 after 30s, and triggers Step 2 with empty data. San Diego exec #156 completed `status: success` but Steps 2-5 processed 0 companies despite 170 records in Supabase.
  - **Fix 1:** Added `&& count > 0` to stability check — polling continues until companies actually appear in Supabase.
  - **Fix 2:** Increased max iterations from 10 to 30 (450s max) — gives Insert to Supabase ample time under heavy task runner load.
  - **Deployed:** MCP `n8n_update_partial_workflow` — single updateNode on `Collapse to Single2`.

### Exec #157 Results (San Diego, CA — BUG-028 Verification)
- **Status:** All 83 nodes succeeded (`stoppedAt: null` — known BUG-F024 pattern, all data in Supabase)
- Collapse to Single2: `_discovered_count: 186` (was **0** in exec #156), 45s polling
- Discovery: 192 unique records (112 Google, 97 Yelp, 17 overlap), 1 flagged
- Step 2: **186 companies enriched**, 124 websites, 198 social profiles, 91 booking platforms
- Step 3a: 143 companies, 28 solo, 6 contacts inserted
- Step 4: 28 contacts, 27 updated, **0 errors** — 26 phones valid, 1 VoIP, 27 company phones, 21 company emails verified
- Step 5: Lead scoring SUCCESS

## 2026-02-20 (Session 31 — Step 1→2 Timing Fix: ADR-025 Stabilization Polling)

### Bug Fix
- **BUG-027 (HIGH):** Yelp companies stuck in `discovered` status after ADR-024 convergence batch suppression. Google results arrive fast (~5s), flow through Insert → Collapse to Single2 (fires) → Step 2 starts. Yelp results arrive 60-120s later → Collapse to Single2 (suppressed) → those companies never get enriched.
  - **Root cause:** `Merge All Sources` fires per-input, and ADR-024 suppresses all batches after the first. The first batch is always Google (faster), so Yelp companies are permanently skipped.
  - **Fix (ADR-025):** Added stabilization polling in Collapse to Single2 — after setting the ADR-024 suppression flag, polls Supabase every 15s counting `discovered` companies. When count is stable for 30s, all inserts are done and Step 2 begins with ALL companies available.

### SQL Change
- **`scripts/actionable-leads.sql`:** Removed `enrichment_status IN ('fully_enriched', 'partially_enriched')` filter. Now shows all companies with any outreach channel regardless of enrichment status (`WHERE co.discovery_metro IS NOT NULL`).

### Exec #155 Results (Austin TX — ADR-025 Verification)
- **Status:** success, 89 nodes, 18m 47s
- Collapse to Single2: stabilization polling took ~45s (3 poll cycles), `_discovered_count: 118`
- Discovery: 184 unique records (108 Google, 91 Yelp, 15 overlap), 4 flagged
- Step 2: **216 companies enriched** (118 newly discovered + 98 partially_enriched) — 151 websites fetched, 259 social profiles, 118 booking platforms
- Step 3a: 96 companies processed, 4 solo detected, 1 contact inserted, Apollo 0 searched (all previously searched)
- Step 3b: 100 social profiles fetched
- Step 4: 70 contacts processed, 4 updated, **0 errors** — Phone: 3 valid, 1 VoIP, 4 company phones verified, 3 company emails verified, 4 phones added
- Step 5: Lead scoring SUCCESS

## 2026-02-20 (Session 30 — Convergence Batch Suppression)

### Optimization
- **ADR-024: Convergence batch suppression** — Added `$getWorkflowStaticData('global')` guards to `Collapse to Single2` and `Collapse to Single1` to prevent redundant downstream execution. Each Collapse node now fires exactly once per execution, regardless of how many convergence paths feed into it.
- **Per-contact dedup in Enrich Contacts** — Added `staticData._enriched_contact_ids` tracking to skip contacts already enriched in earlier convergence batches. Contacts are now enriched exactly once even when Step 4 runs multiple times.
- **Metro Config static data cleanup** — Clears all convergence-suppression flags at start of each execution to prevent cross-execution state leakage.

### Results
- Step 4 batches reduced from ~9 to 4 (and dedup eliminates redundant work in remaining batches)
- Exec #154 (Austin TX): **first clean `status: success` execution** — 17m 7s, 92 nodes, zero runner crashes, execution properly finalized

### Exec #154 Results (Austin TX)
- Discovery: 187 unique records (239 Google, 95 Yelp)
- Step 2: 186 companies enriched (131 websites fetched, 104 booking platforms, 238 social profiles)
- Step 3a: 70 companies processed, 2 solo contacts, 15 Apollo enriched, 17 total contacts inserted
- Step 3b: 100 social profiles fetched
- Step 4: 59 contacts enriched (2 updated, 57 no changes), 0 errors
- Step 5: Lead scoring SUCCESS

## 2026-02-19 (Session 29 — Fix Task Runner Crash Loop + Convergence Fix)

### Bug Fixes
- **BUG-F024 (CRITICAL):** n8n JS Task Runner crash loop caused by stuck execution #147. All 84 nodes completed but execution remained in `status: running`. Runner entered infinite crash-restart cycle receiving stale expired tasks. Survived multiple Coolify restarts.
  - **Root cause:** Multi-path convergence (7 paths to Run Summary1) left secondary batch tasks queued after runner context expired
  - **Fix:** User cancelled exec #147 from n8n UI. Runner re-registered cleanly, crash loop broken.
  - **No data loss:** All Supabase writes completed before the execution got stuck

- **BUG-F025 (HIGH):** `Insert Flagged (Needs Review)` was the only Insert HTTP node without `onError: continueRegularOutput`. Exec #148 crashed at 18/84 nodes due to 409 phone uniqueness conflict.
  - **Fix:** Applied `onError: continueRegularOutput` via MCP.

- **BUG-F026 (CRITICAL):** Run Summary1 convergence crash loop — systemic, not one-time. Exec #149 also completed all 78 nodes but got stuck, causing same crash loop. Root cause: 7-path convergence on Run Summary1 creates secondary execution batches that the Task Runner can't handle.
  - **Fix (ADR-022):** Added `Collapse to Single1` Code node between the 7 convergence paths and Run Summary1. Same pattern as existing `Collapse to Single` in Step 4. Reduces 7 batches to 1 item before Run Summary1. Workflow now 125 nodes.

### Exec #147 Results (Austin TX — completed before stuck)
- Discovery: 178 unique records (103 Google, 91 Yelp)
- Step 3a: 46 companies, 1 new contact
- Step 4: 34 contacts, 2 updated, 0 errors
- Step 5: Lead scoring SUCCESS

### Exec #149 Results (Austin TX — completed but stuck again)
- Discovery: 180 unique (239 Google, 96 Yelp), 2 flagged
- Step 2: 97 companies enriched, 4 backfilled
- Step 3a: 44 companies, 24 Apollo searches, 0 contacts
- Step 4: 68 contacts enriched
- Step 5: Lead scoring SUCCESS
- All 78 nodes succeeded, runner crash loop triggered after

### Key Finding
- Contacts table has grown to ~19,400 rows across 6 metros
- `Fetch Existing Contacts` returns 77,812 items due to 4x convergence batching — dedup handles it but increasingly wasteful

## 2026-02-19 (Session 28 — Revert Session 27 + Correct Tracking)

### Revert: Session 27 Changes (BUG-F023 was invalid)
- **Session 27 deployed a "performance fix" based on false premises:**
  - Claimed `Fetch Existing Contacts` returned "147,195 items" — actual Supabase contacts table has ~197 rows
  - Claimed Boise exec #146 took 1h21m due to slow contact fetch — exec #146 had `executedNodes: 0` (worker retry, never ran)
  - In exec #141 (last successful run), `Fetch Existing Contacts` completed in **661ms** — not a bottleneck
- **Reverted 2 nodes to pre-Session 27 state:**
  1. `Filter & Parse Batch`: Restored `$input.all()` (removed inline HTTP fetch)
  2. `Fetch Existing Contacts`: Restored original URL without `&limit=1`
- **Deleted false entries:** BUG-F023, ADR-021
- **Reopened IMP-004** as deferred (not a current problem with ~200 contacts)

### Root Cause: Boise Failures
- **Apify memory (#143):** 12 queries × 4096MB exceeded 32GB account limit
- **n8n worker instability (#142, #144, #145, #146):** Executions never start or timeout — infrastructure issue

## 2026-02-19 (Session 26 — Apollo 429 Fix + Boise Metro + Enrichment Gap Fix)

### Bug Fix: Apollo 429 Rate Limiting
- **Apollo People Search** now processes contacts in batches of 3 with 2-second delay between batches
- Previously: all contacts sent simultaneously → 429 rate limit on all requests
- Confirmed working in San Diego (#141) and Boise (#146) — zero 429 errors

### New Metro: Boise, ID
- Added to METROS lookup table in Metro Config Code node
- 174 businesses discovered (102 Google, 89 Yelp)
- Config: 12 search queries, Yelp searchLimit 100, 25km radius, lat 43.6150, lng -116.2023

### Scaled Search Config (ADR-018)
- Search queries increased from 5 to 12 per metro (added: "therapeutic massage", "deep tissue massage", "sports massage", "prenatal massage", "massage near me", "licensed massage therapist", "bodywork")
- Yelp searchLimit increased from 20 to 100
- Per-metro radius: Austin/Denver/Phoenix 15km, Toronto/San Diego 15km, Boise 25km
- batch_size raised: 100 → 300 → 1000 (across Enrichment Config, Step 3a Config, Step 4 Config)

### Bug Fix: Enrichment Gap (ADR-020)
- **Problem:** Boise discovered 174 companies but Step 2 only enriched 50. Failed runs (#143, #144) left companies at `partially_enriched` status, and Fetch Batch only fetched `discovered`.
- **Fix:** Changed `Fetch Batch from Supabase` URL filter from `enrichment_status=eq.discovered` to `enrichment_status=in.(discovered,partially_enriched)`. Pipeline is idempotent — re-enriching partially_enriched companies just fills in missing data.

### Finding: Company Phone as Primary Contact (ADR-019)
- Apollo returns ~0% contacts for local massage therapy businesses
- Company phone from Google Places is the primary outreach channel
- Solo practitioner detection + about page scraping provide some contact names, but personal email coverage is minimal

### Decisions
- **ADR-018:** Scaled search config — 12 queries, Yelp 100, per-metro radius
- **ADR-019:** Company phone as primary contact channel
- **ADR-020:** Resilient enrichment fetch — include partially_enriched companies

### Workflow Snapshot
- `workflows/current/deployed-fixed.json` updated (124 nodes)

## 2026-02-19 (Session 25 — Dynamic Metro Config + San Diego Pipeline)

### New Feature: Dynamic Metro Config
- **Metro Config** node converted from static Set node to dynamic Code node
- Reads `metro_name` from webhook query parameter: `?metro_name=San Diego, CA`
- Built-in METROS lookup table with 5 metros: Austin TX, Denver CO, Phoenix AZ, Toronto ON, San Diego CA
- Throws descriptive error for missing/unknown metro names
- Output shape identical to previous Set node — all downstream nodes unchanged
- No more manual MCP config changes between metro runs

### Cleanup
- Removed disconnected "When clicking 'Execute workflow'" manual trigger node (125 → 124 nodes)

### San Diego Pipeline Verification
- **Exec #140 — All 5 steps SUCCESS, 0 update errors**
  - 81 San Diego businesses discovered (63 Google, 20 Yelp)
  - 79 companies enriched, 59 websites, 106 social profiles
  - 12 contacts processed, 10 phones verified valid, 10 company phones verified, 7 company emails verified
  - Lead scoring: SUCCESS
- Apollo 429 rate limited (existing issue from prior runs)

### Decisions
- **ADR-017:** Dynamic Metro Config — webhook-driven metro selection with METROS lookup table

### Workflow Snapshot
- `workflows/current/deployed-fixed.json` updated (124 nodes)

## 2026-02-19 (Session 24 — BUG-F020 Fix + Phoenix Pipeline Verification)

### Bug Fix
- **BUG-F020 (CRITICAL):** `Prepare for Supabase` missing `discovery_metro` from field whitelist.
  - All new discoveries inserted with `discovery_metro = NULL`
  - Companies invisible to metro-scoped fetch nodes in Steps 2-5
  - **Fix 1:** Added `discovery_metro` to Prepare for Supabase whitelist via MCP
  - **Fix 2:** SQL backfill — Phoenix (121 companies + 10 AZ suburbs), Denver, Austin, Toronto
  - **Fix 3:** Verified auth headers, metro filters, bridge connections, alwaysOutputData

### Phoenix Pipeline Verification
- **Exec #139 — All 5 steps SUCCESS, 0 update errors**
  - 76 Phoenix businesses discovered (59 Google, 19 Yelp)
  - 71 companies enriched, 43 websites, 73 social profiles
  - 20 contacts processed, 19 phones verified valid, 19 company phones verified, 12 company emails verified
  - Lead scoring: SUCCESS
- **Note:** Apollo 429 rate limited (prior dashboard runs exhausted quota). 1x 409 on franchise domain (elementsmassage.com).

### Decisions
- **ADR-016:** Prepare for Supabase field whitelisting audit — new fields must be added to all insert chain nodes

### Workflow Snapshot
- `workflows/current/deployed-fixed.json` updated (125 nodes)

## 2026-02-19 (Session 22 — Fix BUG-F019 + Full E2E Verification)

### Bug Fix
- **BUG-F019 (HIGH):** Company phone verification permanently blocked by stale static data.
  - `$getWorkflowStaticData('global')._companyEmailsSet` persists across executions, not just batches
  - Exec #129 set `_phone_verified` keys that permanently blocked all future company phone verification
  - **Diagnostic:** Added `_company_phone_debug` to capture runtime condition values → confirmed `c4` (stale dedup key) was the only failing condition
  - **v1 fix:** Clear `_phone_verified` keys at start of each execution
  - **v2 fix:** Clear ALL stale keys from `companyEmailsSet` at start — prevents any static data accumulation across runs
  - **Verification:** Exec #131 — `company_phones_verified: 8` (was 0), `update_errors: 0`

### Scripts Created
- `scripts/add-diagnostic.py` — Inserts diagnostic code into Enrich Contacts
- `scripts/deploy-diagnostic-api.py` — Deploys code changes via n8n REST API
- `scripts/fix-company-phone.py` — v1 fix deployment
- `scripts/fix-company-phone-v2.py` — v2 fix deployment (clears ALL stale keys)
- `scripts/restore-production-config.py` — Restores batch_size=100 in Step 4 Config

### Config Restored
- Step 4 Config `batch_size` restored to `100` (was `10` during testing)

### Full Pipeline E2E Verification
- **Exec #132 — 0 ERRORS across all 5 steps:**
  - Step 1: 59 unique records (45 Google + 19 Yelp), 1 flagged
  - Step 2: 45 companies enriched, 34 websites, 81 social profiles
  - Step 3b: 100 social profiles (all previously enriched)
  - Step 3a: 35 companies, 24 Apollo searched, 0 new contacts (Austin saturated)
  - Step 4: 48 contacts, 40 updated. Phone: 32 valid, 8 VoIP, 40 company phones
  - Step 5: Lead scoring SUCCESS
- All 5 APIs active and verified: Apollo, NamSor, Hunter Verifier, Hunter Finder, Telnyx

### Decisions
- **ADR-015:** Static data lifecycle — clear `companyEmailsSet` at start of each execution

## 2026-02-19 (Session 21 — Telnyx Phone Verification Test Run)

### Phone Verification Verified
- **Exec #129 (SUCCESS):** First Telnyx phone verification test run
  - Config: `skip_phone_verifier="false"`, all other enrichments skipped, `batch_size="10"`
  - **9 contacts processed, 9 phones verified as valid, 0 errors**
  - Line types: 2 mobile (Cingular Wireless, T-Mobile), 7 landline (Bandwidth.com)
  - Telnyx API cost: ~$0.027 (9 lookups × $0.003)
  - Execution time: 2.9s for Enrich Contacts node (~300ms per lookup)

### Config Restored
- **Step 4 Config** restored to full production: `batch_size="100"`, `skip_phone_verifier="false"` (stays enabled), all other enrichments re-enabled
- Phone verification is now active in production pipeline

### Minor Finding
- `company_phones_verified: 0` despite companies having null `phone_status`. Contact phone verification works perfectly but company-level verification may have a code path issue. Logged for investigation.

## 2026-02-18 (Session 20 — Telnyx Phone Verification)

### New Feature: Phone Verification (Level 2)
- **Telnyx Number Lookup API** integration added to Step 4 Enrich Contacts
- Verifies both contact phones and company phones ($0.003/lookup)
- Controlled by `skip_phone_verifier` toggle (starts disabled — needs Telnyx account + API key first)
- Maps Telnyx responses to: `valid`, `invalid`, `disconnected`, `voip`
- Line types: `mobile`, `landline`, `voip`, `toll_free`
- Invalid/disconnected phones → `phone_direct` set to null (status preserved for audit trail)
- Company phone dedup guard: uses `companyEmailsSet[companyId + '_phone_verified']` to prevent duplicate Telnyx calls

### Schema Changes (user runs in Supabase)
- `scripts/deploy-phone-verification.sql`:
  - **contacts:** `phone_status`, `phone_verified_at`, `phone_line_type`, `phone_carrier`
  - **companies:** `phone_status`, `phone_line_type`
  - Partial index `idx_contacts_phone_status` on contacts with phone but no verification

### n8n Node Updates (6 total)
1. **Step 4 Config:** Added `skip_phone_verifier="true"` assignment
2. **Fetch Contacts:** Expanded OR filter to include `and(phone_direct.not.is.null,phone_status.is.null)`. Added phone fields to select.
3. **Fetch Companies1:** Added `phone_status,phone_line_type` to select
4. **Filter & Merge Contacts:** Added `phoneNeedsVerification` to enrichment filter. Passes through `_company_phone_status`, `_company_phone_line_type`.
5. **Enrich Contacts:** Added `verifyPhone()` helper, contact phone block, company phone block with dedup guard. Modified update payload to include phone verification fields.
6. **Run Summary4:** Added `phone_verification` section with 5 counters (valid, invalid_removed, voip_flagged, disconnected_removed, company_phones_verified)

### Documentation
- **ADR-014:** Telnyx phone verification strategy
- Updated `docs/architecture/schema.sql` with new columns
- Updated `docs/features/phone-verification-strategy.md` Level 2 status (implemented)

### Prerequisites Before Enabling
1. Create Telnyx account and get API key
2. Add `TELNYX_API_KEY` to n8n environment variables in Coolify
3. Run `scripts/deploy-phone-verification.sql` in Supabase SQL Editor
4. Flip `skip_phone_verifier` from "true" to "false"

## 2026-02-18 (Session 19 — Outreach CSV Export)

### New File
- **`exports/outreach-ready.sql`:** SQL query to extract outreach-ready companies and contacts from Supabase. LEFT JOINs companies with contacts, filters to rows with at least one contact channel (contact_email, contact_phone, company_phone, or company_email), excludes `needs_review` companies, sorted by lead_score DESC. Run in Supabase SQL Editor and use "Download CSV".

### Cleanup
- **Deleted temp workflow `xd9ox5wghRgQfZar`** ("TEMP - Outreach CSV Export") from n8n instance.

## 2026-02-19 (Session 18 — Denver Verification Run + Tracking Cleanup)

### Verification Run
- **Exec #125 (SUCCESS):** Denver, CO verification run via webhook trigger. ~7 min total.
  - **Discovery:** 76 unique businesses (62 Google, 20 Yelp, 6 overlap)
  - **Step 2 enrichment:** 61 companies processed, 48 websites fetched, 86 social profiles created
  - **Google Details PASS:** 50 items through Google Places Details API (opening hours, business status, photo count)
  - **Step 3a contacts:** 52 companies processed, Apollo searched 45 → 0 people found, 45 about pages scraped → 0 names (multi-path code ran correctly, no parseable name matches in Denver businesses), 0 new contacts
  - **Step 4 enrichment:** 17 Denver contacts processed, 0 updated (all previously enriched), **0 errors**
  - **Metro scoping PASS:** Filter & Merge Contacts output all Denver companies only (verified in sample data: Atwood Therapeutics Denver, Heavy Elbow BodyWork Denver). Zero cross-metro contamination.
  - **Lead Scoring PASS:** SUCCESS
- **Metro Config restored** to Austin, TX after verification.
- **Note:** Exec #124 (Austin, TX config) appeared between sessions — triggered externally, not part of our verification.

### Tracking Cleanup
- Corrected Session 17 exec #123 stats to match actual Run Summary data: discovery was 62 Google (not 100), website_names_found was 0 (not 2), apollo_searched was 0 (all previously searched)

## 2026-02-19 (Session 17 — Pipeline Quality Audit: Metro Scoping + About Page Fix)

### Bug Fixes
- **BUG-F017 (CRITICAL):** Metro-scoped pipeline execution — Added `discovery_metro` filter to `Fetch Companies` (Step 3a) and `Fetch Companies1` (Step 4). Added company-exists filter in `Filter & Merge Contacts` to exclude contacts from other metros. Previously, Steps 3a/4 processed ALL companies/contacts globally, causing cross-metro contamination (Denver run processed Austin contacts).
- **BUG-F018 (HIGH):** Multi-path about page scraping — Updated `Parse About Page` to try 6 URL paths (`/about`, `/about-us`, `/about-me`, `/our-team`, `/team`, `/our-story`) instead of just `/about`. Uses `this.helpers.httpRequest()` loop for fallback paths after the upstream `/about` HTTP node response.

### Schema Change
- **Added `discovery_metro` column** to companies table (`TEXT`, nullable). Backfilled existing data: Austin companies → "Austin, TX", Denver companies → "Denver, CO". Added index `idx_companies_discovery_metro`.
- **Updated Insert to Supabase + Insert Flagged** to include `discovery_metro` in their JSON payload. Previously the field was computed by Normalize nodes but never saved.

### Config Changes
- **Google Details enabled:** Flipped `skip_google_details` from `"true"` to `"false"` in Enrichment Config. Now fetches Google Places Details API data (opening hours, business status, photo count, price level).

### Deployment
- **Batch 1 (metro scoping, 3 ops):** `updateNode` Fetch Companies + Fetch Companies1 (URL) + Filter & Merge Contacts (jsCode) via single MCP call
- **Batch 2 (about page, 1 op):** `updateNode` Parse About Page (jsCode)
- **Batch 3 (toggle, 1 op):** `updateNode` Enrichment Config (full parameters replacement)
- **Batch 4 (metro switch):** Metro Config → Denver, CO for verification run
- **Batch 5 (schema fix, 2 ops):** `updateNode` Insert to Supabase + Insert Flagged (add discovery_metro to JSON payload)

### Verification Run
- **Exec #122 (FAILED):** First attempt after metro scoping deploy. `discovery_metro` column didn't exist in Supabase — field was computed by Normalize nodes but never saved by Insert nodes (explicit JSON body whitelist).
- **Schema fix:** User ran `ALTER TABLE companies ADD COLUMN discovery_metro TEXT` + backfill + index. Updated Insert to Supabase + Insert Flagged to include `discovery_metro` in payload.
- **Exec #123 (SUCCESS):** Denver verification run confirming metro scoping and schema fix:
  - **Metro scoping PASS:** Fetch Companies returned Denver-only companies. Filter & Merge → 16 Denver contacts. Zero cross-metro contamination.
  - **Step 3a:** 53 companies processed, 1 solo contact with name, Apollo searched 0 (all previously searched), website scraped 0 (all previously scraped), 1 contact inserted
  - **Step 4 enrichment:** 16 Denver contacts processed, 1 updated (NamSor + phone), 1 company email verified, 0 errors
  - **Lead Scoring:** SUCCESS
- **Metro Config switched back** to Austin, TX.

### Documentation
- **ADR-013:** Metro-scoped pipeline execution
- **Improvement Opportunities (IMP-001 through IMP-011):** Catalogued 11 enhancement ideas in BUGS.md for future reference

## 2026-02-19 (Session 16 — Quick Fixes + Denver CO Pipeline Run)

### Bug Fixes
- **BUG-F016 (BUG-006 CLOSED):** Phone validation — `validatePhone()` in Enrich Contacts now rejects NA numbers > 11 digits. International numbers allowed up to ITU max of 15 digits.
  - Before: `else if (cleaned.length > 11) { return '+' + cleaned; }` — any long number accepted
  - After: Numbers > 11 digits starting with '1' (NA) → null. Non-'1' prefix up to 15 digits → allowed. Over 15 → null.

### New Feature: Business Type Blocklist
- **10-keyword blocklist** added to both discovery normalization nodes:
  - Keywords: school, college, university, association, federation, union, board of, institute, academy, program
  - `Normalize Google Results`: Returns null (filtered by `.filter(Boolean)`) for matching businesses
  - `Normalize Yelp Results`: Uses `continue` to skip matching businesses in the for loop
  - Filters run BEFORE Supabase insert — non-targets never enter the database

### Denver, CO Pipeline Run
- **Metro Config switched** from Austin, TX to Denver, CO (39.7392, -104.9903, radius 10km)
- **Exec 121 (SUCCESS):** 14m 35s, 0 errors
  - Step 1: 76 unique businesses (62 Google, 20 Yelp, 6 overlap). Business names look clean — no schools or associations.
  - Step 2: 74 companies enriched, 59 websites fetched, 47 booking platforms detected, 107 social profiles
  - Step 3a: 40 companies processed, Apollo searched 24 → **0 people found** (data coverage gap for Denver massage businesses)
  - Step 4: 37 existing contacts processed (Austin holdovers), 0 updated, 0 errors
  - Step 5: Lead scoring SUCCESS — Denver companies scored
- **Metro Config switched back** to Austin, TX after verification

### Deployment
- **Atomic call #1 (fixes):** 2x `updateNode` via MCP — Normalize Google + Normalize Yelp (business type blocklist)
- **Separate call:** 1x `updateNode` — Enrich Contacts (phone validation fix)
- **Atomic call #2 (metro):** 1x `updateNode` — Metro Config (Denver → Austin round-trip)
- **MCP lesson:** `updateNode` operations require `nodeName` field (not `name`)

### Decisions
- **ADR-012:** Business type blocklist strategy

## 2026-02-19 (Session 15 — Step 5: Lead Scoring)

### SQL Objects Deployed (user-executed in Supabase SQL Editor)
- **`scoring_rules` table:** 6 starter rules (on_groupon +15, no_website +10, no_booking +10, solo +20, paid_ads +5, low_reviews +5). RLS enabled with service_role policy.
- **`calculate_lead_scores()` function:** Resets all scores to 0, loops through active rules, applies each as dynamic UPDATE. `SECURITY DEFINER` + `WHERE TRUE` (required by Supabase PostgREST).
- **`high_priority_leads` view:** Joins companies with owner contacts, ordered by lead_score DESC.

### n8n Nodes Added (2 nodes + 3 connections)
- **`Calculate Lead Scores`** (HTTP Request): POST to `$env.SUPABASE_URL/rest/v1/rpc/calculate_lead_scores`, `neverError: true` so scoring failure doesn't break pipeline.
- **`Run Summary5`** (Code): Logs scoring success/failure, follows Run Summary 1-4 pattern.
- **Connections:** `Run Summary4` → `Calculate Lead Scores` ← `No Records - Done3` → `Calculate Lead Scores` → `Run Summary5`
- **Workflow:** 123 → 125 nodes

### Bug Encountered & Fixed
- **Error 21000:** Supabase PostgREST blocks bare `UPDATE ... SET` without WHERE clause. Fixed by adding `WHERE TRUE` to reset statement + `SECURITY DEFINER` to bypass RLS.

### Verification
- **Exec 119:** Pipeline completed, scoring failed (error 21000 — pre-fix). Run Summary5 correctly caught failure.
- **Exec 120 (SUCCESS):** Full pipeline, ~8 min. `Calculate Lead Scores` returned `{}` (void = success). `Run Summary5`: `scoring_status: "SUCCESS"`. All company lead_scores recalculated.

### Decisions
- **ADR-011:** Supabase RPC for lead scoring (Option A)

### Schema Docs
- Updated `docs/architecture/schema.sql`: `WHERE TRUE` + `SECURITY DEFINER` on `calculate_lead_scores()`

## 2026-02-18 (Session 14 — Doc Cleanup + Production Readiness Assessment)

### Doc Cleanup
- **BUGS.md:** Removed 3 stale stubs from Open section (BUG-002, BUG-003, BUG-004 — all already fixed as BUG-F014, BUG-F013, BUG-F015). Open section now only contains BUG-005 (MEDIUM) and BUG-006 (LOW).
- **TODO.md:** Updated "Fix booking platform domains" description — removed stale "Existing data needs SQL remediation" (completed in Session 13).
- **PROGRESS.md:** Replaced "What's Broken" strikethrough list with clean status: no blocking bugs, 2 remaining quality items. Removed completed Next Steps items.

### Production Readiness Assessment
- **Verdict: No blocking bugs.** Pipeline runs cleanly (exec 118: 0 errors, 0 CHECK violations, 0 409s).
- All 11 CRITICAL/HIGH bugs fixed (F004-F015).
- 2 remaining open bugs are quality improvements: email-domain mismatch (MEDIUM), phone length validation (LOW).
- 3 unchecked HIGH TODO items are also non-blocking: email-domain mismatch, business type filtering (5% non-targets), phone validation.

## 2026-02-18 (Session 13 — SQL Remediation)

### Database Operations (user-executed in Supabase SQL Editor)
- **CHECK constraint live:** `contacts_source_check` now enforces `('apollo', 'solo_detection', 'website', 'google', 'manual', 'import', 'other')` at the database level. Previously documented in schema but unenforced.
- **Blocked domain cleanup:** Ran UPDATE to clear booking platform domains (20 patterns) from existing companies. Sets `domain = NULL, has_website = false` for any matching rows.
- Both BUG-F015 and BUG-F013 SQL remediation items now fully closed.

### Infrastructure
- **Notification system:** Added Section 11 to CLAUDE.md with ping-zack.vercel.app notification instructions for async completion/decision alerts.

### Verification
- **Exec 118 (SUCCESS):** 8m 16s post-SQL-remediation verification. 60 businesses discovered, 45 companies enriched, 37 contacts processed (1 updated, 0 errors). No CHECK violations, no 409s, no blocked domain issues.

## 2026-02-18 (Session 12 — Contact Dedup + CHECK Constraint)

### Bug Fixes
- **BUG-F014 (BUG-002 CLOSED):** Contact deduplication now enforced at database + n8n level.
  - Schema: unique index `idx_contacts_company_source_name` on `(company_id, source, COALESCE(first_name, ''))`
  - n8n: `Insert Contact to Supabase` uses `on_conflict=company_id,source,first_name` + `Prefer: resolution=ignore-duplicates`
  - Existing contacts silently skipped on re-runs, enriched data not overwritten
- **BUG-F015 (BUG-004 CLOSED):** `contacts_source_check` constraint updated to include `solo_detection` and `import`.
  - SQL: `ALTER TABLE contacts DROP CONSTRAINT contacts_source_check; ALTER TABLE contacts ADD CONSTRAINT contacts_source_check CHECK (source IN ('apollo', 'solo_detection', 'website', 'google', 'manual', 'import', 'other'));`

### Schema Docs
- Updated `docs/architecture/schema.sql` CHECK constraint to match live DB (added `solo_detection`, `import`)

### Verification
- **Exec 117 (SUCCESS):** 8m 41s, 0 errors
  - Discovery: 62 unique businesses (48 Google, 19 Yelp)
  - Step 2: 47 companies enriched
  - Step 3a: 40 companies processed, 0 new contacts created (dedup verified)
  - Step 4: 35 contacts processed, 1 updated (phone), 34 no changes, 0 errors, 2 company emails verified
  - **Dedup confirmed:** existing contacts silently skipped, enriched data preserved

## 2026-02-18 (Session 11 continued — Fix 409 Errors + Domain Blocklist)

### Bug Fixes
- **BUG-F013:** Fixed 409 errors in `Update Company in Supabase` by scoping PATCH payload. `domain`, `google_place_id`, `google_rating`, `google_review_count` now only included when company went through the backfill path (`_backfill_patch`). Non-backfill PATCHes no longer conflict with duplicate rows' unique indexes.
- **BUG-003 (CLOSED):** Added 20-platform booking domain blocklist to all 3 domain extraction points:
  - `Normalize Google Results`: blocklist after domain regex
  - `Normalize Yelp Results`: blocklist after hostname extraction
  - `Extract & Patch Domain`: blocklist in backfill path
  - Blocked domains: wixsite.com, wix.com, setmore.com, schedulista.com, glossgenius.com, square.site, genbook.com, jane.app, acuityscheduling.com, mindbodyonline.com, mindbody.io, vagaro.com, fresha.com, schedulicity.com, booksy.com, massagebook.com, noterro.com, clinicsense.com, calendly.com, squarespace.com

### Additional Fix
- **`Merge Website Results`:** Added `_backfill_patch` pass-through. Previously the explicit field construction dropped this field, preventing backfill data from reaching `Prepare Company Update`.

### Node Updates (5 total)
1. `Normalize Google Results` — domain blocklist
2. `Normalize Yelp Results` — domain blocklist
3. `Extract & Patch Domain` — domain blocklist
4. `Prepare Company Update` — PATCH payload scoped to `_backfill_patch`
5. `Merge Website Results` — `_backfill_patch` pass-through

### Verification
- **Exec 115:** SUCCESS — 0 errors, 0 409s. schedulista.com blocked. Non-backfill PATCHes have no `domain`.
- **Exec 116:** SUCCESS — 0 errors, 0 409s. wixsite.com blocked in backfill. `_backfill_patch` flows through pipeline.

### Decisions
- **ADR-010:** Domain blocklist strategy + PATCH payload scoping

## 2026-02-18 (Session 11 — Fix BUG-F012: Website Email Pipeline)

### Bug Fix
- **BUG-F012:** `Merge Website Results` dropped `emails_found` and `best_email` from the pipeline. Website-scraped emails never reached `Prepare Company Update` or Supabase.
  - `Merge Website Results`: Added `_emails_found` and `_best_email` fields to enriched object
  - `Prepare Company Update`: Changed reference from `(item._website_enrichment || {}).best_email` to `item._best_email`
  - Deployed as single atomic MCP `n8n_update_partial_workflow` operation (2 node updates)

### Schema Docs
- Updated `docs/architecture/schema.sql` with `companies.email` (TEXT) and `companies.email_status` (TEXT with CHECK constraint) columns added in Session 10

### Verification
- **Exec 114:** Full pipeline success, 0 errors. "Summit Wellness Massage Clinic" now has `email: "info@unitywellness.health"` in company update payload. 16 company emails verified in Step 4.

## 2026-02-18 (Session 10 — Company Email Column + Role-Based Email Routing)

### Schema Migration
- Added `companies.email` (TEXT) and `companies.email_status` (TEXT with CHECK constraint) columns via SQL

### Node Updates (11 total)
- **Fetch Companies1:** URL select now includes `email,email_status`
- **Analyze Website HTML:** Added email extraction from HTML — regex extraction, mailto: link detection, junk domain filtering (30+ domains), scoring system (+20 company domain match, +10 mailto, +5 role-based prefix)
- **Prepare Company Update:** Includes `best_email` from website scraping in company PATCH payload
- **Validate & Clean Contact (×5):** Role-based emails now flagged as `_role_based_kept` instead of returning null. Junk patterns (noreply, test, postmaster, etc.) still rejected.
- **Filter & Merge Contacts:** Added `_company_email` and `_company_email_status` to merged contact object
- **Enrich Contacts:** Added company email routing logic:
  - Role-based detection (20 patterns) + free webmail exclusion (18 domains)
  - Routes role-based emails to company.email if company has no email yet
  - Promotes email_personal to email_business when role-based goes to company
  - Verifies company emails via Hunter Verifier (1 credit per unique company)
  - Dedup guard via `$getWorkflowStaticData('global')._companyEmailsSet`
  - Company PATCH to Supabase with email + email_status
- **Run Summary4:** Added company email routing stats (routed count, verified count)

### Decisions
- **ADR-005:** PENDING → ACTIVE — Role-based emails routed to company, kept on contact if only email
- **ADR-006:** PENDING → ACTIVE — company.email + company.email_status columns added

### Issues Closed
- **ISSUE-011:** Missing company email column — CLOSED

## 2026-02-18 (Session 9 — Supabase Data Inspection & Analysis)

### Data Inspection
- Wrote 5 SQL queries to inspect companies and contacts tables
- User executed queries in Supabase SQL editor, saved results to `query_tests/`
- Full analysis written at `query_tests/ANALYSIS.md`

### Key Metrics
- **97 companies** discovered (96% have phone, 87% have domain, 89% have website)
- **58 contacts** (36 Apollo, 22 solo_detection)
- **19 outreach-ready contacts** (15 verified + 4 accept_all emails)
- **0 duplicates** — ADR-008 dedup verified working

### New Issues Discovered
- **BUG-003 upgraded to HIGH:** 7 booking platform domains confirmed (wixsite, setmore, schedulista, glossgenius, square.site, genbook)
- **BUG-005 (NEW):** 4 email-domain mismatches — Apollo emails don't match company domain (college email, scheduling platform)
- **BUG-006 (NEW):** 1 invalid phone number (14 digits for NA number)
- **5 non-target businesses** found: schools, associations, regulatory bodies, UK trade union
- **Solo detection quality gap:** 68% of solo_detection contacts have no name, limiting enrichment potential

## 2026-02-18 (Session 8 — Fix Config Regression + Enable Apollo)

### Bug Fix
- **BUG-F009:** MCP `n8n_update_partial_workflow` silently ignores array index notation in dot paths. Fixed by using full `parameters` object replacement instead of indexed paths.
- **Config regression:** Exec 108 (manual editor run) overwrote Session 7 configs. Both Step 3a and Step 4 reverted to broken defaults.

### Configuration Changes
- **Step 3a Config:** `skip_apollo` "true" → **"false"**, `skip_website_scrape` "true" → **"false"** (Apollo + website scraping now enabled)
- **Step 4 Config:** `batch_size` "10" → **"100"**, `skip_hunter` "true" → **"false"**, `skip_namsor` "true" → **"false"**, `skip_hunter_verifier` "true" → **"false"** (all APIs re-enabled)
- Deployed atomically via MCP `n8n_update_partial_workflow` with full parameter object replacement (2 operations)

### Bug Fix (BUG-F010)
- **Fetch Contacts query excluded contacts with DEFAULT email_status.** Column has `DEFAULT 'unverified'`, but query filtered `email_status=is.null`. Apollo contacts (inserted without email_status) got DEFAULT 'unverified' and were invisible to Step 4.
- **Fix:** Changed Fetch Contacts URL to `or=(email_status.is.null,email_status.eq.unverified)`

### Successful Executions
- **Exec 109:** First Apollo run — 36 searched, 8 contacts created. Step 4: 28 processed, 0 updated (Apollo contacts not yet visible)
- **Exec 111:** After Fetch Contacts fix — **38 contacts processed, 10 updated, 0 errors**
  - Hunter Verifier: 4 checked → 1 verified, 1 invalid removed, 2 accept_all
  - NamSor: 8 cultural affinities set (all Apollo contacts)
  - Phones: 10 added from company data

## 2026-02-18 (Session 7 — Scale to batch_size=100)

### Configuration Changes
- **Google Places - Text Search:** `maxResultCount` 10 → 20 (Google API max per request; 5 queries × 20 = up to 100 raw results)
- **Start Apify Run (Yelp):** `searchLimit` 5 → 20 (more Yelp results per search query)
- **Step 3a Config:** `batch_size` "50" → "100" (contact discovery processes 100 companies per run)
- **Step 4 Config:** `batch_size` "5" → "100" (contact enrichment processes 100 contacts per run)

### Deployment
- All 4 changes deployed atomically via MCP `n8n_update_partial_workflow` (4/4 operations applied)
- Verified all parameter values post-deployment

### Bug Discovery & Fix
- **Exec 105 (FAILED):** Enrich Contacts Code node timed out after 60s — `N8N_RUNNERS_TASK_TIMEOUT` default too low for 47 contacts with multiple API calls each
- **Fix:** User increased `N8N_RUNNERS_TASK_TIMEOUT` in Coolify environment variables, restarted n8n server

### Successful Execution (#106)
- Full pipeline completed in ~10 minutes, **0 errors**
- Step 1: 61 unique businesses discovered (46 Google, 20 Yelp, 5 overlap)
- Step 2: 11 companies enriched, 15 social profiles created
- Step 3b: 100 social profiles checked, 0 needed SociaVault enrichment
- Step 3a: 35 companies → 1 new solo practitioner contact
- Step 4: **33 contacts processed, 12 updated** — 1 Hunter email found, 3 verified, 1 invalid removed, 1 risky, 6 phones added, 10 cultural affinities set

### Notes
- Step 2 (Enrichment Config) and Step 3b Config already at batch_size=100 — no change needed
- Only 33 contacts eligible (not 100) — pipeline correctly processes all available contacts

## 2026-02-18 (Session 6 — API Enablement Testing)

### Bug Fixes
- **BUG-F008:** Fixed `email_status: 'no_email'` CHECK constraint violation — removed invalid status from Enrich Contacts. Contacts without email now keep `email_status: NULL`. Dedup handled by static data (ADR-008).

### API Testing
- **NamSor:** Enabled and verified (execution 102). Jenny Rice → `cultural_affinity: "Europe / Northern Europe / GB"` (probability 0.554).
- **Hunter Verifier:** Enabled and verified (execution 103). Jenny Rice → `email_status: "verified"`, score 49.
- **Hunter Finder:** Enabled and verified (execution 104). 0 errors, no eligible contacts in batch (all 4 unnamed contacts lack first_name required for Hunter Finder).
- **Snov.io:** Skipped — no API key/account yet.

### Configuration
- Step 4 Config final state: `skip_hunter="false"`, `skip_hunter_verifier="false"`, `skip_namsor="false"`, `skip_snovio="true"`, `batch_size="5"`
- n8n MCP tools now connected (used for all workflow updates and execution inspection)

## 2026-02-18 (Session 5 — n8n API Testing & Bug Fixes)

### Bug Fixes
- **BUG-F005:** Fixed `$http is not defined` — replaced all `$http.request()` with `this.helpers.httpRequest()` in Enrich Contacts code node. Response parsing adjusted (no `.body` wrapper with `json: true`).
- **BUG-F006:** Fixed skip toggle misconfiguration — all 4 toggles set to `"true"` via API deployment
- **BUG-F007:** Fixed 4x duplicate Step 4 execution — added `$getWorkflowStaticData('global')` dedup in Filter & Merge Contacts. Tracks processed contact IDs across convergence batches. Runs 1-3 return `_empty`, only Run 0 processes contacts.

### Infrastructure
- Connected to n8n instance API (direct curl, MCP server didn't start at session launch)
- Saved deployed workflow to `workflows/current/deployed-fixed.json`
- Created deployment scripts: `scripts/deploy-http-fix.py`, `scripts/deploy-dedup-fix-v2.py`
- Backed up pre-fix workflow to `workflows/backups/`

### Testing
- Execution 97: All-skips-true test passed (0 errors, `this.helpers.httpRequest` confirmed working)
- Execution 100: Dedup test passed (Enrich Contacts 1x, 0 errors, 10 contacts processed, 1 updated)

### Decisions
- ADR-008: Use `$getWorkflowStaticData()` for cross-batch deduplication

## 2026-02-17 (Session 4 — Handoff)

### Bug Tracking
- Moved BUG-001 (Step 4 convergence) to Fixed as BUG-F004 — resolved via ADR-007 architectural redesign
- Updated TODO.md: marked Step 4 convergence fix as complete

### Testing Preparation
- Added testing checklist to PROGRESS.md with SQL reset, skip toggle settings, and API enable order
- Documented expected outputs for all-skips-true run
- Documented troubleshooting guide for common failure modes

### Session Handoff
- All tracking files verified current
- Memory file updated with project state
- Next session: run all-skips-true test, then enable APIs one at a time

## 2026-02-17 (Session 3)

### Phase 3: Code Audit — COMPLETE
- Created `scripts/generate_phase3.py` — automated audit of all 72 Code nodes
- Created `docs/investigation/phase3-code-audit.md` — 1,402 lines
  - 6 CRITICAL bugs: `.item.json` pairing at convergence (3 in Step 4, 3 in Step 2)
  - 22 HIGH: `.all()` at convergence across Steps 1-4
  - Deep analysis of Step 4 collector pattern failure
  - Pattern violation summary across all Code nodes

### Phase 4: Issue Registry — COMPLETE
- Created `docs/investigation/phase4-issue-registry.md`
  - 15 issues (ISSUE-001 through ISSUE-015)
  - 4 CRITICAL, 5 HIGH, 4 MEDIUM, 2 LOW
  - Each with severity, category, location, description, evidence, impact, proposed fix, dependencies
  - Dependency graph showing fix relationships

### Phase 5: Fix Plan — COMPLETE
- Created `docs/investigation/phase5-fix-plan.md`
  - Strategy: Replace 31-node Step 4 branching pipeline with single Code node
  - Full `Enrich Contacts` Code spec (250 lines): Hunter → Snov.io → Verifier → NamSor → Supabase PATCH
  - All API URLs, headers, auth patterns preserved from original nodes
  - Validation strategy with 3-tier testing plan

### Phase 6: Pre-Generation Review — COMPLETE
- Created `docs/investigation/phase6-review.md`
  - Cross-check: all 5 CRITICAL/HIGH Step 4 issues addressed
  - 5 dry-run traces: normal contact, thin data, invalid email, all skipped, Hunter fail + Snov.io success
  - Data flow integrity verified: same inputs, same output schema
  - No contradictions found

### Phase 7: Generate Fixed Workflow — COMPLETE
- Created `scripts/generate_phase7.py` — workflow transformation script
- Created `workflows/generated/spa-waterfall-fixed.json` — the fixed workflow
  - 122 nodes (151 - 31 removed + 2 added)
  - `Enrich Contacts` Code node: 250 lines, processes all contacts sequentially
  - `Run Summary4` Code node: tallies results from direct input
  - Zero convergence in Step 4 (was 7 convergence points)
  - Backup at `workflows/backups/step4-backup-2026-02-17.json`
- Validation: 0 errors, 24 pre-existing warnings (Steps 1-3 only)

## 2026-02-17 (Session 2)

### Phase 2: Connection Map — COMPLETE
- Created `scripts/generate_phase2.py` — builds complete connection graph from extracted data
- Created `docs/investigation/phase2-connection-map.md` — 1,486-line connection map document
  - 180 edges across 151 nodes, 19 convergence points, 0 isolated nodes
  - ASCII flow diagrams for all 5 steps with branch labels
  - Flat connection tables + input count tables per step
  - Convergence point registry (per investigation plan spec format)
  - Risk matrix: 17 CRITICAL + 2 HIGH convergence points
  - `.all()` convergence analysis: 11 Code nodes at risk
  - Step 4 deep-dive: hand-drawn cascade diagram showing 7 convergence points in unbroken batch chain
  - Cross-step boundary analysis: database fetches likely reset batch context between steps

## 2026-02-17 (Session 1)

### Phase 1: Node Inventory — COMPLETE
- Created `scripts/extract_nodes.py` — programmatic extraction of all node data from workflow JSON
- Created `scripts/generate_phase1.py` — generates Phase 1 document from extracted data
- Created `docs/investigation/phase1-node-inventory.md` — 6,973-line comprehensive node inventory
  - 151 nodes documented (corrected from plan estimate of 88)
  - 72 Code nodes with full jsCode, upstream references, execution modes
  - 36 HTTP Request nodes with method, URL, headers, body, batching
  - 32 IF nodes with conditions JSON and TRUE/FALSE routing targets
  - 5 Set nodes with all assignments
  - 19 convergence points identified
  - 60 `$('NodeName')` cross-references cataloged
  - 12 dangerous `.item.json` patterns flagged for Phase 2
  - 2 duplicate code groups identified (5x Validate & Clean Contact, 3x Bridge)
- Completeness verified: 151/151 nodes, all types sum correctly

## 2026-02-17 (Session 0)

### Added
- Repo structure with investigation plan, architecture docs, tracking system
- CLAUDE.md rules for AI assistants
- Full architecture overview from handoff doc
- API reference (Hunter, Apollo, NamSor, Snov.io)
- n8n patterns and known quirks documentation
- Supabase schema (base + migrations)

### Context
- Steps 1-3a working in n8n
- Step 4 has critical batching bug — only 1/13 contacts verified
- Multiple fix attempts failed (Merge nodes, Code collection nodes)
- Repo created to support methodical investigation and rebuild
