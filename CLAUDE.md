# CLAUDE.md — Project Rules

## Identity

You are working on the Spa Marketing Waterfall project — an n8n workflow pipeline that discovers and enriches massage therapy business leads. The codebase is n8n workflow JSON files connected to Supabase.

## Critical Rules

### 1. Always Track Your Work
- **START** every session by reading `tracking/PROGRESS.md`
- **END** every session by updating:
  - `tracking/PROGRESS.md` — What you accomplished
  - `tracking/TODO.md` — New tasks discovered, completed tasks moved
  - `tracking/BUGS.md` — Any bugs found or fixed
  - `tracking/CHANGELOG.md` — Dated entry of changes
  - `docs/decisions/DECISIONS.md` — Any architectural decisions made
- **NEVER** skip tracking updates. This is how continuity works across sessions.

### 2. Investigation Before Implementation
- **NEVER** generate fixed workflow JSON without completing the investigation phases first
- The investigation phases exist in `docs/investigation/INVESTIGATION-PLAN.md`
- Each phase produces a deliverable document that MUST be written before proceeding
- Phase outputs are cumulative — later phases reference earlier ones

### 3. n8n Workflow JSON Rules
- n8n workflows are JSON files with `nodes[]` and `connections{}` objects
- Every node has: `id` (UUID), `name` (unique string), `type`, `typeVersion`, `position[x,y]`, `parameters`
- Connections reference nodes BY NAME, not by ID
- Node names must be unique within a workflow
- Code nodes have `jsCode` in `parameters` — this is the actual logic
- IF nodes route: first output = condition TRUE, second output = condition FALSE
- HTTP Request nodes with `onError: "continueRegularOutput"` won't break on failures

### 4. Known n8n Batching Issue (THE CORE BUG)
When multiple paths converge on one node WITHOUT a proper merge strategy:
- n8n creates separate "execution batches" per upstream path
- `$('NodeName').item.json` pairs with wrong items across batches
- `$('NodeName').all()` picks up duplicates across batches
- Merge (Append) nodes fire per-batch, not after all batches complete
- **Solution:** Either avoid multi-path convergence entirely OR use Code nodes in `runOnceForAllItems` mode with explicit deduplication by contact ID

### 5. Code Node Patterns
```javascript
// runOnceForEachItem — for per-item transforms
// Access current item:
const item = $input.item.json;
// Access paired upstream item:
const upstream = $('NodeName').item.json;  // ⚠️ BREAKS with multi-path convergence
// Return single object:
return { json: { ...item, newField: value } };

// runOnceForAllItems — for aggregation/deduplication
// Access all items:
const items = $input.all();
// Or from a specific node:
const items = $('NodeName').all();  // ⚠️ May duplicate across batches
// Return array:
return items.map(i => ({ json: i.json }));
```

### 6. Supabase Access Pattern
- Always use HTTP Request nodes (NOT the n8n Supabase connector)
- Auth: `apikey` header + `Authorization: Bearer {service_key}`
- Upserts: Include `Prefer: resolution=merge-duplicates` header
- Updates (PATCH): Include `Prefer: return=minimal` header
- Base URL: `$env.SUPABASE_URL` + `/rest/v1/{table}`

### 7. File Conventions
- Workflow JSONs go in `workflows/current/` (as-is) or `workflows/generated/` (fixed)
- Always backup to `workflows/backups/` with timestamp before modifying
- Investigation outputs go in `docs/investigation/` with the prescribed filenames
- Decision records go in `docs/decisions/DECISIONS.md`

### 8. No Secrets in Code
- All API keys, URLs, tokens are n8n environment variables
- Reference as `$env.VARIABLE_NAME` in workflow JSON
- Never hardcode credentials anywhere

### 9. Testing Approach
- After generating a workflow JSON, validate structure with `scripts/validate-workflow.js`
- Document test cases in `tests/workflow-tests.md`
- Test with `skip_*` toggles set to `"true"` first (zero API credits)
- Then enable one API at a time with small batch sizes (5-10)

### 10. Communication Style
- Be direct. State what you're doing and why.
- When you find a bug, log it immediately in `tracking/BUGS.md`
- When you make a decision, log it in `docs/decisions/DECISIONS.md` with reasoning
- If something is ambiguous, document the ambiguity rather than guessing

### 11. Notifications

You have access to a notification system to communicate with Zack asynchronously. Use it to avoid blocking on approvals and to keep him informed.

#### When to notify

**Send `completion` notifications when:**
- A major task or milestone is finished
- A deployment completes
- A long-running process wraps up
- Tests pass after a significant change

**Send `decision` notifications when:**
- An architectural choice needs to be made (e.g., database schema, API design patterns)
- A product/UX decision could go multiple ways
- You encounter a tradeoff that affects the project outcome
- A dependency or approach choice has significant implications
- Something is broken/blocked and you need direction

**Do NOT notify for:**
- Routine file edits, small refactors, or incremental progress
- Decisions that are easily reversible or low-stakes
- Things you can reasonably infer from existing patterns in the codebase

#### How to notify

```bash
# Task completed
curl -s -X POST https://ping-zack.vercel.app/api/notify \
  -H "Authorization: Bearer $PING_ZACK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "completion",
    "title": "Brief title of what was done",
    "message": "More details about what was accomplished, any notable outcomes.",
    "source": "claude-code"
  }'

# Decision needed
curl -s -X POST https://ping-zack.vercel.app/api/notify \
  -H "Authorization: Bearer $PING_ZACK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "decision",
    "title": "Brief description of the decision",
    "message": "Context about the tradeoffs and why this matters.",
    "source": "claude-code",
    "urgency": "normal",
    "options": [
      "Option A — description and tradeoff",
      "Option B — description and tradeoff"
    ]
  }'
```

#### After sending a `decision` notification

- **Pause work on that specific decision branch** — do not proceed with either option
- **Continue working on other unrelated tasks** if available
- If nothing else can be done without the decision, state what you're waiting on and stop

#### Environment

The notification secret is available as `PING_ZACK_SECRET` in the environment.

### 12. Pre-Flight Check Before Pipeline Triggers
- **Before ANY webhook trigger**, check for running executions:
  1. List recent main workflow executions: look for `status: running` or recently-started executions (within last 15 minutes)
  2. List recent sub-workflow executions: new activity means a pipeline is still processing
  3. The n8n execution list API may not show running executions immediately — if a trigger was sent within the last 10 minutes, assume it's still running
- **NEVER re-trigger if unsure** — wait 5 minutes and check again
- **Double-trigger incidents** waste API credits, create duplicate Apify runs that hit memory limits, and produce confusing partial_dispatch results
- This rule exists because of repeated double-trigger incidents (Sedona exec #181, Austin exec #212) where the execution list hadn't updated yet and the trigger appeared to have failed
