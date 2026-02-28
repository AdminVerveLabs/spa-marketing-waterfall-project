# Project Handoff: Spa Marketing Waterfall

## 1. Project Overview

**What it is:** An automated lead discovery and enrichment pipeline for massage therapy and spa businesses across North American metro areas. The system discovers businesses via Google Places and Yelp, enriches them with website data, contact information, and verification, scores leads for sales outreach, and syncs results to Apollo.io CRM.

**Stack:**
- **Workflow orchestration:** n8n 2.1.5 (self-hosted on Hetzner VPS via Coolify)
- **Database:** Supabase (PostgreSQL + REST API + Storage)
- **Dashboard:** React (Vite + Tailwind CSS), deployed on Coolify
- **CRM:** Apollo.io (outbound sync)
- **Infrastructure:** Docker Compose (5 services), managed via Coolify

**Scale (as of Session 89):**
- 13 metros operational (Austin TX, Denver CO, Phoenix AZ, Toronto ON, San Diego CA, Boise ID, Portland OR, Nashville TN, Asheville NC, Sedona AZ, Scottsdale AZ, Tampa FL, Boston MA)
- 2,469 companies discovered and enriched
- 645 contacts found across all metros
- 5 of 6 enrichment APIs active (Apollo, NamSor, Hunter Finder/Verifier, Telnyx)
- 89 development sessions over ~2 weeks

**Business purpose:** Generate qualified massage therapy business leads with contact information and digital presence signals for sales outreach. Target audience is solo practitioners and small businesses that lack digital marketing — the "sweet spot" for a marketing services offering.

---

## 2. Architecture

### Workflow System (4 workflows + 1 sync)

```
                         React Dashboard (Coolify)
                               |
                          POST /webhook
                               |
                    ┌──────────v──────────┐
                    │   Main Workflow      │
                    │   yxvQst30sWlNIeZq  │
                    │   (23 nodes)         │
                    │                      │
                    │  Webhook → Metro     │
                    │  Config → Mark       │
                    │  Running → Google    │
                    │  Places → Yelp       │
                    │  (Apify) → Normalize │
                    │  → Dedupe → Insert   │
                    │  to Supabase →       │
                    │  Batch Dispatcher    │
                    │  → Lead Scoring →    │
                    │  Run Summary         │
                    └──────────┬──────────┘
                               │
                    Dispatches batches of 25
                    (parallel, via webhook POST)
                               │
                    ┌──────────v──────────┐
                    │   Sub-Workflow       │
                    │   fGm4IP0rWxgHptN8  │
                    │   (7 nodes)          │
                    │                      │
                    │  Webhook → Respond   │
                    │  → Enrich Companies  │
                    │  → Find Contacts     │
                    │  → Enrich Contacts   │
                    │  → Mark Enriched     │
                    │  → Track Batch       │
                    │    Completion        │
                    └──────────┬──────────┘
                               │
                    On last batch complete:
                    triggers report generation
                               │
                    ┌──────────v──────────┐
                    │  Report Generator    │
                    │  SL9RrJBYnZjJ8LI6  │
                    │  (7 nodes)           │
                    │                      │
                    │  Fetch → Generate    │
                    │  xlsx → Upload to    │
                    │  Supabase Storage    │
                    │  → Send Email →      │
                    │  Mark Complete       │
                    └─────────────────────┘

                    ┌─────────────────────┐
                    │  Error Handler       │
                    │  ovArmKkj1bs5Af3G   │
                    │  (2 nodes)           │
                    │                      │
                    │  Error Trigger →     │
                    │  Mark Failed         │
                    └─────────────────────┘

                    ┌─────────────────────┐
                    │  Apollo Sync v1      │
                    │  g9uplPwBAaaVgm4X   │
                    │  (11 nodes)          │
                    │                      │
                    │  Schedule (30 min)   │
                    │  → Config → Fields   │
                    │  → Fetch Unsynced    │
                    │  → Filter → Split    │
                    │  → Upsert Account    │
                    │  → Wait → Upsert     │
                    │  Contacts → Mark     │
                    │  Synced → Log        │
                    └─────────────────────┘
```

### Webhook Paths

