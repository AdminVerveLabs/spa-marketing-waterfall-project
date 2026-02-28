# CLAUDE.md — n8n Lead Discovery & Enrichment Pipeline

> **Bootstrap prompt for Claude Code.** Paste this into a new project's `CLAUDE.md` to build an n8n-based lead discovery and enrichment pipeline. This encodes patterns and pitfalls from 89 sessions of production development.

## Project Identity

You are building an automated lead discovery and enrichment pipeline using n8n (self-hosted), Supabase (PostgreSQL + REST API), and a React dashboard. The pipeline discovers businesses via search APIs, enriches them with contact information and digital presence signals, scores leads, generates reports, and optionally syncs to a CRM.

**Target output:** Supabase database of enriched business leads + React dashboard for triggering runs and viewing results + xlsx reports per metro.

---

## Architecture Blueprint

### 4-Workflow System

Build exactly this architecture. Do NOT try to build a single monolithic workflow.

```
Main Workflow (~20-25 nodes):
  Webhook (POST) → Metro Config (Code) → Mark Running → [Discovery nodes]
  → Normalize → Dedupe → Insert to Supabase → Batch Dispatcher (Code)
  → Lead Scoring (RPC) → Run Summary (Code)

Sub-Workflow (~7 nodes):
  Webhook (POST) → Respond to Webhook (200 OK immediately)
  → Enrich Companies (Code) → Find Contacts (Code)
  → Enrich Contacts (Code) → Mark Fully Enriched (Code)
  → Track Batch Completion (Code)

Report Generator (~7 nodes):
  Webhook (POST) → Respond → Fetch Data (Code) → Generate Report (Code)
  → Upload to Storage (HTTP Request) → Complete Report (Code) → Send Email (HTTP Request)

Error Handler (2 nodes):
  Error Trigger → Mark Failed (Code)
```

**Why this architecture:**
- Batch dispatch (25 per batch) keeps each sub-workflow execution under the task runner timeout (default 300s)
- Parallel sub-workflows = faster than sequential enrichment
- Fire-and-forget pattern (Respond to Webhook returns 200 immediately) prevents main workflow from blocking
- Atomic batch tracking via Supabase RPC prevents race conditions between parallel sub-workflows
- Report generation is non-blocking, triggered only when the last batch completes
- Error handler catches pipeline failures and marks runs as 'failed'

### Inter-Workflow Communication

Use webhook-based communication between workflows. Store webhook URLs as environment variables (`$env.BATCH_ENRICHMENT_WEBHOOK_URL`, `$env.REPORT_GENERATOR_WEBHOOK_URL`).

### run_id Lifecycle

```
queued (dashboard creates pipeline_run record)
  → running (Mark Running PATCHes pipeline_runs)
  → total_batches set (Batch Dispatcher PATCHes)
  → completed_batches incrementing (Track Batch Completion calls RPC)
  → completed (last batch) / failed (Error Handler)
```

Guard all run_id code with `if (!runId)` so the pipeline works without a dashboard trigger (legacy/curl mode).

---

## n8n Rules (Critical — Read Every One)

### 1. NEVER Use Multi-Path Convergence

This is the single most important rule. When multiple paths converge on one node in n8n:
- n8n creates separate "execution batches" per upstream path
- `$('NodeName').item.json` pairs with wrong items across batches
- `.all()` picks up duplicates across batches
- Merge (Append) nodes fire per-batch, not after all batches

**Solution:** Use single Code nodes with `this.helpers.httpRequest()` loops. Process items sequentially inside the Code node. This is why enrichment nodes are 500+ lines — it's the only safe pattern.

### 2. Use `this.helpers.httpRequest()` — NOT `$http`

`$http` does not exist in n8n Code nodes. Always use:
```javascript
const response = await this.helpers.httpRequest({
  method: 'GET',
  url: 'https://api.example.com/endpoint',
  headers: { 'Authorization': 'Bearer ' + apiKey },
  json: true,  // Always include this
});
// Response is parsed JSON directly — no .body wrapper
// POST body: pass JS object, NOT JSON.stringify()
```

### 3. Use HTTP Request Nodes for Supabase (NOT the n8n Supabase Connector)

