# n8n API & Webhook Reference Guide

Self-contained reference for connecting to a self-hosted n8n instance, triggering workflows, pulling execution data, and checking execution status.

---

## 1. Authentication

### REST API

All n8n REST API calls require an API key in the header:

```
GET https://{your-n8n-domain}/api/v1/{endpoint}
Headers:
  X-N8N-API-KEY: {your-api-key}
```

**Where to find/create the API key:** n8n Settings → API → Create API Key.

### Webhook Endpoints

Webhook calls do NOT use the API key. They use the webhook path directly:

```
POST https://{your-n8n-domain}/webhook/{webhook-path}
Content-Type: application/json
```

No auth header needed — the webhook path itself acts as the access token.

---

## 2. Trigger a Workflow (Webhook)

### Endpoint

```
POST https://{your-n8n-domain}/webhook/{webhook-path}
Content-Type: application/json
```

### Example Request (curl)

```bash
curl -X POST https://your-n8n.example.com/webhook/my-webhook-path \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "metro_name": "Austin, TX",
    "latitude": "30.2672",
    "longitude": "-97.7431",
    "some_config": "value"
  }'
```

### Key Behaviors

- **Response Mode = "Immediately":** Returns HTTP 200 right away. The workflow runs asynchronously in the background.
- **Response Mode = "Last Node":** Blocks until the workflow finishes, then returns the last node's output as the response body.
- The workflow **must be ACTIVE** for the webhook to be registered. Inactive workflows won't receive webhook calls.
- **Pitfall:** Activating a workflow via the n8n API (`POST /api/v1/workflows/{id}/activate`) does NOT always register webhook endpoints. Webhooks created via API/MCP may require one manual activation toggle in the n8n UI to register properly. Schedule Trigger nodes DO register correctly via API.

### Accessing Webhook Data Inside n8n

In Code nodes downstream of a Webhook trigger:

```javascript
// Webhook v2 wraps POST body under .body
const inputData = $input.first().json;
const payload = inputData.body || inputData;

// Then access fields:
const runId = payload.run_id;
const metroName = payload.metro_name;
```

---

## 3. Pull Execution Data

### List Executions

```
GET /api/v1/executions
Headers: X-N8N-API-KEY: {key}
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `workflowId` | string | Filter by workflow ID |
| `status` | string | `success`, `error`, `waiting` |
| `limit` | number | Results per page (1-100, default 100) |
| `cursor` | string | Pagination cursor from previous response |
| `includeData` | boolean | Include full execution data (node inputs/outputs). Default: false |

**Example: Get last 10 executions for a workflow**

```bash
curl -s "https://your-n8n.example.com/api/v1/executions?workflowId=yxvQst30sWlNIeZq&limit=10" \
  -H "X-N8N-API-KEY: your-api-key"
```

**Example: Get only failed executions**

```bash
curl -s "https://your-n8n.example.com/api/v1/executions?workflowId=yxvQst30sWlNIeZq&status=error&limit=5" \
  -H "X-N8N-API-KEY: your-api-key"
```

### Get a Single Execution

```bash
curl -s "https://your-n8n.example.com/api/v1/executions/{executionId}" \
  -H "X-N8N-API-KEY: your-api-key"
```

**Response includes:**
- `id` — execution ID
- `finished` — boolean
- `mode` — `webhook`, `trigger`, `manual`, etc.
- `startedAt` / `stoppedAt` — ISO timestamps
- `workflowId` — which workflow ran
- `status` — `success`, `error`, `waiting`
- `data` — full node-level input/output data (when `includeData=true` on list, or always on single get)

### Pagination

The list response includes:
```json
{
  "data": [...],
  "nextCursor": "abc123",
  "hasMore": true
}
```

Pass `cursor=abc123` to get the next page.

---

## 4. Check if a Workflow is Running

### API Check

```bash
curl -s "https://your-n8n.example.com/api/v1/executions?status=running&limit=1" \
  -H "X-N8N-API-KEY: your-api-key"