| Workflow | Path | Method | Purpose |
|----------|------|--------|---------|
| Main | `001b878c-b5af-4c3c-8b78-d41e526049f4` | POST | Dashboard trigger |
| Sub-workflow | `batch-enrichment-v1` | POST | Internal batch dispatch |
| Report Generator | `report-generator-v1` | POST | Internal report trigger |

### Data Flow

1. **Discovery:** Dashboard POSTs `{ metro_name, run_id }` → Google Places API + Yelp (via Apify) → Normalize → Dedupe by phone + name similarity → Insert to Supabase
2. **Batch Dispatch:** Poll Supabase for newly discovered companies → Split into batches of 25 → Fire-and-forget POST to sub-workflow webhook
3. **Enrichment:** For each company: Google Details + website scrape + booking detection + email extraction → For each company: solo detection + Apollo search + about page + Hunter Domain Search + Google Reviews + Yelp Owner → For each contact: Hunter email finder/verifier + NamSor origin + Telnyx phone verify
4. **Completion Tracking:** Atomic `increment_completed_batches()` RPC → On last batch: PATCH run to 'completed' + trigger report
5. **Report Generation:** Fetch enriched data via RPC → Generate multi-sheet xlsx (ExcelJS) → Upload to Supabase Storage → Email via Resend
6. **Apollo Sync:** Schedule trigger (30 min) → Fetch unsynced companies/contacts → Create/update accounts + contacts in Apollo with custom fields

### run_id Lifecycle

```
queued (dashboard creates) → running (Mark Running PATCHes) → total_batches set (Batch Dispatcher)
  → completed_batches incrementing (Track Batch Completion RPC)
  → completed (last batch) / failed (Error Handler)
  → report_status: generating → completed (Report Generator)
```

---

## 3. What We Built (Chronological Narrative)

### Phase 1-7: Investigation (Sessions 1-7)
Started with a broken 151-node n8n workflow. Performed systematic investigation:
- **Phase 1:** Node inventory (151 nodes, 6,973 lines of embedded code)
- **Phase 2:** Connection map (180 edges, 19 convergence points)
- **Phase 3:** Code audit (72 nodes audited, 6 CRITICAL, 22 HIGH issues)
- **Phase 4:** Issue registry (15 issues catalogued)
- **Phase 5:** Fix plan
- **Phase 6:** Pre-generation review (5 dry runs)
- **Phase 7:** Generated fixed workflow (122 nodes, 0 Step 4 convergence bugs)

The core discovery: n8n's multi-path convergence creates separate execution batches that corrupt data references. This bug was the root cause of most pipeline failures.

### Pipeline Simplification (Session 34, ADR-027)
Collapsed the fixed 127-node workflow down to 27 nodes by replacing branching pipelines (Steps 2, 3a, 3b) with two self-contained Code nodes (`Enrich Companies` at 545 lines, `Find Contacts` at 615 lines). Eliminated all convergence points.

### Parallelized Batch Enrichment (Session 36, ADR-029)
Split into main workflow + sub-workflow architecture. Main workflow handles discovery + dispatch. Sub-workflow enriches batches of 25 companies in parallel via webhook POST. Solved timeout issues (300s task runner cap) and enabled ~5 min total enrichment for 200 companies (vs ~17 min sequential).

### Dashboard-Pipeline Integration (Session 50, ADR-032)
Connected the React dashboard to n8n via `run_id` lifecycle. Dashboard creates `pipeline_runs` row, POSTs to webhook. Pipeline tracks progress (running → batch counts → completed/failed). Dashboard polls for updates.

### Report Generator (Sessions 58-64, ADR-033)
Built a 7-node report generation workflow. ExcelJS generates styled multi-sheet xlsx reports (Summary + tier breakdowns + per-metro tabs). Uploads to Supabase Storage. Required fixing three major bugs:
- BUG-042: ExcelJS blocked by n8n Task Runner sandbox → Docker entrypoint sed hack
- BUG-043: Binary data IPC corruption → Separate Generate/Upload nodes
- BUG-044: ExcelJS `addRow()` broken in task runner → Direct `getCell()` writes

### Enrichment Enhancement v1 (Sessions 62-70, ADR-035)
Added 4 new contact-finding sources to `find-contacts.js` (630 → 968 lines):
- **Hunter Domain Search:** Dominant source, 88% of Toronto contacts
- **Google Reviews:** Works via Places API v1 profile name extraction. Low yield for small metros.
- **Yelp Owner:** Enabled, parsing needs further validation (login wall risk)
- **Facebook Page:** Not yet enabled (login wall risk)