The n8n Supabase connector has limited functionality. Always use HTTP Request nodes:
```
Headers:
  apikey: {{$env.SUPABASE_SERVICE_KEY}}
  Authorization: Bearer {{$env.SUPABASE_SERVICE_KEY}}
  Content-Type: application/json

Upserts: add header Prefer: resolution=merge-duplicates
Updates (PATCH): add header Prefer: return=minimal
RPC: POST to /rest/v1/rpc/{function_name}
```

### 4. Code Node Mode Must Always Be Explicit

n8n Code node typeVersion 2 has two modes:
- `runOnceForEachItem` — runs once per input item. Access via `$input.item.json`.
- `runOnceForAllItems` — runs once for all items. Access via `$input.all()`.

**ALWAYS set mode explicitly.** If the mode field is missing, it defaults to `runOnceForAllItems`, which will silently break nodes that expect per-item processing.

### 5. MCP/API `updateNode` Replaces Entire Parameters

When updating Code nodes via API or MCP `n8n_update_partial_workflow`:
```json
// WRONG — strips mode, causing silent regression:
{ "parameters": { "jsCode": "..." } }

// CORRECT — always include mode:
{ "parameters": { "mode": "runOnceForEachItem", "jsCode": "..." } }
```

This single pitfall caused a critical bug that took 3 sessions to diagnose. The node appeared to work but only processed 1 item per batch instead of 25.

### 6. Binary Data from Code Nodes Corrupts via IPC

When Code nodes generate binary data (xlsx, csv, images) and try to upload via `this.helpers.httpRequest()`, bytes get corrupted during IPC transit between the task runner container and the main n8n process.

**Solution:** Split into separate nodes:
1. Code node generates binary → `this.helpers.prepareBinaryData(buffer, filename, mimeType)`
2. HTTP Request node uploads the binary attachment natively (no IPC corruption)

### 7. ExcelJS in Task Runner: `getCell()` Not `addRow()`

`ws.addRow()` doesn't serialize rows to sheet XML in the n8n task runner environment. Use:
```javascript
// WRONG:
ws.addRow(['col1', 'col2', 'col3']);

// CORRECT:
ws.getCell(rowNum, 1).value = 'col1';
ws.getCell(rowNum, 2).value = 'col2';
ws.getCell(rowNum, 3).value = 'col3';
```

### 8. External Modules Blocked by Task Runner

n8n 2.x external Task Runners only allow `moment` by default. To add modules (e.g., ExcelJS):
```yaml
# Docker Compose task-runners service:
user: '0'  # root to edit /etc/
entrypoint: /bin/sh
command:
  - -c
  - |
    sed -i 's/"moment"/"moment,exceljs"/' /etc/n8n-task-runners.json
    ln -sf /home/node/.n8n/node_modules/exceljs /opt/runners/task-runner-javascript/node_modules/exceljs
    exec tini -- /usr/local/bin/task-runner-launcher javascript python
volumes:
  - 'n8n-data:/home/node/.n8n'
```

### 9. `$getWorkflowStaticData('global')` Persists Across Executions

This is NOT per-execution — it persists across ALL executions. If you use it for dedup guards, **clear all keys at the start of each execution** in a node that runs early (e.g., Metro Config). Otherwise, dedup flags from exec #1 permanently block operations in exec #2.

### 10. After Editor Save: Deactivate/Reactivate Webhooks

Saving a workflow in the n8n editor triggers deactivate → save → reactivate. The webhook re-registration can **silently fail**. Workflow shows `active: true` but the webhook endpoint rejects all requests.

**Fix:** After saving, always deactivate + reactivate via API or UI to force webhook re-registration.

### 11. Pre-Flight Check Before Pipeline Triggers

n8n's execution list API has latency — new executions may not appear for several minutes.

Before ANY webhook trigger:
1. List recent executions for the workflow
2. If a trigger was sent within the last 10 minutes, assume it's still running
3. If unsure, wait 5 minutes and re-check
4. NEVER re-trigger optimistically

Double-triggers waste API credits, cause Apify memory collisions, and create confusing partial results.

### 12. pairedItem Chain Breaks After Split In Batches

