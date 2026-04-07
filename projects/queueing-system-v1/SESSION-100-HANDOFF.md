# Session 100 Handoff — Post-Freeze Reconciliation + Requeue

## Why We're Doing This

Session 99 (2026-03-13) implemented a major overhaul called **ADR-040: Pipeline Failure Resilience**. The terminal froze mid-deployment, leaving uncertainty about whether the final MCP call to n8n landed. Cursor chat produced a detailed handoff doc describing what was done.

**Two problems need solving:**

1. **Session 99 cleanup** — Verify the frozen session's work was complete, close any gaps in local files and tracking docs
2. **Requeue ~96 failed metros** — The old queue wrapper used fire-and-forget (marked metros "complete" immediately after triggering the pipeline, before it actually finished). ~96 metros were falsely marked `complete` with `leads_found: 0`. These need to be identified, diagnosed, and reset to `pending` for reprocessing under the new ADR-040 completion-polling architecture.

---

## What Session 99 Built (ADR-040)

The queue wrapper was overhauled from fire-and-forget to proper completion tracking:

**Before (broken):**
```
Trigger Pipeline (webhook POST) → Mark Complete immediately (~30s later)
Result: metros marked "complete" before pipeline even finished discovery
```

**After (ADR-040):**
```
Create Pipeline Run (INSERT pipeline_runs row, link run_id to queue)
  → Trigger Pipeline (POST webhook with run_id)
  → Poll Pipeline Status (every 30s for up to 45 min)
  → Run Cleanup (post-discovery RPC)
  → Mark Complete (only after pipeline actually finishes)
  → On failure: Queue Error Handler retries up to 3x
```

**New workflows deployed:**
- Queue Error Handler (`Qdwt8jW18uRslMtT`) — 2 nodes, ACTIVE
- Workflow Controller (`R28WPY4aopfaIw4O`) — 3 nodes, ACTIVE

**New scripts:**
- `scripts/nodes/create-pipeline-run.js`
- `scripts/nodes/poll-pipeline-status.js`
- `scripts/nodes/api-health-check.js` (ready but NOT yet deployed to main workflow)

---

## What Session 100 Has Done So Far

### Completed ✅

1. **Verified all Session 99 local files** — Cross-referenced Cursor handoff doc against actual repo. Everything matches: workflow JSONs, scripts, ADR-040, CHANGELOG, BUGS.

2. **Fixed missing `errorWorkflow` in local JSON** — `queue-wrapper-workflow.json` settings block now includes `"errorWorkflow": "Qdwt8jW18uRslMtT"`. Without this, redeploying from local JSON would lose the error handler link.

3. **Updated stale TRACKER.md** — Was still describing old 9-node layout with "Mark Running" and "Execute Steps 2-4" nodes. Now reflects the current 10-node ADR-040 architecture with Phase 6 section.

4. **Updated TODO.md** — Marked error handler wiring as complete, added diagnostic/requeue tasks, updated Phase 4 description to 10 nodes.

5. **Backfilled Sessions 96-99 in PROGRESS.md** — These were missing (frozen session never wrote them). Added Session 99 (ADR-040 overhaul), 98 (VerveLabs Run Tag), 97 (remove label_names), 96 (Prospect List Assignment).

6. **Added Session 100 entry to PROGRESS.md and CHANGELOG.md**

7. **Created diagnostic SQL** — `projects/queueing-system-v1/sql/06-diagnose-failed-runs.sql` with 7 queries:
   - Queue status overview
   - Complete metros with 0 leads (the ~96 false completions)
   - Cross-reference with actual companies table
   - Enrichment quality per metro (detect which APIs failed)
   - Failed metros and their errors
   - Stuck running metros
   - All complete metros for comparison

8. **Created requeue SQL** — `projects/queueing-system-v1/sql/07-requeue-failed-metros.sql`:
   - Dry-run preview (SELECT) showing what would be requeued and why
   - Step 1: Reset false completions (complete + 0 leads) to pending
   - Step 2: Reset failed metros with retries remaining
   - Step 3: Reset stuck running metros (>2 hours)
   - Step 4: Optional reset of exhausted-retry failures
   - Verification query

9. **Updated n8n MCP API key** in `~/.claude.json` — Old key expired (`iat: 1771386295, exp: 1773964800`). New key: `iat: 1774536206` (no exp field = non-expiring).

---

## What Still Needs to Be Done

### Immediate (this session, after MCP restart)