### Apollo Sync v1 (Sessions 75-89, ADR-039)
Built an 11-node workflow to sync enriched Supabase data to Apollo.io CRM:
- 26 account custom fields, 13 contact custom fields
- Domain-based account dedup with name-based fallback
- Synthetic "Front Desk" contacts for companies with no real contacts (enables Orum dialer)
- Immediate Supabase save after each Apollo upsert (prevents ghost loop duplicates)
- Survived 15 sessions of debugging (fetch() conversion, field ID prefixing, mode-stripping, etc.)

### Repo Cleanup (Session 73)
Archived 14 files, rewrote README.md and CLAUDE.md for client handoff. Moved gitignored files to `_archive/`.

---

## 4. Challenges & Solutions (Hard-Won Lessons)

### n8n Batching Bug (THE core issue)
**Problem:** When multiple paths converge on one node in n8n, it creates separate "execution batches" per upstream path. Cross-batch item references (`$('NodeName').item.json`) pair with wrong items. `.all()` picks up duplicates.

**Solution:** Avoid multi-path convergence entirely. Use single Code nodes with `this.helpers.httpRequest()` loops that process items sequentially. This is why the enrichment pipeline uses 500+ line Code nodes instead of visual n8n branching.

**Impact:** This single architectural insight saved the project. The original 151-node workflow was unfixable due to convergence. The simplified 27-node pipeline has been rock-solid.

### n8n Task Runner Sandbox Blocks External Modules (BUG-042)
**Problem:** n8n 2.x mandatory external Task Runners only allow `moment` by default. ExcelJS was blocked with `Module 'exceljs' is disallowed`.

**Solution:** Custom Docker Compose entrypoint on `task-runners` service:
```yaml
user: '0'  # root to edit /etc/
command: |
  sed -i 's/"moment"/"moment,exceljs"/' /etc/n8n-task-runners.json
  ln -sf /home/node/.n8n/node_modules/exceljs /opt/runners/task-runner-javascript/node_modules/exceljs
  exec tini -- /usr/local/bin/task-runner-launcher javascript python
```

### Binary Data IPC Corruption (BUG-043)
**Problem:** When Code nodes generate binary data (xlsx) and upload via `this.helpers.httpRequest()`, the bytes get corrupted during IPC transit between the task runner container and the main n8n process.

**Solution:** Split into separate nodes: Code node outputs binary via `this.helpers.prepareBinaryData()`, then an HTTP Request node handles the upload natively (no IPC corruption).

### MCP updateNode Mode-Stripping (BUG-055)
**Problem:** n8n's `n8n_update_partial_workflow` with `updateNode` replaces the **entire** `parameters` object. If you send `{ jsCode: "..." }`, all other fields like `mode` are stripped. Code node typeVersion 2 defaults to `runOnceForAllItems`, which breaks nodes that need `runOnceForEachItem`.

**Solution:** ALWAYS include `mode` alongside `jsCode` when updating Code nodes via MCP or API:
```json
{ "parameters": { "mode": "runOnceForEachItem", "jsCode": "..." } }
```

### Apollo Field ID Prefixing (BUG-054)
**Problem:** Apollo's `/fields` API returns field IDs prefixed with modality (e.g., `account.69a075...`). The `typed_custom_fields` upsert API requires bare 24-char hex IDs. This bug regressed 3 times across sessions.

**Solution:** `getRawId = (val) => val ? val.split('.').pop() : val` — always strip the prefix.

### Webhook Deregistration on Editor Save (BUG-046)
**Problem:** Saving a workflow in the n8n editor triggers deactivate → save → reactivate. The webhook re-registration can silently fail, leaving the webhook path in a broken permission state. Workflow shows `active: true` but rejects all incoming requests.

**Solution:** After saving in the n8n editor, always deactivate + reactivate via API/UI to force webhook re-registration.

### Double-Trigger Incidents (BUG-039)
**Problem:** n8n's execution list API has latency. New executions may not appear for several minutes. Operators assumed triggers failed and re-triggered, causing duplicate Apify runs that exceeded memory limits.