After `SplitInBatches`, `$('NodeName').item.json` only works for item index 0. All other items silently get the wrong upstream data.

**Solution:** `_config` backpack pattern — embed config data on each item at the source:
```javascript
// In the source node:
return items.map(item => ({
  json: { ...item.json, _config: { apiKey, supabaseUrl, ... } }
}));

// In downstream nodes:
const config = $input.item.json._config;
```

---

## Supabase Patterns

### Auth Headers (every request)
```
apikey: SERVICE_KEY
Authorization: Bearer SERVICE_KEY
Content-Type: application/json
```

### Upsert
```
POST /rest/v1/table_name
Headers: + Prefer: resolution=merge-duplicates
Query: ?on_conflict=conflict_column
```

### PATCH (Update)
```
PATCH /rest/v1/table_name?id=eq.{value}
Headers: + Prefer: return=minimal
```

### RPC (Atomic Operations)
```
POST /rest/v1/rpc/function_name
Body: { "param1": "value1" }
```

Use RPC for atomic operations like batch counter incrementing. PL/pgSQL functions with `SECURITY DEFINER` bypass RLS.

### Schema Tips
- Use `google_place_id` as the unique upsert key for businesses (NOT domain or phone — franchise chains share these)
- Contact dedup: unique index on `(company_id, source, COALESCE(first_name, ''))`
- `email_status` CHECK: `'unverified', 'verified', 'invalid', 'risky', 'accept_all'`
- `phone_status` defaults to NULL (not 'unverified') — NULL means "never verified or no phone"
- `enrichment_status`: `'discovered', 'partially_enriched', 'fully_enriched', 'needs_review'`
- Domain and phone indexes should be NON-UNIQUE

---

## API Integration Playbook

### Rate Limit Reference

| API | Rate Limit | Delay Between Calls | Cost |
|-----|-----------|---------------------|------|
| Google Places | Per-project quota | None needed (API handles it) | ~$0.017/call |
| Apify (Yelp) | Account memory limit | N/A (async actor runs) | ~$0.01/query |
| Apollo People Search | 5/min | 2s between batches of 3 | Plan-based |
| Hunter Email Finder | 15/sec, 500/min | None needed | 1 credit |
| Hunter Verifier | 15/sec, 500/min | None needed | 1 credit |
| Hunter Domain Search | 15/sec, 500/min | 1s between calls | ~$0.10 |
| NamSor | 5 concurrent | 500ms interval | 10 credits/name |
| Telnyx | Generous | None needed | $0.003/lookup |

### Error Handling Pattern

For each API call in a Code node loop:
```javascript
try {
  const resp = await this.helpers.httpRequest({ ... });
  // Process response
} catch (err) {
  // Log error to stats object, DON'T throw
  stats.errors.push({ company: company.name, error: err.message });
  // Continue to next item
  continue;
}
```

Never let a single API failure break the entire batch. Use try/catch per-item with stats tracking.

### Domain Blocklist

Maintain a blocklist of booking platform domains that are NOT real company domains:
```javascript
const BLOCKED_DOMAINS = [
  'wixsite.com', 'wix.com', 'setmore.com', 'schedulista.com',
  'glossgenius.com', 'square.site', 'genbook.com', 'jane.app',
  'acuityscheduling.com', 'mindbodyonline.com', 'mindbody.io',
  'vagaro.com', 'fresha.com', 'schedulicity.com', 'booksy.com',
  'massagebook.com', 'noterro.com', 'clinicsense.com',
  'calendly.com', 'squarespace.com'
];

const isBlocked = (domain) =>
  BLOCKED_DOMAINS.some(b => domain === b || domain.endsWith('.' + b));
```

Filter at discovery time (before insert) and at enrichment time (before API lookups).

### Contact Dedup Strategy

Use a database-level unique index + conflict resolution:
```sql
CREATE UNIQUE INDEX idx_contacts_company_source_name
  ON contacts (company_id, source, COALESCE(first_name, ''));
```

Insert with:
```
on_conflict=company_id,first_name,last_name,source
Prefer: resolution=ignore-duplicates
```

---

## Batch Processing Pattern

### 1. Discovery Polling

