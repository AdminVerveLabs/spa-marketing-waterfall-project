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
**Dashboard-Pipeline Integration** ✅ Deployed (ADR-032 — main 23 nodes + sub 7 nodes + error handler 2 nodes)

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
- [x] ~~Production baseline snapshot~~ — Fresh workflow JSON pulled, committed to `master` (commit `a2ec77c`), improvement branch created (2026-02-21, Session 49)
- [x] ~~Integrate pipeline with dashboard~~ — Dashboard-pipeline integration deployed (ADR-032, Session 50). **Verified end-to-end with Tampa FL (Session 54).** run_id lifecycle, batch progress tracking, and dashboard trigger all working.
- [ ] Backfill `on_yelp` for existing companies (SQL provided in Session 42)
- [ ] **Investigate NamSor API failure (BUG-040)** — NamSor returning null for ALL contacts (including full-name ones). Likely expired API key or service down. Code fix is correct but unverifiable.
- [ ] **Investigate Enrich Companies update_errors (27.5%)** — Nashville #227: 89 errors across 324 companies. Up from ~13% in Sedona. Needs Supabase error response investigation.
- [ ] Re-run Portland, OR after SQL cleanup
- [ ] Set up Snov.io account and API key
- [ ] Add email-domain mismatch detection (ISSUE-012)
- [ ] Re-run Asheville, NC (exec #165 timed out pre-fix)
- [ ] **Deploy Report Generator v0 (ADR-033)** — Workflow deployed + activated (`SL9RrJBYnZjJ8LI6`). BLOCKED: ExcelJS blocked by Task Runner (BUG-042). Fix: modify `/etc/n8n-task-runners.json` via pre-start command (ADR-034). Task Runners are mandatory in n8n 2.x — cannot be disabled.

## Session Log

### Session 58 — 2026-02-21 (Dashboard Metro Config Sync)
- **Added 3 missing metros to dashboard:** Boise ID, Sedona AZ, Asheville NC in `dashboard/src/data/metros.ts`
- Dashboard metro config now matches pipeline (12/12 metros)

### Session 57 — 2026-02-21 (BUG-042 Fix Research — Task Runner Config)
- **Key finding: Task Runners CANNOT be disabled in n8n 2.x.** `N8N_RUNNERS_DISABLED=true` is not a real/supported option. Task Runners are mandatory since 2.0 for CVE isolation (sandbox bypass vulnerabilities). Only modes are internal (child process) vs external (separate container).
- **Root cause clarified:** The internal mode task runner reads `/etc/n8n-task-runners.json`, which has `env-overrides` that set `NODE_FUNCTION_ALLOW_EXTERNAL: ""` (empty), overriding the container env var and blocking all external modules.
- **ADR-034 logged:** Correct fix is to modify `/etc/n8n-task-runners.json` via Coolify pre-start command: `sed -i 's/"NODE_FUNCTION_ALLOW_EXTERNAL": "[^"]*"/"NODE_FUNCTION_ALLOW_EXTERNAL": "exceljs"/g' /etc/n8n-task-runners.json`
- **BUG-042 updated** with corrected fix options (removed N8N_RUNNERS_DISABLED recommendation)
- **Notification sent to Zack** with 3 corrected options (A: pre-start sed, B: custom Dockerfile, C: volume mount)
- **Confirmed live Track Batch Completion** does NOT have report trigger code yet (as expected — deploy after BUG-042 fixed)
- **BLOCKED:** Waiting for Zack to apply pre-start command in Coolify and restart n8n

### Session 56 — 2026-02-21 (Report Generator Deployment — Blocked on Task Runner)
- **Report Generator v0 workflow deployed to n8n** (ID: `SL9RrJBYnZjJ8LI6`, 5 nodes, activated):
  - All 5 nodes added via MCP: Webhook → Respond to Webhook → Fetch Report Data → Generate & Upload Report → Send Email via Resend
  - Webhook path: `report-generator-v1` (POST)
- **Test execution #270: FAILED** — `Module 'exceljs' is disallowed [line 6]`
  - n8n 2.35.4 uses Task Runner architecture (`/opt/runners/task-runner-javascript/`)
  - Task Runner has its own module allowlist that ignores `NODE_FUNCTION_ALLOW_EXTERNAL`
  - Per GitHub issue #20087: fix requires either mounting `/etc/n8n-task-runners.json` with exceljs in allowlist, OR setting `N8N_RUNNERS_DISABLED=true` in Coolify
- **BUG-042 logged:** ExcelJS blocked by Task Runner
- **Track Batch Completion:** Confirmed live sub-workflow does NOT yet have report trigger code (step 7 of plan, deferred until report generator works)
- **Notifications sent to Zack** with fix options (A: disable task runners, B: mount config, C: custom Docker image)
- **BLOCKED:** Waiting for Zack to apply one of the Task Runner fixes in Coolify

### Session 55 — 2026-02-21 (Report Generator v0 Implementation)
- **Report Generator v0 — all files created (ADR-033):**
  - `scripts/supabase/report-schema.sql` — ALTER TABLE for report columns + storage bucket + `get_lead_report` RPC function
  - `scripts/nodes/report-generator/fetch-report-data.js` — Fetches pipeline_runs row, marks report_status, calls RPC (~70 lines)
  - `scripts/nodes/report-generator/generate-report.js` — Full v2 guide ExcelJS implementation: clean, tier, multi-sheet xlsx, upload to Supabase Storage (~630 lines)
  - `scripts/nodes/report-generator/send-email.js` — Resend API email with xlsx attachment (~110 lines)
  - `scripts/build-report-workflow.py` — Builds workflow JSON from JS source files
  - `workflows/generated/report-generator-workflow.json` — 5-node n8n workflow (Webhook → Respond → Fetch → Generate → Email)
  - `scripts/nodes/track-batch-completion.js` — Added non-blocking report trigger in is_last_batch block (guarded by REPORT_GENERATOR_WEBHOOK_URL env var)
- **Prerequisites for deployment:** ExcelJS install in n8n container, `NODE_FUNCTION_ALLOW_EXTERNAL=exceljs`, `RESEND_API_KEY`, `REPORT_GENERATOR_WEBHOOK_URL` env vars, SQL schema migration, Resend account + verified domain
- **No deployment yet** — awaiting Zack to complete prerequisites

### Session 54 — 2026-02-21 (Tampa FL E2E Test + Webhook Fix)
- **BUG-041 FOUND & FIXED:** Webhook `multipleMethods: true` routed POST to output 1 (no connection). Changed to POST-only single-output webhook. Deployed via MCP.
- **Tampa FL metro added:** 12th operational metro. Coords 27.9506, -82.4572, radius 20km. Deployed to Metro Config via MCP.
- **Stuck pipeline_runs rows cleaned up:** User ran SQL to mark stuck Tampa `queued`/`running` rows as `failed` and delete `test` row.
- **First dashboard-triggered pipeline run: Tampa FL exec #262 (SUCCESS):**
  - Status: success, 6m 53s (412s), 23/23 nodes
  - Discovery: 180 Google + 97 Yelp → 277 merged → 161 deduplicated → 159 inserted + 2 flagged
  - Batch Dispatcher: 31.7s, 159 companies, 7 batches, all_dispatched
  - Sub-workflow execs #263-#269: ALL 7 SUCCESS (7 nodes each, 77-101s)
  - 0 update errors (sampled batches #263, #265)
  - Lead Scoring: SUCCESS, Run Summary5: SUCCESS
- **Enrichment results (sampled batches #263 + #265):**
  - Enrich Companies: 50 companies, 39 websites, 30 booking platforms, 3 paid ads, 63 social profiles, 44 Google Details, **0 update errors**
  - Find Contacts: 10 contacts inserted (8 Apollo, 2 solo)
  - Enrich Contacts: phones verified (valid mobile Verizon, valid landline BANDWIDTH/Peerless)
  - **NamSor working again** (BUG-040 possibly resolved): Irena→IL, Joshua→GB, Rain→EE, Gennell→GB
- **Dashboard integration fully verified:** run_id lifecycle worked end-to-end. pipeline_runs: queued → running → completed with batch progress tracking.

### Session 53 — 2026-02-21 (Backfill Historical Pipeline Runs)
- **Created `scripts/backfill-pipeline-runs.sql`** — INSERT statement to populate `pipeline_runs` table with historical data for 7 metros that have `discovery_metro` data.
- **7 metros backfilled:** Austin TX (318 companies, 156 contacts), Boise ID (168/34), Nashville TN (327/37), San Diego CA (305/68), Scottsdale AZ (196/41), Sedona AZ (268/40), Asheville NC (2/0, marked 'failed').
- **`triggered_by = 'backfill'`** distinguishes these from dashboard-triggered runs.
- **4 metros NOT included:** Denver, Phoenix, Toronto, Portland — ran before `discovery_metro` column existed. Can backfill later with targeted Supabase queries.
- **Pending:** User runs `scripts/backfill-pipeline-runs.sql` in Supabase SQL Editor. Dashboard History page should then show 7 runs with aggregate stats.

### Session 52 — 2026-02-21 (Fix Dashboard "Invalid API Key" Error)
- **Root cause investigation:** Dashboard deployed to Coolify at `http://egskggk4occc4k8sc0ocks88.5.161.95.57.sslip.io`. Login fails with "invalid API key". Investigated: anon key is correct (208 chars, JWT decodes to role=anon), RLS policies are correct, bundle contains the right values. Probable cause: Coolify build args may introduce whitespace/newline corruption during Docker rebuild.
- **Fix: Committed `.env.production`** — Vite reads `.env.production` during `npm run build`, baking values directly into the JS bundle. Eliminates dependency on Coolify build args entirely. Contains only public keys (anon key + webhook URL) — safe for private repo.
- **Updated `.gitignore`** — Added exception `!dashboard/.env.production` so the file is tracked despite `*.env` pattern.
- **Updated local `dashboard/.env`** — Added missing `VITE_N8N_WEBHOOK_URL` value.
- **Still pending:** User must run `scripts/dashboard-schema.sql` in Supabase SQL Editor before dashboard pages will work after login (pipeline_runs, search_query_templates tables don't exist yet).

### Session 51 — 2026-02-21 (Deployment Verification + Snapshot Sync)
- **Verification session** — no new code deployed. Confirmed all 3 n8n workflows match local source files.
- **n8n health check:** OK, version 2.35.4. All 3 workflows active.
- **Code verification:** Compared deployed jsCode against local `scripts/nodes/` for all critical nodes (Metro Config, Mark Running, Batch Dispatcher, Track Batch Completion, Mark Failed). All match.
- **Fix: `track-batch-completion.js`** — Local source file used inefficient approach (fetched ALL 19K+ contacts, filtered in JS). Deployed version correctly uses server-side `company_id=in.(...)` filter. Synced local file to match deployed version.
- **Workflow snapshots refreshed:** Pulled fresh JSON from n8n for all 3 workflows:
  - `workflows/current/deployed-fixed.json` (93KB, 23 nodes)
  - `workflows/current/sub-workflow-deployed.json` (180KB, 7 nodes)
  - `workflows/current/error-handler-deployed.json` (3.4KB, 2 nodes — NEW file)
- **Dashboard code verified:** DashboardPage (30s polling), NewRunPage (single-run enforcement), ActiveRunBanner (batch progress bar), types (total_batches/completed_batches).
- **Still pending user actions:**
  1. Run `scripts/dashboard-schema.sql` in Supabase SQL Editor
  2. Set dashboard env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_N8N_WEBHOOK_URL`
  3. End-to-end test from dashboard

### Session 50 — 2026-02-21 (Dashboard-Pipeline Integration — ADR-032)
- **MAJOR FEATURE: Dashboard-pipeline integration deployed.** Implements the full run_id lifecycle from dashboard trigger to completion tracking.
- **Phase 1 (Schema):** Created `scripts/dashboard-schema.sql` with pipeline_runs table (incl. total_batches/completed_batches), search_query_templates, coverage stats view, RLS policies, and `increment_completed_batches()` RPC function. **User must run in Supabase SQL Editor.**
- **Phase 2 (Webhook + Metro Config):**
  - Webhook node changed to accept both GET and POST (`multipleMethods: true`).
  - Metro Config rewritten to read POST body first (run_id, lat/lng, radius, queries), fall back to GET query param + hardcoded 11-metro lookup.
  - Always outputs `run_id` (null for legacy triggers).
- **Phase 3A (Mark Running):** New Code node added between Metro Config and Split Search Queries. PATCHes `pipeline_runs` → status='running', started_at, n8n_execution_id. Skips if no run_id. Non-blocking.
- **Phase 3B (Batch Dispatcher):** Updated with 3 additions:
  1. Extract `run_id` from Metro Config output
  2. PATCH `pipeline_runs` with `total_batches` after batch splitting
  3. Include `run_id` in sub-workflow POST body: `{ company_ids, metro, run_id }`
- **Phase 3C (Track Batch Completion):** New terminal Code node in sub-workflow (after Mark Fully Enriched). Calls `increment_completed_batches()` RPC atomically. If last batch, queries metro totals and PATCHes pipeline_runs to 'completed'. Skips if no run_id.
- **Phase 3D (Error Handler):** New workflow `ovArmKkj1bs5Af3G` (Error Trigger → Mark Failed). Looks up pipeline_runs by n8n_execution_id, PATCHes to 'failed'. Set as `errorWorkflow` on main pipeline.
- **Phase 4 (Dashboard Polish):**
  - PipelineRun type: added total_batches, completed_batches
  - DashboardPage: 30s polling when active/queued run exists
  - NewRunPage: single-run enforcement (skip webhook trigger if pipeline already running)
  - ActiveRunBanner: batch progress bar with percentage
- **Workflow state after Session 50:**
  - Main workflow: 23 nodes (was 22) — Mark Running added
  - Sub-workflow: 7 nodes (was 6) — Track Batch Completion added
  - Error handler: 2 nodes (new workflow)
- **Backups saved:** `workflows/backups/pre-dashboard-main-20260221.json`, `workflows/backups/pre-dashboard-sub-20260221.json`
- **Dashboard builds cleanly** — 711KB JS, zero type errors
- **Prerequisites for end-to-end test:**
  1. Run `scripts/dashboard-schema.sql` in Supabase SQL Editor
  2. Set dashboard env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_N8N_WEBHOOK_URL`
  3. Trigger from dashboard → watch pipeline_runs row progress through lifecycle

### Session 49 — 2026-02-21 (Production Baseline + Dashboard Handoff)
- **Production baseline committed:** Pulled fresh workflow JSON from n8n for both main workflow (`yxvQst30sWlNIeZq`) and sub-workflow (`fGm4IP0rWxgHptN8`). Snapshots saved to `workflows/current/`. All changes committed to `master` as commit `a2ec77c`.
- **Improvement branch created:** `attempt-improve-enrichment` branched from `master` for next phase of work.
- **Dashboard integration handoff doc created:** `docs/HANDOFF-dashboard-integration.md` — documents pipeline integration points, constraints, and prerequisites for connecting the React dashboard to the n8n pipeline.
- **Tracking updates:** Session 49 entries added to PROGRESS.md, TODO.md, CHANGELOG.md.
- **No code changes this session** — git housekeeping and documentation only.

### Session 48 — 2026-02-20 (Boise, ID Pipeline Re-Run)
- **Boise, ID re-run after SQL reset of partially_enriched companies from failed execs #143/#146.**
- **Pre-flight checks passed:** No running executions on main or sub-workflow. Both workflows active.
- **User ran SQL reset:** `UPDATE companies SET enrichment_status = 'discovered' WHERE discovery_metro = 'Boise, ID' AND enrichment_status = 'partially_enriched'`
- **Exec #241 (MCP trigger — FAILED):** n8n MCP `n8n_test_workflow` tool stripped query params from webhook URL. Metro Config received empty `query: {}` → error "Missing required query parameter: metro_name". MCP tool bug — query params appended to `webhookPath` not forwarded correctly.
- **Exec #242 (curl trigger — SUCCESS):**
  - Status: success, 6m 51s (411s), 22/22 nodes
  - Discovery: 240 Google + 89 Yelp → 329 merged → 168 deduplicated → 165 inserted + 3 flagged
  - Batch Dispatcher: **31.6s** — 165 companies, 7 batches of 25, 7/7 dispatched (all_dispatched)
  - Calculate Lead Scores: SUCCESS
  - Run Summary5: SUCCESS
- **Exec #243 (accidental double-trigger — FAILED harmlessly):** Apify `actor-memory-limit-exceeded` (53248MB used by #242's runs). Metro Config succeeded (query params passed correctly via curl), but Apify couldn't start new runs. No damage — failed before any data writes.
- **Sub-workflow executions #244-#250 — ALL SUCCESS (7/7):**
  - All dispatched at 01:14:13-14 UTC, completed by 01:15:56 UTC
  - Duration range: 51-103s per batch
  - Spot-check batch #244 (25 companies): All 6 nodes success. Enrich Companies (domain backfill, websites, booking platforms, Google Details). Find Contacts (Apollo, solo detection). Enrich Contacts (5 contacts enriched, phones verified, cultural affinity). Mark Fully Enriched.
- **Key metrics:** 12th operational metro fully enriched via parallelized architecture.

### Session 47 — 2026-02-20 (Nashville Exec #227 — Aggregate Analysis)
- **Research-only session. No code changes.**
- **Nashville TN exec #227 aggregate analysis across all 13 sub-workflow batches (#228-#240):**

#### Summary Table
| Metric | Value |
|--------|-------|
| Companies (new) | 156 inserted + 2 flagged |
| Companies (total enriched) | 324 across 13 batches |
| Contacts (new) | 33 inserted |
| Contacts (total enriched) | 37 (includes ~4 pre-existing) |
| Solo practitioners detected | 45 |
| Solo with extractable name | 25 (56%) |
| Domains backfilled | 129 |
| Paid ads detected | 36 |
| Booking platforms | 130 |
| Emails found | 0 |
| Verified emails | 0 |
| Phones verified (Telnyx) | ~31 of 37 contacts |
| Verified phones | ~31 valid |
| NamSor cultural affinity | 0 (BUG-040) |
| Google Details | 244 processed |
| Social profiles | 138 inserted |
| Update errors | 89 (27.5% of 324 companies) |

#### Per-Batch Breakdown (8 of 13 batches with full detail)
| Batch | Companies | Websites | Booking | Paid Ads | Social | Google | Errors | Contacts |
|-------|-----------|----------|---------|----------|--------|--------|--------|----------|
| #228  | 25 | 14 | 9  | 1 | 13 | 18 | 2  | 5 |
| #229  | 25 | 19 | 12 | 5 | 11 | 21 | 0  | 4 |
| #230  | 25 | 19 | 11 | 4 | 2  | 22 | 3  | 2 |
| #231  | 25 | 14 | 8  | 2 | 19 | 20 | 14 | 2 |
| #232  | 25 | 9  | 7  | 2 | 18 | 11 | 5  | 2 |
| #233  | 25 | 19 | 15 | 3 | 23 | 21 | 8  | 3 |
| #237  | 25 | 23 | 14 | 9 | 12 | 25 | 3  | 1 |
| #240  | 24 | 13 | 11 | 2 | 15 | 20 | 14 | 3 |
| **8-batch total** | **199** | **130** | **87** | **28** | **113** | **158** | **49** | **22** |

#### Apollo Performance (8 detailed batches)
- Total searched: 22 companies (of 199 — most had no domain or already searched)
- Found people: 5 (23% yield)
- Contacts created: 5
- **Nashville Apollo yield is very low** — most businesses too small for Apollo's database

#### Contact Sources (8 detailed batches: 21 contacts inserted)
- Solo detection: 13 (62%)
- Apollo: 5 (24%)
- Website scraping: 3 (14%)
- Name extraction: 0

#### Key Observations
1. **Emails: 0 across all 37 contacts** — Hunter Finder found nothing, no company email routing. Most solo-detected contacts lack email-ready domains.
2. **NamSor: 0 across all 37 contacts (BUG-040)** — Including full-name contacts (Melanie Joye, Laura Stendel, Emily Frith, Rebecca Saindon, Katie Pichardo, Lori Kemper). API-level failure confirmed.
3. **Update errors: 27.5%** — 89 errors across 324 companies. High-error batches: #231 (14/25), #240 (14/24). Low-error batches: #229 (0/25). Root cause still unknown — needs Supabase error response investigation.
4. **Phone verification working well** — ~31 of 37 contacts got valid phones. Mix of mobile (Cingular, Verizon) and landline (BANDWIDTH). One VoIP (Vonage at MassageLuXe).
5. **Partial dispatch: 9/13** — Batch Dispatcher sent all 13 HTTP requests but only 9 acknowledged within 60.5s. All 13 sub-workflows executed successfully (fire-and-forget pattern working correctly).
6. **Cross-batch contact duplication** — Same contacts (e.g., Melanie Joye, Katie Pichardo, Tina) appear in multiple batches because the same business has multiple google_place_ids. Dedup handles this correctly (phone re-verified, no duplicate DB inserts).

### Session 46 — 2026-02-20 (Fix NamSor Guard + Nashville TN Re-run)
- **IMP-014 CODE FIX DEPLOYED:** Relaxed NamSor guard on `enrich-contacts.js:448` — removed `(contact.last_name || '').length > 0` requirement. Guard now only needs `first_name`. Deployed to sub-workflow `fGm4IP0rWxgHptN8` via MCP `updateNode`.
- **Nashville TN exec #227 (SUCCESS):**
  - Status: success, 7m 52s (472s), 22 nodes
  - Discovery: 239 Google + 95 Yelp → 158 unique → 156 inserted + 2 flagged
  - Batch Dispatcher: 60.5s, 297 discovered, 9/13 batches (partial_dispatch), 324 companies
  - Calculate Lead Scores: SUCCESS
  - Run Summary5: scoring_status SUCCESS
- **Sub-workflow executions #228-#240 — ALL SUCCESS (13/13):**
  - Spot-check batch #228: 25 companies, 14 websites, 9 booking platforms, 1 paid ad. 5 contacts (2 Apollo + 2 solo + 1 website). Phones verified.
  - Spot-check batch #233: 25 companies, 19 websites, 15 booking platforms, 3 paid ads. 3 contacts (3 solo). Phones verified.
  - Digital signals confirmed: booking platforms, paid ads, Google Details
- **NamSor API FAILURE (BUG-040):** `cultural_affinity = null` across ALL contacts in ALL batches — including full-name contacts (Melanie Joye, Laura Stendel). IMP-014 code fix is correct (verified in deployed code: old `last_name` guard removed) but NamSor API itself is not returning data. Likely expired API key or service outage.

### Session 45 — 2026-02-20 (Pre-Flight Check Rule + Austin TX Results + San Diego Re-run)
- **Added CLAUDE.md Rule 12:** Pre-flight check before pipeline triggers. Must list recent executions and check for running/recent activity before any webhook trigger. Prevents double-trigger incidents.
- **BUG-039 logged:** Double-trigger procedural bug (Sedona #181, Austin #212). Root cause: n8n execution list API latency — new executions don't appear immediately.
- **MEMORY.md updated:** Added "Pipeline Trigger Safety" section.
- **Austin TX exec #198 (SUCCESS):**
  - Status: success, 6m 12s (372s), 22 nodes
  - Discovery: 168 inserted + 3 flagged = 171 companies
  - Batch Dispatcher: 60.5s, 212 discovered companies, **9/13 batches dispatched** (partial_dispatch), 314 companies in batches of 25
  - Calculate Lead Scores: SUCCESS
  - Run Summary5: scoring_status SUCCESS
- **Sub-workflow executions #199-#211 — ALL SUCCESS (13/13):**
  - First 9 dispatched by exec #198 (~23:35:34), remaining 4 likely from cancelled exec #212 (~23:36:19-51)
  - Spot-check batch #203 (25 companies): 14 websites, 11 booking platforms, 1 paid ad, 29 social profiles, **8 update errors** (same ~32% rate). Find Contacts: 5 Apollo searched, 2 found, 4 contacts inserted. Enrich Contacts: phones verified (valid mobile T-Mobile, valid mobile Cingular).
  - All batches: 6 nodes, 75-137s each
- **Exec #212 (Austin TX — CANCELLED):** Double-trigger incident. Started 23:36:51 (while #198 sub-workflows still running), cancelled by user at 23:38:08. May have dispatched 4 additional sub-workflow batches before cancellation.
- **IMP-012, IMP-013 logged:** Website email scraping counter gap + company email verification gap.
- **San Diego CA exec #213 (SUCCESS):**
  - Status: success, 7m 34s (454s), 22 nodes
  - Discovery: 178 unique → 177 inserted + 1 flagged
  - Batch Dispatcher: 60.4s, 216 discovered, **9/13 batches dispatched** (partial_dispatch), 303 companies
  - Calculate Lead Scores: SUCCESS
  - Run Summary5: scoring_status SUCCESS
- **Sub-workflow executions #214-#225 — ALL SUCCESS (10/10):**
  - 10 executions, all 6 nodes, 20-139s each
  - Spot-check batch #214 (25 companies): 18 websites, 15 booking platforms, 3 paid ads, 30 social profiles, **16 update errors**. Find Contacts: 5 Apollo searched, 2 found, 4 contacts inserted. Enrich Contacts: 5 contacts, phone verification working (valid mobile Verizon, VoIP Twilio).
  - Spot-check batch #216 (25 companies): 19 websites, 17 booking platforms, 23 Google Details, **0 update errors**. Find Contacts: 18 Apollo searched, 4 found + 1 website = 5 contacts inserted.
  - Spot-check batch #219 (25 companies): 18 websites, 17 booking platforms, 3 paid ads, 24 Google Details, **0 update errors**. Find Contacts: 12 Apollo searched, 1 found, 1 contact inserted.
  - Digital signals confirmed flowing: booking platforms, paid ads, Google ratings, social profiles
- **IMP-014 FOUND: NamSor cultural_affinity effectively broken for solo-detected contacts.** Guard on `enrich-contacts.js:448` requires both `first_name` AND `last_name.length > 0`. ~90% of contacts are solo-detected with first_name only (no last_name). NamSor is never called. Line 450 already handles missing last_name by sending `'Unknown'`. The guard is too strict.

### Session 44 — 2026-02-20 (Scottsdale, AZ Metro Expansion)
- **Added Scottsdale, AZ** as 11th operational metro. Coords 33.4942, -111.9261 (Old Town Scottsdale), radius 15km.
- **Deployed Metro Config** to n8n via MCP `updateNode` on main workflow `yxvQst30sWlNIeZq`. Workflow stayed active (22 nodes).
- **Exec #189 (Main workflow — SUCCESS):**
  - Status: success, 6m 46s (406s), 22 nodes
  - Discovery: 239 Google + 84 Yelp = 323 raw → 196 unique (3 flagged, 193 inserted)
  - Batch Dispatcher: 31.6s, 8 batches dispatched (7×25 + 1×18 = 193 companies)
  - Calculate Lead Scores: SUCCESS
  - Run Summary5: scoring_status SUCCESS
- **Sub-workflow executions #190-#197 — ALL SUCCESS (7/7):**
  - All dispatched within ~0.7s, completed in 84-89s each
  - Spot-check batch #193 (25 companies): 19 websites, 13 booking platforms, 3 paid ads, 24 social profiles, **0 update errors**. Find Contacts: 15 Apollo searched, 5 found, 6 contacts inserted. Enrich Contacts: phones verified (valid mobile Verizon, valid landline Comcast).
- **Phoenix overlap handled:** google_place_id upsert deduplicates. Some companies' `discovery_metro` updated from Phoenix to Scottsdale — acceptable.

### Session 43 — 2026-02-20 (Sedona AZ Backfill Re-run)
- **Re-ran Sedona AZ** to backfill digital signal fields after Session 42 pipeline recovery fixes.
- **Exec #180 (Main workflow — SUCCESS):**
  - Status: success, 6m 52s (412s), 22 nodes
  - Insert to Supabase: 125 companies, 2.5s
  - Batch Dispatcher: 31.8s, 7 batches dispatched (6×25 + 1×3 = 153 companies)
  - Calculate Lead Scores: SUCCESS, 0.9s
  - Run Summary5: SUCCESS
- **Sub-workflow executions #182-#188 — ALL SUCCESS:**
  - 7/7 batches completed, all 6 nodes per batch
  - Duration: 66-91s per batch
- **Digital signals now populated (sampled 4 of 7 batches, 78 companies):**
  - Booking platforms detected: 29 (37% of companies)
  - Paid ads detected: 11 (14%)
  - Google Details processed: 58 (74%)
  - Social profiles inserted: 20
  - Websites fetched: 56 (72%)
- **Contacts:**
  - Find Contacts (batch #185): 9 contacts inserted (4 solo + 5 Apollo)
  - Enrich Contacts: phone verification working (valid mobile, Verizon)
- **Update errors: ~13%** (10 errors in 78 sampled companies). Down from ~50-70% pre-Session 42 fix, but not zero. Needs investigation.
- **Exec #181 (curl trigger — FAILED):** Apify `actor-memory-limit-exceeded` — all memory in use by exec #180's Apify runs. Expected collision from double-trigger.
- **Diagnostic SQL** at `scripts/diagnostic.sql` ready for user to re-run to compare before/after digital signals.

### Session 42 — 2026-02-20 (Pipeline Recovery: Fix Zero Digital Signals)
- **5 issues identified in Session 41, all fixed:**
  1. **Issue 1 (Insert field drops):** "Insert to Supabase" and "Insert Flagged" HTTP Request nodes were missing 8 fields: `google_rating`, `google_review_count`, `has_online_booking`, `booking_platform`, `has_paid_ads`, `estimated_size`, `on_yelp`, `on_groupon`. Fixed by adding all 8 fields to both node bodies via MCP.
  2. **Issue 2 (on_yelp/on_groupon never written):** These fields were computed by discovery normalization but dropped by Insert nodes. Now included in Insert body (fixed as part of Issue 1).
  3. **Issue 3 (nonexistent PATCH columns):** `enrich-companies.js` PATCH payload included `opening_hours`, `business_status`, `photo_count`, `price_level` — columns that don't exist in Supabase. Caused ~50-70% update_errors. Removed from PATCH payload.
  4. **Issue 4 (early-exit propagation):** 4 early-exit paths in enrichment Code nodes returned bare `[]` without `metro`/`company_ids`, breaking downstream Find Contacts and Enrich Contacts. Fixed to pass through `metro, company_ids: companyIds`.
  5. **Issue 5 (stuck companies):** ~50 Sedona companies at `partially_enriched` due to Issue 3 errors. Will self-resolve on re-run (fetch includes `partially_enriched`).
- **Deployed to n8n:**
  - Sub-workflow `fGm4IP0rWxgHptN8`: 3 Code node updates (enrich-companies, find-contacts, enrich-contacts)
  - Main workflow `yxvQst30sWlNIeZq`: 2 Insert node updates (8 new fields each)
- **Local snapshots updated:** `workflows/current/deployed-fixed.json`, `workflows/current/sub-workflow-deployed.json`
- **Verification test (exec #179 — SUCCESS):** Sub-workflow triggered with 5 Sedona company IDs:
  - Enrich Companies: 5 processed, 4 websites, 3 booking platforms, 4 Google Details, **0 update errors** (was ~50-70%)
  - Find Contacts: 4 Apollo searched, 1 contact created (Joy Musacchio), metro propagation working
  - Enrich Contacts: email verified (score 100), phone valid (mobile, Verizon), company phone verified, **0 update errors**
  - Mark Fully Enriched: 5 companies updated, metro "Sedona, AZ" — all correct
- **SQL provided:** Backfill `on_yelp` for existing companies from `source_urls` data

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
- **No blocking bugs.** All CRITICAL and HIGH bugs fixed (BUG-F004 through BUG-F038). Pipeline runs cleanly with digital signals, metro scoping, phone verification, and all enrichments.
- BUG-005 (MEDIUM): Email-domain mismatch — 4 contacts have Apollo emails not matching company domain. Quality improvement, not a blocker.
- **Existing metro data** needs re-run or SQL backfill to populate newly-saved fields (google_rating, booking_platform, on_yelp, etc.).

## Blocked On
- Nothing.

## API Credits
- Hunter.io: check dashboard (was ~48.5, exec 106 used ~6 credits: 1 Finder + 5 Verifier)
- NamSor: check dashboard (exec 106 used 10 calls)
- Apollo: check dashboard