**Solution:** Pre-flight execution check before ANY webhook trigger. If a trigger was sent within the last 10 minutes, assume it's still running. Never re-trigger optimistically.

### ExcelJS `addRow()` Broken in Task Runner (BUG-044)
**Problem:** `ws.addRow()` doesn't serialize rows to sheet XML in the n8n task runner environment. Summary sheet worked because it used `ws.getCell()` directly.

**Solution:** Use `ws.getCell(row, col).value = ...` instead of `ws.addRow()` for all data sheets.

### pairedItem Chain Breaking After Split In Batches
**Problem:** After `SplitInBatches`, `$('NodeName').item.json` only works for item index 0 in each batch. All other items silently get the wrong upstream reference.

**Solution:** `_config` backpack pattern — embed configuration data on each item in the source node, then read from `$input.item.json._config` instead of cross-node references.

---

## 5. Infrastructure & Operations

### Docker Compose Services (5 containers)

| Service | Image | Purpose |
|---------|-------|---------|
| `n8n` | `n8nio/n8n:2.1.5` | Main n8n server + editor |
| `n8n-worker` | `n8nio/n8n:2.1.5` | Queue worker (executions) |
| `postgresql` | `postgres:16-alpine` | n8n internal database |
| `redis` | `redis:6-alpine` | Bull queue for execution dispatch |
| `task-runners` | `n8nio/runners:2.1.5` | JavaScript/Python Code node execution |

**Key settings:**
- `EXECUTIONS_MODE=queue` — queue-based execution (required for workers)
- `N8N_RUNNERS_MODE=external` — external task runners (mandatory in n8n 2.x)
- `N8N_RUNNERS_MAX_CONCURRENCY=5` — max 5 parallel Code node executions
- `N8N_RUNNERS_TASK_TIMEOUT=1800` — 30 min timeout (default 300s too low)

### Environment Variables (12 required for n8n)

| Variable | Service | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | Supabase | REST API base URL |
| `SUPABASE_SERVICE_KEY` | Supabase | Service role key (full access) |
| `APIFY_TOKEN` | Apify | Yelp scraping |
| `GOOGLE_PLACES_API_KEY` | Google | Places API (discovery + details + reviews) |
| `HUNTER_API_KEY` | Hunter.io | Email finder, verifier, domain search |
| `APOLLO_API_KEY` | Apollo.io | People search + CRM sync |
| `NAMSOR_API_KEY` | NamSor | Name origin/ethnicity |
| `TELNYX_API_KEY` | Telnyx | Phone number verification |
| `BATCH_ENRICHMENT_WEBHOOK_URL` | n8n (internal) | Sub-workflow webhook |
| `REPORT_GENERATOR_WEBHOOK_URL` | n8n (internal) | Report generator webhook |
| `RESEND_API_KEY` | Resend | Email delivery |
| `SNOVIO_API_KEY` | Snov.io | Email finder (not yet configured) |

### Deployment Process

- **Small Code nodes (<3KB):** MCP `n8n_update_partial_workflow` with `nodeId` + `updates.parameters.jsCode` + `updates.parameters.mode`
- **Large Code nodes (>3KB):** Copy file content → paste into n8n editor → Save → Deactivate → Reactivate (to re-register webhooks)
- **Workflow structure changes:** Edit workflow JSON locally → import via n8n editor
- **Always** backup current state to `workflows/current/` before changes

### API Rate Limits & Costs

| API | Rate Limit | Cost per Call | Monthly Spend |
|-----|-----------|---------------|---------------|
| Google Places | Varies | ~$0.017/call | Low (~$5/metro) |
| Apify (Yelp) | Account-limited | ~$0.01/query × 12 queries | ~$0.12/metro |
| Apollo | 5/min | Included in plan | Plan-based |
| Hunter Email Finder | 15/sec, 500/min | 1 credit ($0.10) | ~$10-20/metro |
| Hunter Verifier | 15/sec, 500/min | 1 credit ($0.10) | ~$5-10/metro |
| Hunter Domain Search | 15/sec, 500/min | ~$0.10/lookup | ~$5-15/metro |
| NamSor | 5 concurrent | 10 credits/name | Low |
| Telnyx | Generous | $0.003/lookup | <$1/metro |
| Resend | 100/day (free tier) | Free | Free |

### Monitoring