After discovery inserts complete, the Batch Dispatcher polls Supabase for newly discovered companies:
```javascript
// Poll every 15s until count stabilizes for 2 consecutive checks
let lastCount = -1, stableChecks = 0;
for (let i = 0; i < 20; i++) {
  const companies = await fetchDiscoveredCompanies(metro);
  if (companies.length === lastCount && companies.length > 0) {
    stableChecks++;
    if (stableChecks >= 2) break;  // Stable for 30s
  } else {
    stableChecks = 0;
    lastCount = companies.length;
  }
  await sleep(15000);
}
```

### 2. Batch Splitting

Split discovered companies into batches of 25:
```javascript
const BATCH_SIZE = 25;
const batches = [];
for (let i = 0; i < companyIds.length; i += BATCH_SIZE) {
  batches.push(companyIds.slice(i, i + BATCH_SIZE));
}
```

### 3. Parallel Webhook Dispatch

Fire all batches simultaneously via `Promise.all()`:
```javascript
await Promise.all(batches.map((batch, idx) =>
  this.helpers.httpRequest({
    method: 'POST',
    url: webhookUrl,
    body: { metro, company_ids: batch, run_id, batch_index: idx },
    json: true,
  })
));
```

### 4. Atomic Completion Tracking

Use a Supabase RPC function for atomic batch counting:
```sql
CREATE OR REPLACE FUNCTION increment_completed_batches(p_run_id UUID)
RETURNS TABLE(completed INTEGER, total INTEGER) AS $$
  UPDATE pipeline_runs
  SET completed_batches = completed_batches + 1
  WHERE id = p_run_id
  RETURNING completed_batches, total_batches;
$$ LANGUAGE sql;
```

### 5. Report Trigger on Last Batch

In Track Batch Completion:
```javascript
const result = await rpc('increment_completed_batches', { p_run_id: runId });
if (result.completed >= result.total) {
  // PATCH run to 'completed'
  // POST to report generator webhook (non-blocking)
}
```

---

## Report Generation Pattern

### ExcelJS with Cell-by-Cell Writes

```javascript
const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const ws = workbook.addWorksheet('Sheet Name');

// Headers
const headers = ['Company', 'Phone', 'Domain', ...];
headers.forEach((h, i) => {
  ws.getCell(1, i + 1).value = h;
  ws.getCell(1, i + 1).font = { bold: true };
});

// Data rows
data.forEach((row, rowIdx) => {
  ws.getCell(rowIdx + 2, 1).value = row.company;
  ws.getCell(rowIdx + 2, 2).value = row.phone;
  // ...
});
```

### Binary Data Handling

```javascript
// In Generate Report Code node:
const buffer = await workbook.xlsx.writeBuffer();
const binary = await this.helpers.prepareBinaryData(
  Buffer.from(buffer),
  'report.xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
);
return [{ json: { filename, run_id }, binary: { data: binary } }];

// Then use an HTTP Request node (NOT Code) to upload the binary attachment
```

### Column Letter Helper (for >26 columns)

```javascript
function colLetter(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
// colLetter(1) = 'A', colLetter(27) = 'AA'
```

---

## Tracking & Conventions

### File Structure

```
scripts/nodes/          # Live Code node source (JS files)
workflows/current/      # Workflow JSON snapshots (reference only)
workflows/generated/    # Generated workflow JSON
docs/architecture/      # Schema, API reference, n8n patterns
docs/decisions/         # Architecture Decision Records (ADRs)
projects/{feature}/     # Feature handoff docs
tracking/               # PROGRESS.md, TODO.md, BUGS.md, CHANGELOG.md
dashboard/              # React dashboard source
```

### Session Tracking

Update these files at the END of every session:

- **`tracking/PROGRESS.md`** — What you accomplished this session. Include session number, date, and bullet points.
- **`tracking/TODO.md`** — New tasks discovered, completed tasks marked. Organized by priority.
- **`tracking/BUGS.md`** — Any bugs found or fixed. Include severity, location, symptom, root cause, fix, status.
- **`tracking/CHANGELOG.md`** — Dated entry with sections: Features, Bug Fixes, Deployment, Files Updated.
- **`docs/decisions/DECISIONS.md`** — Any architectural decisions. Format: Date, Decision, Reason, Alternatives, Trade-offs, Status.

