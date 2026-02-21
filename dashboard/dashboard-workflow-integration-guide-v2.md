# Connecting the Dashboard to the n8n Workflow

## Integration Guide v2 — VerveLabs Run Manager

---

## 1. What We're Connecting

**Dashboard** (React app on Coolify) — users pick a metro, click "Start", manage a run queue, and download reports.

**n8n Workflow** (primary workflow + enrichment subworkflow) — runs Steps 1→2→3a→3b→4 with batches of 25 companies dispatched to a subworkflow for enrichment. Triggered exclusively via webhook.

**Supabase** (cloud) — sits between them. The dashboard writes `pipeline_runs` rows, the workflow updates them as it progresses.

```
Dashboard                    Supabase                     n8n
─────────                    ────────                     ───
1. User clicks "Start"
2. INSERT pipeline_runs ──→  row (status: queued)
3. Check: any run "running"?
   YES → stay in queue
   NO  → POST webhook ──────────────────────────────────→ webhook receives config
                                                          4. PATCH status → running
                             row updated ←────────────────
                                                          5. Primary workflow runs
                                                          6. Subworkflows process batches
                                                          7. PATCH status → completed
                             row updated ←────────────────  + result counts + report URL
                                                          8. Send report email
9. Dashboard picks up next queued run (if any)
10. User downloads report from dashboard
```

---

## 2. Current Workflow Architecture

### Primary workflow + subworkflow
The workflow is NO LONGER monolithic. It has been refactored:
- **Primary workflow:** Handles discovery (Step 1), then dispatches batches of 25 companies to a subworkflow for enrichment
- **Enrichment subworkflow:** Handles Steps 2, 3a, 3b, 4 for a batch of 25 companies
- **Key behavior:** The primary workflow finishes BEFORE the subworkflows complete. This means "primary workflow done" ≠ "run is actually done"

### Trigger
- **Webhook ONLY.** There is no Manual Trigger. The workflow MUST be triggered via webhook POST.
- Claude Code in the workflow terminal already knows the webhook patterns, expected body format, and how to check whether a run is truly complete.

### Known quirks

**1. Primary finishes before subworkflows:**
The primary workflow dispatches batches and returns. Subworkflows continue executing independently. The "Mark Completed" callback MUST be on the subworkflow's final node, and it needs to know when it's the LAST batch finishing (not just any batch). This likely requires either:
- A counter in Supabase tracking dispatched vs completed batches
- Or the last subworkflow checking "are all other batches done?" before marking completed

**2. Apify false starts (memory errors):**
Apify scrapers (Yelp, Facebook, Instagram) can fail immediately due to memory allocation issues. The response comes back quickly with an error. The workflow needs a 30-second health check after starting Apify runs: if the Apify run status shows failed with a memory-related error code, auto-resubmit. Only retry once — if it fails again, log the error and continue.

**3. "Is it actually running?" detection is unreliable:**
Claude Code has made mistakes thinking a run isn't active when it actually is (subworkflows still executing). This can cause a loop: dashboard thinks it's done → triggers next queued run → n8n is overloaded → crash → dashboard thinks it failed → retriggers. **The safeguard is: only ONE run can be processing at a time, enforced at the dashboard level AND verified before webhook POST.**

**4. Task runner pressure:**
With 60+ Code nodes converted to `runOnceForAllItems`, the task runner is manageable but still under pressure on 4GB RAM. Concurrent runs will crash n8n.

---

## 3. Critical Requirement: Single Run at a Time

### Why
The Hetzner VPS (4GB RAM) cannot handle concurrent pipeline executions. Two simultaneous runs will crash n8n. Even if RAM wasn't an issue, Apify and API rate limits make concurrent runs problematic.

### Implementation

**Dashboard enforces the queue:**
1. When user clicks "Start Pipeline" → insert row with `status: 'queued'`
2. Before POSTing to webhook, check: `SELECT COUNT(*) FROM pipeline_runs WHERE status IN ('running', 'queued_dispatched')`
3. If count > 0 for 'running', the new run stays queued. Show user: "Run queued — {metro_name} is currently processing. Your run will start automatically when it finishes."
4. If count = 0, POST to webhook and update status → 'running'