1. **Verify remote n8n state** — MCP was failing due to expired API key. After restart:
   ```
   n8n_get_workflow id=7Ix8ajJ5Rp9NyYk8 mode=structure  → Queue Wrapper
   n8n_get_workflow id=Qdwt8jW18uRslMtT mode=minimal     → Queue Error Handler
   n8n_get_workflow id=R28WPY4aopfaIw4O mode=minimal     → Workflow Controller
   ```
   Check:
   - Queue Wrapper has 10 nodes matching local JSON
   - `settings.errorWorkflow` = `Qdwt8jW18uRslMtT`
   - `settings.executionTimeout` = 3600
   - Schedule Trigger is **disabled** (the freeze happened during an MCP call that may have temporarily enabled it)
   - If Schedule Trigger is enabled, disable it via MCP partial update

2. **Run diagnostic SQL** (`06-diagnose-failed-runs.sql`) in Supabase SQL Editor — Paste results back so we can identify exactly which metros need reprocessing and why.

3. **Run requeue SQL** (`07-requeue-failed-metros.sql`) — After reviewing diagnostics, uncomment the appropriate UPDATE statements and execute.

### Before First Queue Run (blocking)

4. **Add `MAIN_WORKFLOW_WEBHOOK_URL` env var in Coolify** — Value: `http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/001b878c-b5af-4c3c-8b78-d41e526049f4`. Restart n8n after adding.

5. **Run Seed Loader** — Open Queue Seed Loader (`I1QRETjRmMh7A1bT`) in n8n editor → Test Workflow (seeds 10 rural test metros).

6. **Dry-run Queue Wrapper** — Open Queue Wrapper (`7Ix8ajJ5Rp9NyYk8`) in n8n editor → Test Workflow via Manual Trigger → verify full cycle: claim metro → create pipeline_runs → trigger pipeline → poll status → cleanup → mark complete.

7. **Activate Queue Wrapper** — Enable Schedule Trigger for automatic processing (1 metro every 30 min).

---

## Key File Locations

| File | Purpose |
|------|---------|
| `projects/queueing-system-v1/n8n/queue-wrapper-workflow.json` | Queue Wrapper v1 (10 nodes) — local JSON |
| `projects/queueing-system-v1/n8n/queue-error-handler-workflow.json` | Queue Error Handler (2 nodes) |
| `projects/queueing-system-v1/n8n/workflow-controller-workflow.json` | Workflow Controller (3 nodes) |
| `projects/queueing-system-v1/n8n/seed-loader-workflow.json` | Queue Seed Loader (4 nodes) |
| `projects/queueing-system-v1/sql/06-diagnose-failed-runs.sql` | Diagnostic queries for failed runs |
| `projects/queueing-system-v1/sql/07-requeue-failed-metros.sql` | Requeue scripts (dry-run + UPDATE) |
| `projects/queueing-system-v1/TRACKER.md` | Implementation tracker (updated this session) |
| `scripts/nodes/create-pipeline-run.js` | Create Pipeline Run node source |
| `scripts/nodes/poll-pipeline-status.js` | Poll Pipeline Status node source |
| `scripts/nodes/api-health-check.js` | API Health Check source (not yet deployed) |
| `docs/decisions/DECISIONS.md` → ADR-040 | Architecture decision record |
| `tracking/CHANGELOG.md` → Session 99-100 | Change log |
| `tracking/PROGRESS.md` → Session 99-100 | Progress tracker |
| `tracking/TODO.md` → Queuing System section | Task list |

## n8n Workflow IDs

| Workflow | ID | Status |
|----------|----|--------|
| Queue Wrapper v1 | `7Ix8ajJ5Rp9NyYk8` | INACTIVE (Schedule disabled) |
| Queue Error Handler | `Qdwt8jW18uRslMtT` | ACTIVE |
| Workflow Controller | `R28WPY4aopfaIw4O` | ACTIVE |
| Queue Seed Loader | `I1QRETjRmMh7A1bT` | INACTIVE |
| Main Pipeline | `yxvQst30sWlNIeZq` | ACTIVE (23 nodes) |
| Sub-workflow | `fGm4IP0rWxgHptN8` | ACTIVE (7 nodes) |
| Report Generator | `SL9RrJBYnZjJ8LI6` | ACTIVE (7 nodes) |
| Pipeline Error Handler | `ovArmKkj1bs5Af3G` | ACTIVE (2 nodes) |
| Apollo Sync v1 | `g9uplPwBAaaVgm4X` | ACTIVE (12 nodes) |

## MCP Notes

- n8n MCP API key was updated in `~/.claude.json` (line ~500)
- MCP can only be set for workflows with Schedule Trigger, Webhook, Form, or Chat triggers
- Queue Wrapper, Error Handler, and Seed Loader may not have MCP enabled but have been accessed via MCP in past sessions
- If MCP fails for a specific workflow, fall back to n8n UI or API calls
- **CRITICAL: Always include `mode` alongside `jsCode`** when updating Code nodes via MCP (BUG-055)