### Decision Record Format

```markdown
## ADR-NNN: Short Title
- **Date:** YYYY-MM-DD
- **Decision:** What was decided
- **Reason:** Why this approach was chosen
- **Alternatives considered:** What else was evaluated and why it was rejected
- **Trade-offs:** What we're giving up
- **Status:** Active / Superseded by ADR-XXX
```

---

## Docker/Coolify Deployment

### 5-Service Docker Compose

```yaml
services:
  n8n:             # Main server + editor (port 5678)
    image: n8nio/n8n:2.1.5
    environment:
      - EXECUTIONS_MODE=queue
      - N8N_RUNNERS_ENABLED=true
      - N8N_RUNNERS_MODE=external
    volumes: ['n8n-data:/home/node/.n8n']

  n8n-worker:      # Queue worker (processes executions)
    image: n8nio/n8n:2.1.5
    command: worker
    depends_on: [n8n, postgresql, redis]

  postgresql:      # n8n internal database
    image: postgres:16-alpine

  redis:           # Bull queue for execution dispatch
    image: redis:6-alpine

  task-runners:    # Code node execution sandbox
    image: n8nio/runners:2.1.5
    user: '0'      # Required to edit /etc/ for module allowlist
    # Custom entrypoint for external module support (see Rule 8)
    depends_on: [n8n]
```

### Key Environment Variables

```
N8N_RUNNERS_TASK_TIMEOUT=1800    # 30 min (default 300s too low)
N8N_RUNNERS_MAX_CONCURRENCY=5    # Max parallel Code node executions
N8N_RUNNERS_MODE=external        # Mandatory in n8n 2.x
EXECUTIONS_MODE=queue            # Required for workers
```

### Health Checks

Every service needs a health check. n8n: `wget -qO- http://127.0.0.1:5678/`. Redis: `redis-cli ping`. Postgres: `pg_isready`. Task runners: `wget -qO- http://127.0.0.1:5680/`.

---

## Common Pitfalls Checklist

| # | Pitfall | One-Line Fix |
|---|---------|-------------|
| 1 | Multi-path convergence corrupts item references | Use single Code nodes with loops, never branch+merge |
| 2 | `$http` is not defined in Code nodes | Use `this.helpers.httpRequest()` |
| 3 | MCP updateNode strips `mode` from Code nodes | Always include `mode` alongside `jsCode` |
| 4 | Binary data corrupts via task runner IPC | Use `prepareBinaryData()` + HTTP Request node for upload |
| 5 | ExcelJS `addRow()` broken in task runner | Use `ws.getCell(row, col).value = ...` |
| 6 | Task runner blocks external modules | Docker entrypoint: sed allowlist + ln symlink |
| 7 | `$getWorkflowStaticData` persists across executions | Clear all keys at execution start |
| 8 | Editor save breaks webhook registration | Deactivate + reactivate after save |
| 9 | Execution list API has latency | Wait 5+ min before re-triggering |
| 10 | `pairedItem` breaks after SplitInBatches | Use `_config` backpack pattern on items |
| 11 | n8n Supabase connector is limited | Use HTTP Request nodes with service key auth |
| 12 | Franchise chains share domains/phones | Domain/phone indexes must be NON-UNIQUE |
| 13 | Role-based emails (info@) are valid for solos | Route to company.email, keep on contact if only email |
| 14 | Apollo field IDs are prefixed | `getRawId = val => val.split('.').pop()` |
| 15 | Code node mode defaults to `runOnceForAllItems` | Always set mode explicitly |
| 16 | IF nodes unreliable for complex conditions | Replace with Code node filters |
| 17 | POST body needs JS object, not JSON.stringify | Pass object directly with `json: true` |
| 18 | httpRequest response has no `.body` wrapper | Response IS the parsed JSON directly |
| 19 | Supabase PATCH needs `Prefer: return=minimal` | Add header or get 406 errors |
| 20 | Task runner timeout defaults to 300s | Set `N8N_RUNNERS_TASK_TIMEOUT=1800` |