- **Per-metro health check:** `scripts/diagnostic.sql` — run in Supabase SQL Editor
- **Execution monitoring:** n8n execution list (note: running executions may not appear immediately)
- **Dashboard:** Shows pipeline_runs status, batch progress, download links
- **Run Summary:** Each pipeline execution outputs summary stats (companies discovered, contacts found, errors, API usage)

---

## 6. Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `companies` | Business records | name, phone, domain, discovery_metro, enrichment_status, lead_score |
| `contacts` | People at companies | first_name, last_name, email_business, phone_direct, source, role |
| `social_profiles` | Social media links | company_id, platform, profile_url |
| `scoring_rules` | Configurable lead scoring | field_name, condition, value, points |
| `pipeline_runs` | Run tracking for dashboard | metro, status, total_batches, completed_batches, report_url |
| `discovery_runs` | Legacy run tracking | metro_name, total_discovered, new_records |

### Key Constraints

- `companies.google_place_id` — UNIQUE (the upsert conflict key)
- `companies.domain` and `companies.phone` — NON-UNIQUE indexes (franchise chains share domains/phones)
- `contacts` unique index: `(company_id, source, COALESCE(first_name, ''))` — prevents duplicate contacts
- `social_profiles` unique: `(company_id, platform)` — one profile per platform per company
- `email_status` CHECK: `'unverified', 'verified', 'invalid', 'risky', 'accept_all'`
- `phone_status` CHECK: `'valid', 'invalid', 'disconnected', 'voip'` (defaults NULL, not 'unverified')
- `enrichment_status` CHECK: `'discovered', 'partially_enriched', 'fully_enriched', 'needs_review'`

### Key RPC Functions

- `calculate_lead_scores()` — Resets all scores to 0, applies each active scoring rule. Called via POST to `/rest/v1/rpc/calculate_lead_scores`.
- `increment_completed_batches(p_run_id)` — Atomically increments `completed_batches` and returns current count + total. Used by Track Batch Completion.
- `get_lead_report(p_metro)` — Returns companies + best contact + social profiles for report generation.

### Supabase Access Pattern

All n8n nodes use HTTP Request nodes (NOT the n8n Supabase connector):
```
Headers:
  apikey: $env.SUPABASE_SERVICE_KEY
  Authorization: Bearer $env.SUPABASE_SERVICE_KEY
  Content-Type: application/json

Upserts: + Prefer: resolution=merge-duplicates
Updates (PATCH): + Prefer: return=minimal
RPC calls: POST to /rest/v1/rpc/{function_name}
```

---

## 7. Known Issues & Deferred Work

### Open Bugs

| Bug | Severity | Description |
|-----|----------|-------------|
| BUG-005 | MEDIUM | Email-domain mismatch not detected (ISSUE-012). Some Apollo contacts have emails from different domains (college emails, scheduling platforms). |
| BUG-040 | HIGH | NamSor API returned null for all contacts in BUG-040-era metros (Scottsdale, Nashville, San Diego). Now working (verified Toronto Session 72) but older metros have gaps. |

### Pending Configuration

- **Snov.io:** No API key/account. `skip_snovio` is `"true"`.
- **Facebook source:** `SKIP_FACEBOOK = true`. Not yet tested. High login wall risk.
- **Resend email:** Domain not verified (403 error). Report generation + xlsx upload works; email delivery does not.
- **Apollo Sync:** `APOLLO_API_KEY` env var not yet set in Coolify. Workflow deployed but untested in production.
- **Yelp Owner:** Enabled but low/zero yield. May be hitting login walls. Parsing needs validation.

### Deferred Improvements (from TODO.md)