```

If `data` array is non-empty, something is currently executing.

**To check a specific workflow:**

```bash
curl -s "https://your-n8n.example.com/api/v1/executions?status=running&workflowId={id}&limit=1" \
  -H "X-N8N-API-KEY: your-api-key"
```

### Critical Caveat: API Latency

The n8n execution list API has **significant latency** — newly started executions may not appear in the list for several minutes. This means:

- If you just triggered a webhook within the last ~10 minutes, **assume it's still running** even if the API shows no running executions.
- Do NOT use `status=running` as the sole check for "is it safe to trigger again." Combine it with:
  1. Tracking when you last sent a trigger (timestamp-based guard)
  2. A Supabase/database status field updated by the workflow itself (see Section 5)

### Safe Pre-Trigger Check Pattern

```
1. Check database: any runs with status = 'running'?
   → YES: do not trigger, wait
2. Check n8n API: any executions with status = 'running'?
   → YES: do not trigger, wait
3. Check: did we send a trigger in the last 10 minutes?
   → YES: do not trigger, wait
4. All clear → safe to trigger
```

---

## 5. Workflow Management API

### List All Workflows

```bash
curl -s "https://your-n8n.example.com/api/v1/workflows" \
  -H "X-N8N-API-KEY: your-api-key"
```

### Get Workflow Details

```bash
curl -s "https://your-n8n.example.com/api/v1/workflows/{workflowId}" \
  -H "X-N8N-API-KEY: your-api-key"
```

Returns the full workflow JSON including all nodes, connections, and settings.

### Activate / Deactivate

```bash
# Activate
curl -s -X POST "https://your-n8n.example.com/api/v1/workflows/{workflowId}/activate" \
  -H "X-N8N-API-KEY: your-api-key"

# Deactivate
curl -s -X POST "https://your-n8n.example.com/api/v1/workflows/{workflowId}/deactivate" \
  -H "X-N8N-API-KEY: your-api-key"
```

---

## 6. Status Tracking via Supabase (Recommended Pattern)

Since the n8n execution API has latency, a more reliable pattern is having the workflow itself update a status field in your database:

### Lifecycle

```
Dashboard INSERTs run row (status: 'queued')
  → POST webhook
    → n8n PATCHes status → 'running' + started_at + n8n_execution_id
    → n8n processes...
    → n8n PATCHes status → 'completed' + results + completed_at
    (or on error: → 'failed' + error message)
```

### n8n Code Node Example (Mark Running)

```javascript
const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const runId = $input.item.json.run_id;

await this.helpers.httpRequest({
  method: 'PATCH',
  url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${runId}`,
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  },
  body: {
    status: 'running',
    started_at: new Date().toISOString(),
    n8n_execution_id: $execution.id
  }
});
```

### Stale Run Cleanup (SQL)

Catch runs stuck in 'running' for too long:

```sql
UPDATE pipeline_runs
SET status = 'failed',
    errors = ARRAY['Timed out — no completion callback after 90 minutes'],
    completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '90 minutes';
```

---

## Quick Reference

| Operation | Endpoint | Auth |
|-----------|----------|------|
| Trigger workflow | `POST /webhook/{path}` | None (path is the token) |
| List executions | `GET /api/v1/executions` | `X-N8N-API-KEY` header |
| Get execution | `GET /api/v1/executions/{id}` | `X-N8N-API-KEY` header |
| Check running | `GET /api/v1/executions?status=running` | `X-N8N-API-KEY` header |
| List workflows | `GET /api/v1/workflows` | `X-N8N-API-KEY` header |
| Get workflow | `GET /api/v1/workflows/{id}` | `X-N8N-API-KEY` header |
| Activate | `POST /api/v1/workflows/{id}/activate` | `X-N8N-API-KEY` header |
| Deactivate | `POST /api/v1/workflows/{id}/deactivate` | `X-N8N-API-KEY` header |