**Queue processing:**
After a run completes (status changes to 'completed' or 'failed'), the dashboard (or a Supabase trigger/n8n callback) should check for the next queued run and auto-dispatch it.

Options for auto-dispatch:
- **Option A (n8n-side):** The "Mark Completed" callback checks for queued runs and triggers the next one
- **Option B (Dashboard-side):** The dashboard polls `pipeline_runs` periodically and dispatches queued runs when no active run exists
- **Option C (Supabase trigger):** A database trigger on status change fires a webhook

**Option A is most reliable** since it doesn't depend on the user having the dashboard open.

### "Is it actually done?" verification

Before dispatching the next queued run, verify the current run is TRULY done:

```sql
-- A run is truly done when:
-- 1. status = 'completed' or 'failed'
-- 2. AND completed_at is NOT NULL
-- 3. AND (completed_at is at least 2 minutes old — buffer for subworkflow stragglers)
SELECT COUNT(*) FROM pipeline_runs 
WHERE status = 'running' 
  AND started_at < NOW() - INTERVAL '2 minutes';
-- If this returns 0, safe to dispatch
```

Additionally, the stale-run cleanup catches runs stuck in 'running':
```sql
UPDATE pipeline_runs 
SET status = 'failed', 
    errors = ARRAY['Timed out — no completion callback after 90 minutes'],
    completed_at = NOW()
WHERE status = 'running' 
  AND started_at < NOW() - INTERVAL '90 minutes';
```

---

## 4. New Dashboard Feature: Queue Management

### Queued Runs Component

Add a "Queue" section to the Dashboard page (above or below Recent Runs):

**Display:** List of all `pipeline_runs` WHERE `status = 'queued'`, ordered by `created_at ASC` (first in, first out).