- Re-run Asheville NC (exec #165 timed out pre-fix)
- NamSor/email re-runs for older metros (Scottsdale, Nashville, San Diego, Tampa)
- Apollo duplicate cleanup in Apollo UI (pre-BUG-053 fix duplicates)
- Search query generator for 1000+ businesses per metro
- API credit budgeting / rate limiting dashboard
- Social profile URL validation
- `yelp_is_claimed` SQL migration (not yet executed)

---

## 8. File Map

### Source of Truth Files

| File/Directory | Purpose |
|----------------|---------|
| `scripts/nodes/*.js` | **Live Code node source** (9 main + 4 report generator). This is the actual pipeline logic. |
| `docs/architecture/schema.sql` | **Full Supabase schema.** The canonical database definition. |
| `docs/decisions/DECISIONS.md` | **39 architectural decision records.** Why things are the way they are. |
| `coolify-docker-compose-fixed.yaml` | **Live Docker Compose config.** The actual deployment definition. |

### Workflow Snapshots (not live — reference copies)

| File | Purpose |
|------|---------|
| `workflows/current/deployed-fixed.json` | Main workflow (23 nodes) |
| `workflows/current/sub-workflow-deployed.json` | Sub-workflow (7 nodes) |
| `workflows/current/error-handler-deployed.json` | Error handler (2 nodes) |
| `workflows/generated/report-generator-workflow.json` | Report generator (7 nodes) |
| `projects/apollo_integration_v1/workflow/apollo-sync-workflow.json` | Apollo Sync (11 nodes) |

### Tracking Files

| File | Purpose |
|------|---------|
| `tracking/PROGRESS.md` | Session-by-session log of all work done |
| `tracking/TODO.md` | Active task list (open/completed) |
| `tracking/BUGS.md` | Bug tracking (open/fixed) |
| `tracking/CHANGELOG.md` | Dated change entries |

### Project Documentation

| File/Directory | Purpose |
|----------------|---------|
| `CLAUDE.md` | AI assistant rules and project conventions |
| `README.md` | Project overview and onboarding guide |
| `docs/architecture/api-reference.md` | External API integrations |
| `docs/architecture/n8n-patterns.md` | n8n quirks and patterns |
| `projects/report_generator/` | Report generator handoff doc |
| `projects/enrichment-enhancement-v1/` | Enrichment v1 handoff + design |
| `projects/apollo_integration_v1/` | Apollo sync spec + workflow + migrations |
| `projects/help_center/` | Help center handoff + spec |

### Scripts

| File | Purpose |
|------|---------|
| `scripts/deploy-find-contacts.py` | Deploy find-contacts.js to n8n (reference — needs N8N_API_KEY) |
| `scripts/build-report-workflow.py` | Generate report workflow JSON |
| `scripts/dashboard-schema.sql` | Dashboard DB schema + RPC functions |
| `scripts/diagnostic.sql` | Reusable per-metro health check |
| `scripts/supabase/` | SQL migrations |

### Dashboard

The React dashboard lives in `dashboard/` with its own `CLAUDE.md`, `README.md`, and tracking files. Key features:
- Pipeline trigger + progress tracking
- Run history with batch-level detail
- Lead reports with xlsx download
- Metro coverage table
- Bug reporting
- Help center

---

## 9. Key Numbers

| Metric | Value |
|--------|-------|
| Total sessions | 89 |
| Total metros | 13 |
| Total companies | 2,469 |
| Total contacts | 645 |
| Main workflow nodes | 23 |
| Sub-workflow nodes | 7 |
| Report generator nodes | 7 |
| Error handler nodes | 2 |
| Apollo sync nodes | 11 |
| Code node total lines | ~4,500 |
| ADRs written | 39 |
| Bugs tracked | 55 |
| APIs integrated | 8 (6 active) |
| Batch size | 25 companies |
| Avg pipeline run | ~5-15 min (depending on metro size) |

---

## 10. How to Continue

### Running a new metro
1. Add metro to `dashboard/src/data/metros.ts`
2. Add metro to `scripts/nodes/metro-config.js` METROS lookup (with lat/lng/yelp_location)
3. Trigger from the dashboard

### Re-running an existing metro
Just trigger from the dashboard. The pipeline is idempotent — upserts on `google_place_id` update existing records, new businesses are added, existing enrichment is preserved.

### Modifying enrichment logic
1. Edit the relevant file in `scripts/nodes/`
2. If < 3KB: deploy via MCP with `nodeId` (always include `mode` + `jsCode`)
3. If > 3KB: paste into n8n editor → save → deactivate → reactivate workflow
4. Test with a small metro (Sedona is good — small, fast)

### Adding a new API
1. Add env var to Coolify
2. Add logic to the appropriate Code node (enrich-companies.js, find-contacts.js, or enrich-contacts.js)
3. Add `SKIP_*` toggle defaulting to `true`
4. Deploy and test with one metro
5. Document in `docs/architecture/api-reference.md`
