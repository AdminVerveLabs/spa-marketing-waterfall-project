# Queuing System v1 — Implementation Tracker

## Status: Pipeline Failure Resilience deployed (ADR-040, Session 99) — Awaiting env var + requeue + test

### Phase 1: SQL Schema & Tables
- [x] `01-pipeline-queue-table.sql` — pipeline_queue table with indexes
- [x] `02-category-blocklist.sql` — category blocklist + 12 seed entries
- [x] `03-chain-blocklist.sql` — chain blocklist + 5 seed entries

### Phase 2: Cleanup Functions
- [x] `04-cleanup-functions.sql` — 5 functions:
  - `cleanup_country_filter(p_metro)` — removes non-US companies
  - `cleanup_category_blocklist(p_metro)` — removes blocked categories (with safe-term exemption)
  - `cleanup_chain_blocklist(p_metro)` — removes retail chains by name/domain
  - `cleanup_geo_filter(p_metro, lat, lon, radius_km)` — SKELETON (needs lat/lon on companies)
  - `run_post_discovery_cleanup(p_metro, lat, lon, radius_km)` — orchestrator, callable via Supabase RPC

### Phase 3: Validation Queries
- [x] `05-test-cleanup.sql` — SELECT-only dry-run queries showing what WOULD be deleted

### Phase 4: Queue Wrapper Workflow (ADR-040 — Session 99 overhaul)
- [x] `queue-wrapper-workflow.json` — 10-node workflow JSON
- [x] Deployed to n8n as `7Ix8ajJ5Rp9NyYk8` (INACTIVE, Schedule Trigger disabled)
- [x] Error Handler wired: `errorWorkflow: "Qdwt8jW18uRslMtT"` (Queue Error Handler)
- [x] Execution timeout: 3600s (1 hour)
- Nodes: Schedule Trigger (30min, disabled) → Manual Trigger → Set Config → Fetch Next Pending (atomic claim) → IF Has Metro → **Create Pipeline Run** (INSERTs pipeline_runs, PATCHes queue.run_id) → **Trigger Pipeline** (POSTs to `$env.MAIN_WORKFLOW_WEBHOOK_URL` with run_id) → **Poll Pipeline Status** (30s intervals, 45min max) → Run Cleanup (Supabase RPC, non-fatal) → Mark Complete (counts leads, PATCHes queue to 'complete')

### Phase 5: Integration Notes + Seed Loader
- [x] `INTEGRATION-NOTES.md` — wiring guide, monitoring queries, open questions
- [x] `seed-loader-workflow.json` — 4-node workflow: Manual Trigger → Config → Generate 10 rural metros → Upsert to queue

### Phase 6: Pipeline Failure Resilience (Session 99 — ADR-040)
- [x] **Queue Error Handler** (`Qdwt8jW18uRslMtT`, 2 nodes, ACTIVE) — Error Trigger → Mark Queue Failed (retry up to 3x, marks pipeline_runs as failed)
- [x] **Workflow Controller** (`R28WPY4aopfaIw4O`, 3 nodes, ACTIVE) — Webhook POST for dashboard to activate/deactivate/check workflow status
- [x] **Create Pipeline Run** node — INSERTs pipeline_runs row, links run_id to queue item
- [x] **Poll Pipeline Status** node — Replaces fire-and-forget with 45-min completion polling
- [x] **Sub-workflow errorWorkflow** set to Pipeline Error Handler (`ovArmKkj1bs5Af3G`)
- [x] Scripts: `create-pipeline-run.js`, `poll-pipeline-status.js`, `api-health-check.js`
- [ ] **API Health Check** — Script ready, not yet deployed to main workflow

### Phase 7: Metro Seed List
- [x] `02-seed-pipeline-queue-batch01..08.sql` — 3,987 cities from 2020 Gazetteer
- [x] `03-verify-seed.sql` — 10 verification queries

## Next Steps

1. **Add env var in Coolify:** `MAIN_WORKFLOW_WEBHOOK_URL=http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/001b878c-b5af-4c3c-8b78-d41e526049f4` (restart n8n after)
2. **Run diagnostic SQL** (`06-diagnose-failed-runs.sql`) — identify metros marked complete with 0 leads
3. **Requeue failed metros** (`07-requeue-failed-metros.sql`) — reset affected metros to 'pending'
4. **Verify remote n8n state** — confirm Queue Wrapper has errorWorkflow set, Schedule Trigger disabled
5. **Open Queue Seed Loader** (`I1QRETjRmMh7A1bT`) in n8n editor → click **Test Workflow** to seed metros
6. **Dry-run Queue Wrapper:** Open in n8n editor → Test Workflow → verify full pipeline cycle
7. **Activate Queue Wrapper** — start processing one metro every 30 min

## Decisions Made

1. Hair Salon → ON blocklist (safe-term exemption protects combos)
2. Geo-filter → Deferred to v2 (skeleton function, no schema changes)
3. Cleanup timing → After pipeline completes (simplest, no existing workflow modifications)
4. Massage franchises → KEPT (Massage Envy, Elements NOT blocked)
5. Error Handler → Deployed as separate Queue Error Handler workflow (Session 99)
6. Completion polling → 30s intervals for 45min max (Session 99, ADR-040)
7. Workflow Controller → Separate webhook workflow for dashboard integration (Session 99)

## Open Questions

1. **Chiropractor** — Include in category blocklist?
2. **Hotel/Resort** — Block all, or only when no "Spa" in category?