**Each queued run shows:**
- Metro name, country, state
- Radius, search queries (truncated)
- Queued timestamp
- Position in queue (#1, #2, etc.)

**Actions per queued run:**
- **Edit** — opens a modal/form pre-filled with the run's config (country, state, city, radius, search queries). User can modify any field, then save. This UPDATEs the existing `pipeline_runs` row.
- **Delete** — removes the `pipeline_runs` row. Confirm before deleting.
- **Move up/down** — optional, for reordering priority. Could use a `queue_position` INTEGER field, or just rely on `created_at` ordering.

**Editable fields** (same as New Run form):
- Country, State, City (cascading dropdowns)
- Radius
- Search queries
- Yelp location (auto-updates when city changes)

**When editing city:** Lat/lng/metro_name/yelp_location all auto-update from the static metros data, same as the New Run form.

### Schema addition for queue management

Add to `pipeline_runs`:
```sql
ALTER TABLE pipeline_runs ADD COLUMN queue_position INTEGER;
```

Or simply use `created_at` for FIFO ordering (simpler, recommended to start).

---

## 5. Apify False Start Handling

### The Problem
Apify actors (especially Yelp scraper) sometimes fail immediately after starting due to memory allocation errors. The Apify API returns a run status of `FAILED` with an error indicating insufficient memory.

### The Solution
Add a health check 30 seconds after starting each Apify run:

```
Start Apify Run → Wait 30s → Check Apify Status
  ├── Status = RUNNING or SUCCEEDED → continue as normal
  ├── Status = FAILED + memory error → re-submit ONCE
  │     └── Wait 30s → Check again
  │           ├── RUNNING/SUCCEEDED → continue
  │           └── FAILED again → log error, skip this source, continue pipeline
  └── Status = FAILED + other error → log error, skip this source, continue pipeline
```

**Detection:** The Apify run status response includes error details. Look for:
- `"statusMessage"` containing "memory" or "out of memory"
- `"exitCode"` values associated with OOM kills

**Only retry for memory errors.** Other failures (invalid input, actor bug, etc.) should not be retried.

**Implementation note:** The workflow already has polling loops for Apify (Wait 30s → Check Status → Parse Status → Succeeded?). The false-start check should happen within this existing pattern — just add a condition at the first status check: if FAILED + memory error, restart the actor run and re-enter the polling loop. Add a `retryCount` field to prevent infinite retry loops.

---

## 6. Preventing Run/Fail/Run/Fail Loops

### The Risk
If the dashboard thinks a run is done (but subworkflows are still executing) and immediately dispatches the next queued run, n8n gets overloaded, the new run fails, and the dashboard dispatches again → infinite crash loop.

### Safeguards

**1. Completion buffer:**
After a run marks as 'completed', wait at least 2 minutes before dispatching the next queued run. This gives subworkflow stragglers time to finish and n8n time to free memory.

**2. Failure cooldown:**
If a run fails, wait 5 minutes before dispatching the next queued run. Don't immediately retry or dispatch.

**3. Consecutive failure circuit breaker:**
If 3 runs in a row fail, STOP auto-dispatching. Set all remaining queued runs to `status: 'paused'` and show a banner in the dashboard: "Pipeline paused — 3 consecutive failures. Check n8n logs before resuming."

**4. n8n execution check before dispatch:**
Before dispatching a queued run, make an API call to n8n to check active executions:
```
GET https://your-n8n.domain/api/v1/executions?status=running&limit=1
Headers: X-N8N-API-KEY: {api_key}
```
If any executions are running, do NOT dispatch. This is the ground-truth check that prevents overlap.

**5. Dashboard polling safety:**
If the dashboard polls for queue processing, use a reasonable interval (every 60 seconds, not every 5 seconds). Each poll should be idempotent — check status, dispatch if safe, do nothing if not.

---

## 7. Reports

### Where Reports Are Generated
Reports should be generated in the **n8n workflow** (not the dashboard). Reasons:
- n8n already has access to all Supabase data via service key
- The report logic (SQL queries, junk filtering, tiering, Excel formatting) is already documented in a Claude Code guide
- Generating in n8n means the report is ready the moment the run completes — no separate trigger needed
- The dashboard just needs to display/download a pre-built file

### Report Generation Flow
At the end of a completed run (after "Mark Completed"):

1. **n8n Code node** runs the report generation script:
   - Queries Supabase for all companies + contacts in the metro that was just processed
   - Applies junk filtering, category cleanup, deduplication
   - Applies tiering logic (Tier 1a, 1b, 2, 3 based on contact quality, verified phone/email, etc.)
   - Generates an Excel (.xlsx) file with Summary sheet + per-tier sheets
   - The report spec already exists in another Claude chat — reference the "VerveLabs Lead Report Generator Guide"

2. **Store the report:**
   - Upload to Supabase Storage (bucket: `run-reports`)
   - File naming: `{metro_name}_{date}_{run_id}.xlsx` (e.g., `Austin_TX_2026-02-20_abc123.xlsx`)
   - Store the file URL in `pipeline_runs.report_url`

3. **Email the report:**
   - n8n Send Email node (SMTP or a service like Resend/SendGrid)
   - To: configured recipient(s) — could be hardcoded or pulled from a config table
   - Subject: "Pipeline Report: {metro_name} — {date}"
   - Body: Brief summary (companies found, contacts found, tier breakdown) + attached report file
   - Store email sent status in pipeline_runs (optional: `report_emailed_at` column)

### Schema additions for reports
```sql
ALTER TABLE pipeline_runs ADD COLUMN report_url TEXT;
ALTER TABLE pipeline_runs ADD COLUMN report_emailed_at TIMESTAMPTZ;
```

### Dashboard Report Access
- **Run History table:** Add a "Report" column. If `report_url` is not null, show a download icon/link
- **Dashboard recent runs:** Same — download link if report exists
- **Report downloads:** The dashboard fetches the file from Supabase Storage using the anon key (ensure the storage bucket has appropriate RLS/policies for authenticated reads)

### Supabase Storage Setup
```sql
-- Create storage bucket for reports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('run-reports', 'run-reports', false);

-- Allow authenticated users to read reports
CREATE POLICY "Authenticated users can read reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'run-reports');

-- Allow service role to upload (n8n uses service key)
-- Service role bypasses RLS, so no policy needed for writes
```

---

## 8. Integration Steps

### Step A: Webhook Trigger (Already Done)
The workflow already uses a Webhook trigger (not Manual Trigger). Claude Code knows the webhook configuration. Verify:
- Webhook path and URL
- Expected request body format
- That it returns immediately (Response Mode: Immediately)

### Step B: Add `run_id` to Metro Config
The Metro Config node needs to pass `run_id` from the webhook body through the entire pipeline so that status callbacks can reference the correct `pipeline_runs` row.

Add to Metro Config:
| Field | Value |
|-------|-------|
| run_id | `{{ $json.body.run_id }}` |

Verify this is accessible downstream: `$('Metro Config').first().json.run_id`

### Step C: Add "Mark Running" Callback
HTTP Request node after Metro Config, before the pipeline starts:

- PATCH `pipeline_runs` → `status: 'running'`, `started_at`, `n8n_execution_id`
- On Error: `continueRegularOutput`

### Step D: Add "Mark Completed" Callback — CRITICAL
Because the primary workflow finishes before subworkflows:

**The completion callback MUST be in the subworkflow**, not the primary workflow.

Approach: track batch completion in Supabase.

1. Primary workflow: after dispatching all batches, PATCH `pipeline_runs` with `total_batches_dispatched: N`
2. Each subworkflow: on completion, increment a counter (Supabase atomic update or a separate `batch_completions` table)
3. The last subworkflow to complete checks: `completed_batches == total_batches_dispatched`
   - If yes → PATCH `pipeline_runs.status = 'completed'` with result totals
   - If no → just increment and exit

Schema addition:
```sql
ALTER TABLE pipeline_runs ADD COLUMN total_batches INTEGER;
ALTER TABLE pipeline_runs ADD COLUMN completed_batches INTEGER DEFAULT 0;
```

Subworkflow completion code (atomic increment + check):
```javascript
const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const runId = $json.run_id; // passed from primary workflow

// Atomic increment
const res = await fetch(
  `${supabaseUrl}/rest/v1/rpc/increment_completed_batches`,
  {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_run_id: runId })
  }
);
const result = await res.json();
// result.is_last_batch = true if this was the final batch

if (result.is_last_batch) {
  // PATCH pipeline_runs → completed + generate report + send email
}
```

Supabase function:
```sql
CREATE OR REPLACE FUNCTION increment_completed_batches(p_run_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total INTEGER;
  v_completed INTEGER;
BEGIN
  UPDATE pipeline_runs 
  SET completed_batches = completed_batches + 1
  WHERE id = p_run_id
  RETURNING total_batches, completed_batches INTO v_total, v_completed;
  
  RETURN json_build_object(
    'total_batches', v_total,
    'completed_batches', v_completed,
    'is_last_batch', v_completed >= v_total
  );
END;
$$ LANGUAGE plpgsql;
```

### Step E: Add "Mark Failed" + Stale Run Cleanup
Same as before — workflow error handler + stale-run detection (90 minutes timeout).

### Step F: Report Generation Node
Add after "Mark Completed" (only fires for the last batch):
1. Code node: generate Excel report from Supabase data
2. Upload to Supabase Storage
3. PATCH `pipeline_runs.report_url`
4. Send email with report attached

### Step G: Queue Dispatcher
Add to the end of the "Mark Completed" flow (after report generation):

```javascript
// Check for next queued run
const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;

// Wait 2 minutes (completion buffer) — use n8n Wait node before this
const res = await fetch(
  `${supabaseUrl}/rest/v1/pipeline_runs?status=eq.queued&order=created_at.asc&limit=1`,
  {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  }
);
const queued = await res.json();

if (queued.length > 0) {
  const next = queued[0];
  // POST to webhook to trigger next run
  await fetch($env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: next.id,
      metro_name: next.metro_name,
      latitude: String(next.latitude),
      longitude: String(next.longitude),
      radius_meters: String(next.radius_meters),
      search_queries: next.search_queries.join(','),
      yelp_location: next.yelp_location,
      country: next.country,
      state: next.state,
      city: next.city
    })
  });
}
```

---

## 9. Investigation Checklist

Before implementing, Claude Code should verify these:

### Must answer:
- [ ] **What is the webhook URL and expected body format?** Claude Code knows this — verify it matches what the dashboard sends
- [ ] **How does the primary workflow dispatch to subworkflows?** Execute Workflow node? Webhook? Need to understand how `run_id` propagates to subworkflows
- [ ] **What is the subworkflow's final node?** This is where "Mark Completed" and the batch-tracking logic goes
- [ ] **How many batches are created for a typical metro?** (companies / 25, rounded up) This determines `total_batches`
- [ ] **Can `$json.body` or `$json` access webhook data?** Test in current n8n version
- [ ] **Where do Apify runs start?** Need to add the false-start health check at each Apify polling loop
- [ ] **What does an Apify memory error response look like?** Get the exact status/error fields to detect

### For reports:
- [ ] **Does the n8n instance have openpyxl/Excel generation capability?** If Code nodes run in a sandbox, they may not have access to Python or npm packages for Excel generation. Alternative: use a dedicated report-generation subworkflow that calls a script
- [ ] **Is Supabase Storage set up?** Create the bucket + policies
- [ ] **SMTP / email service configured in n8n?** For sending report emails

### For queue safety:
- [ ] **Does n8n expose an API to check running executions?** If yes, use it as ground-truth before dispatching. Check if `N8N_PUBLIC_API_DISABLED` is set
- [ ] **What's the n8n API key?** Needs to be stored as env var for the execution check

---

## 10. Phased Rollout

### Phase 1: Queue management (dashboard only, no workflow changes)
- Add queue component to dashboard
- Add edit/delete functionality for queued runs  
- Add single-run enforcement logic
- Manually insert test queued runs and verify UI works

### Phase 2: Webhook trigger + status callbacks
- Add `run_id` to Metro Config
- Add "Mark Running" callback
- Add batch tracking (total_batches, completed_batches, Supabase function)
- Add "Mark Completed" on last subworkflow batch
- Test: trigger from dashboard → verify full status lifecycle

### Phase 3: Apify false-start handling
- Add 30s health check to each Apify polling loop
- Add single-retry for memory errors
- Test by monitoring Apify runs

### Phase 4: Queue auto-dispatch
- Add queue dispatcher to end of "Mark Completed" flow
- Add completion buffer (2 min wait)
- Add failure cooldown (5 min)
- Add circuit breaker (3 consecutive failures → pause)
- Test: queue 3 runs → verify they execute sequentially

### Phase 5: Reports
- Build report generation Code node (reference existing report guide)
- Set up Supabase Storage bucket
- Wire up report upload + URL storage
- Wire up email sending
- Add download links to dashboard
- Test: complete run → verify report generated + emailed + downloadable

### Phase 6: Safety hardening
- Add stale-run cleanup (90 min timeout)
- Add n8n execution API check before dispatch
- Add consecutive failure circuit breaker
- Stress test: queue 5 metros, let it run overnight

---

## 11. Environment Variables

### n8n (verify/add)
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `N8N_WEBHOOK_URL` | Self-referencing webhook URL (for queue auto-dispatch) |
| `REPORT_EMAIL_RECIPIENTS` | Comma-separated emails for report delivery |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email sending config (or Resend/SendGrid API key) |

### Dashboard (.env)
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key (RLS enforced) |
| `VITE_N8N_WEBHOOK_URL` | n8n webhook endpoint |
