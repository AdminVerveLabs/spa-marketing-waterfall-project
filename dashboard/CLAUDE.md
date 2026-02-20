# CLAUDE.md — Project Rules

## Identity

You are working on the Spa Marketing Waterfall project — an n8n pipeline that discovers and enriches massage therapy business leads. The system uses n8n for orchestration, Supabase (PostgreSQL) for storage, and Apify/Hunter/NamSor/Telnyx for data.

## Current State

The pipeline was simplified from 127 → 27 → 22+6 nodes (main workflow + sub-workflow) across Sessions 34-36. It ran Sedona AZ end-to-end (exec #170) but a diagnostic revealed **all digital signals are zero** — the root cause is 2 HTTP Request nodes that drop 12 fields from the insert payload. See `docs/HANDOFF-pipeline-recovery.md` for the full diagnosis and fix plan.

## Architecture

```
Main Workflow (22 nodes, webhook-triggered):
  Webhook → Metro Config → Google Places → Yelp (Apify) 
  → Normalize → Dedupe → Prepare for Supabase → Insert to Supabase
  → Batch Dispatcher (polls for discovered companies, dispatches batches of 25)

Sub-Workflow (6 nodes, webhook POST from Batch Dispatcher):
  Webhook → Respond → Enrich Companies → Find Contacts 
  → Enrich Contacts → Mark Fully Enriched

Main Workflow (continued after all batches):
  → Calculate Lead Scores → Run Summary
```

### Key Workflow IDs
- **Main:** `yxvQst30sWlNIeZq` (webhook: `001b878c-b5af-4c3c-8b78-d41e526049f4`)
- **Sub:** `fGm4IP0rWxgHptN8` (webhook: `batch-enrichment-v1`)

### Key Files
| File | Lines | Purpose |
|---|---|---|
| `scripts/nodes/enrich-companies.js` | 554 | Google Details, website scrape, booking detection, email extraction, PATCH to Supabase |
| `scripts/nodes/find-contacts.js` | 629 | Apollo search, solo detection, about page scraping, INSERT contacts |
| `scripts/nodes/enrich-contacts.js` | 613 | Hunter email finder/verifier, NamSor, Telnyx phone verify, PATCH contacts |
| `scripts/nodes/prepare-for-supabase.js` | ~100 | Maps discovery data to 26-field Supabase insert payload |
| `scripts/nodes/batch-dispatcher.js` | 151 | Polls Supabase for discovered companies, dispatches batches to sub-workflow |
| `scripts/nodes/mark-fully-enriched.js` | 42 | PATCHes companies to fully_enriched |
| `scripts/diagnostic.sql` | 301 | Single-JSON health check per metro |
| `docs/architecture/schema.sql` | 348 | Full Supabase schema |

---

## Critical Rules

### 1. Always Track Your Work
- **START** every session by reading `tracking/PROGRESS.md`
- **END** every session by updating:
  - `tracking/PROGRESS.md` — What you accomplished
  - `tracking/TODO.md` — New tasks discovered, completed tasks moved
  - `tracking/BUGS.md` — Any bugs found or fixed
  - `tracking/CHANGELOG.md` — Dated entry of changes
  - `docs/decisions/DECISIONS.md` — Any architectural decisions made
- **NEVER** skip tracking updates.

### 2. n8n MCP Access
You have MCP tools for n8n workflow management:
- `n8n_list_workflows` — List all workflows
- `n8n_get_workflow` — Get workflow JSON by ID
- `n8n_update_partial_workflow` — Update specific nodes (use `updateNode` operations)
- `n8n_executions` — Get execution data (use `action=get id=<id> mode=summary` or `mode=full`)

**Critical MCP rules:**
- Array index notation silently fails (e.g., `parameters.assignments[2].value`). Always replace entire `parameters` object instead.
- Any MCP change is overwritten if someone saves from the n8n editor UI.
- Always backup workflow state before modifying via MCP.

### 3. Supabase Access Pattern
- Always use HTTP Request nodes (NOT the n8n Supabase connector)
- Auth: `apikey` header + `Authorization: Bearer {service_key}`
- Upserts: Include `Prefer: resolution=merge-duplicates` header
- Updates (PATCH): Include `Prefer: return=minimal` header
- Base URL: `$env.SUPABASE_URL` + `/rest/v1/{table}`
- **Always filter by `discovery_metro`** — every Supabase fetch must be metro-scoped to prevent cross-contamination

### 4. No Secrets in Code
All API keys, URLs, tokens are n8n environment variables. Reference as `$env.VARIABLE_NAME`. Never hardcode credentials.

---

## Hard-Won Rules (From 35+ Bugs)

These rules are non-negotiable. Every one was learned from a production failure.

### Architecture
1. **No multi-path convergence.** Use Code nodes with loops instead of branching pipelines. This is non-negotiable.
2. **No polling for step coordination.** Each step should have its own data, fetched inline. If you need to "wait" for something, the architecture is wrong.
3. **Idempotent everything.** Re-running any step should produce the same result. Include partial states in retry queries (e.g., `enrichment_status=in.(discovered,partially_enriched)`).

### n8n-Specific
4. **Inline HTTP in Code nodes.** Use `this.helpers.httpRequest()` with try/catch per item. One failure shouldn't stop the batch. `$http` does not exist in n8n Code nodes.
5. **Per-execution scope only.** Don't use `$getWorkflowStaticData('global')` for dedup — it persists across executions. Use local variables.
6. **Merge (Append) nodes fire per-batch**, not after all batches complete. Don't rely on them for aggregation.
7. **`onError: continueRegularOutput` hides failures.** Use intentionally with logging, never as a catch-all.
8. **Task runner timeout** is 1800s. Design Code nodes to complete within this. For >200 companies, batch into sub-workflows.

### Data Quality
9. **Whitelist audit on new fields.** Any new database column must be traced through the entire insert chain: Normalize → Deduplicate → Prepare for Supabase → Insert HTTP body.
10. **Account for DEFAULT values in queries.** `is.null` doesn't match columns with DEFAULT values. Use `or=(field.is.null,field.eq.default_value)`.
11. **Domain blocklist at discovery, not enrichment.** Block booking platforms (wixsite.com, setmore.com, vagaro.com, etc.) before inserting to Supabase. Full list: wixsite.com, wix.com, setmore.com, schedulista.com, glossgenius.com, square.site, genbook.com, jane.app, acuityscheduling.com, mindbodyonline.com, mindbody.io, vagaro.com, fresha.com, schedulicity.com, booksy.com, massagebook.com, noterro.com, clinicsense.com, calendly.com, squarespace.com.
12. **Franchise chains share domains/phones.** Only `google_place_id` is truly unique per location. Domain and phone indexes are NOT unique.
13. **Role-based emails (info@, contact@) are valid for solo practitioners** (~30-40% of this vertical). Don't blanket-reject them. Route to `company.email` when appropriate.
14. **Credential patterns** (LMT, CMT, RMT) appear as last names. Filter them in validation.
15. **Non-target businesses** appear in Google/Yelp results. Filter with blocklist: school, college, university, association, federation, union, board of, institute, academy, program.

### API-Specific
16. **Apollo returns ~0% contacts** for local massage businesses. Real value comes from Google Places (phone, website) and solo detection (owner name).
17. **Rate limiting:** All API calls need explicit delays. Apollo: 2s after every 3 calls. Hunter/NamSor/Telnyx: 100-200ms between calls.
18. **About page scraping** must try 6 URL paths: /about, /about-us, /about-me, /our-team, /team, /our-story.

---

## Code Node Patterns

```javascript
// In Code nodes, use this.helpers.httpRequest() — NOT $http
const response = await this.helpers.httpRequest({
  method: 'GET',
  url: `${process.env.SUPABASE_URL}/rest/v1/companies`,
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  },
  qs: { discovery_metro: 'eq.Sedona, AZ', enrichment_status: 'eq.discovered' }
});
// Response is parsed JSON directly (no .body wrapper)

// Sub-workflow Code nodes must unwrap webhook body:
const inputData = $input.first().json;
const payload = inputData.body || inputData;  // Webhook v2 wraps under .body
```

---

## Notifications

You have access to a notification system to communicate with Zack asynchronously.

**Send `completion` notifications when:** a major task finishes, a deployment completes, tests pass after a significant change.

**Send `decision` notifications when:** an architectural choice needs to be made, something is broken/blocked and you need direction.

**Do NOT notify for:** routine file edits, small refactors, easily reversible decisions.

```bash
curl -s -X POST https://ping-zack.vercel.app/api/notify \
  -H "Authorization: Bearer $PING_ZACK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "completion",
    "title": "Brief title",
    "message": "Details about what was accomplished.",
    "source": "claude-code"
  }'
```

For decision notifications, add `"urgency": "normal"` and `"options": ["Option A", "Option B"]`. **Pause work on that decision branch** until you hear back.