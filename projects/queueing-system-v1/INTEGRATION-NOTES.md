# Queuing System v1 — Integration Notes

## Workflow IDs

| Workflow | ID | Status |
|---|---|---|
| Queue Wrapper v1 | `7Ix8ajJ5Rp9NyYk8` | INACTIVE — activate after validation |
| Main Pipeline | `yxvQst30sWlNIeZq` | Active (not modified) |
| Sub-workflow | `fGm4IP0rWxgHptN8` | Active (not modified) |
| Report Generator | `SL9RrJBYnZjJ8LI6` | Active (not modified) |
| Error Handler | `ovArmKkj1bs5Af3G` | Active (not modified) |

## Setup Steps

### 1. Run SQL scripts in Supabase (in order)

```
01-pipeline-queue-table.sql   — creates pipeline_queue table
02-category-blocklist.sql     — creates category_blocklist + seed data
03-chain-blocklist.sql        — creates chain_blocklist + seed data
04-cleanup-functions.sql      — creates 5 cleanup functions
05-test-cleanup.sql           — dry-run validation queries (SELECT only)
```

Run `05-test-cleanup.sql` and review output before proceeding. This shows what WOULD be deleted from existing data.

### 2. Seed the queue

Use the seed loader workflow OR run the SQL insert in `seed-loader-workflow.json` comments to add metros to `pipeline_queue`.

### 3. Activate the Queue Wrapper

In n8n, activate workflow `7Ix8ajJ5Rp9NyYk8`. It runs every 30 minutes via Schedule Trigger.

---

## Wiring Guide

### Execute Step 1 (placeholder → main pipeline)

Replace the NoOp "Execute Step 1" with an HTTP Request node that POSTs to the main pipeline webhook:

```
POST $env.MAIN_WORKFLOW_WEBHOOK_URL
Content-Type: application/json

{
  "metro_name": "Price, UT",
  "latitude": 39.5994,
  "longitude": -110.8107,
  "radius_meters": 15000,
  "search_queries": ["massage therapist Price UT", "spa Price UT"],
  "yelp_location": "Price, UT",
  "run_id": "<from pipeline_runs if created>"
}
```

The existing Metro Config node already reads these fields from the POST body. No changes to the main workflow needed.

### Execute Steps 2-4 (placeholder → enrichment)

Steps 2-4 (enrichment) run automatically via Batch Dispatcher after Step 1 completes. The placeholder may become a "wait for completion" polling node that checks `pipeline_runs.status` until `completed` or `failed`.

For v1, the placeholder is a pass-through. The queue wrapper marks complete after cleanup runs, even though enrichment may still be in progress via the sub-workflow.

### Cleanup Timing

**Current (v1):** Cleanup runs after the Execute Step 1 placeholder. Since Step 1 is a NoOp, cleanup runs immediately against existing data.

**Future (v2):** Ideally cleanup runs BETWEEN discovery (Step 1) and enrichment (Steps 2-4) to save API credits. This requires splitting the main workflow so the queue wrapper can inject cleanup between phases. For now, cleanup after full pipeline is sufficient.

### Error Handler Node

The Error Handler Code node is defined in `queue-wrapper-workflow.json` but not deployed (n8n requires all nodes be connected). Add it when implementing proper error routing:

1. Set `onError: "continueErrorOutput"` on Mark Running, Run Cleanup
2. Connect their error outputs to the Error Handler node
3. Error Handler implements retry logic (re-queues with incremented retry_count, or marks failed after max_retries)

The Mark Complete node already has built-in try-catch that marks items as failed on error.

---

## Monitoring Queries

### Queue status dashboard
```sql
SELECT status, COUNT(*) AS cnt
FROM pipeline_queue
GROUP BY status
ORDER BY CASE status
  WHEN 'running' THEN 1
  WHEN 'pending' THEN 2
  WHEN 'failed' THEN 3
  WHEN 'complete' THEN 4
END;
```

### Stuck job detection (running > 2 hours)
```sql
SELECT id, metro_name, started_at,
  NOW() - started_at AS running_duration
FROM pipeline_queue
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '2 hours';
```

### Retry queue (failed but retryable)
```sql
SELECT id, metro_name, retry_count, max_retries, error_message
FROM pipeline_queue
WHERE status = 'failed'
  AND retry_count < max_retries
ORDER BY priority DESC, queued_at ASC;
```

### Reset stuck jobs back to pending
```sql
UPDATE pipeline_queue
SET status = 'pending', started_at = NULL
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '2 hours';
```

### Completion rates
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'complete') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'running') AS running,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'complete') / NULLIF(COUNT(*), 0), 1) AS completion_pct
FROM pipeline_queue;
```

---

## Open Questions (from plan)

1. **Chiropractor** — Include in category blocklist? Some overlap with massage therapy.
2. **Hotel/Resort** — Block all hotels, or only block when no "Spa" in category?
