# Handoff: Dashboard-to-Pipeline Integration

## Goal

Connect the existing React dashboard (in `dashboard/`) to the n8n pipeline so users can:
- **Trigger pipeline runs** for any metro from the dashboard UI
- **View enrichment results** (companies, contacts, lead scores) in real-time
- **Manage metros** (add new metros, view per-metro stats)

## Prerequisite (BLOCKING)

**Before investigating the dashboard codebase, confirm the user has completed these steps:**
1. Clean up the `dashboard/` folder (remove stale files, update dependencies)
2. Upload the new guide document for the dashboard

Do NOT begin exploring `dashboard/` code until the user confirms this is done.

## Current Dashboard State

- **Stack:** React + Vite + Tailwind CSS
- **Location:** `dashboard/` directory
- **Docs:** `dashboard/docs/architecture/` contains architecture documentation
- **Config:** `dashboard/.env.example` exists for environment variables
- **Dependencies:** `node_modules` present (may need refresh after cleanup)

## Pipeline Integration Points

### 1. Trigger Pipeline Runs
- **Main workflow webhook (GET):** Path `001b878c-b5af-4c3c-8b78-d41e526049f4`
  - Query parameter: `?metro_name=City, ST` (e.g., `?metro_name=Austin, TX`)
  - Base URL: `http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/`
  - Returns execution summary when complete

### 2. Sub-Workflow (Batch Enrichment)
- **Sub-workflow webhook (POST):** Path `batch-enrichment-v1`
  - Called by Batch Dispatcher in main workflow — dashboard does NOT call this directly
  - Useful for monitoring: check sub-workflow execution status to see enrichment progress

### 3. n8n API (Execution Status/History)
- **Base URL:** `http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/api/v1`
- **Endpoints:**
  - `GET /executions?workflowId={id}` — list executions (status, timing)
  - `GET /executions/{id}` — execution details
  - `GET /workflows/{id}` — workflow metadata
- **Main workflow ID:** `yxvQst30sWlNIeZq`
- **Sub-workflow ID:** `fGm4IP0rWxgHptN8`

### 4. Supabase (All Data)
- **Tables:** `companies`, `contacts`, `social_profiles`, `scoring_rules`
- **Views:** `high_priority_leads`
- **Functions:** `calculate_lead_scores()`
- **Access:** Supabase URL + service key (in Coolify env vars, referenced as `$env.SUPABASE_URL` and `$env.SUPABASE_SERVICE_KEY` in n8n)

### 5. Operational Metros (12 total)
Austin TX, Denver CO, Phoenix AZ, Toronto ON, San Diego CA, Boise ID, Portland OR, Nashville TN, Asheville NC, Sedona AZ, Scottsdale AZ, (and one more from Session 48 re-runs)

## Key Constraints

### Pre-Flight Execution Check (CLAUDE.md Rule 12)
Before triggering ANY pipeline run from the dashboard:
1. Check for running executions on main workflow
2. Check for recent sub-workflow activity (ongoing batches = pipeline still running)
3. n8n execution list API has latency — new executions may not appear for several minutes
4. **Never double-trigger** — this wastes API credits and can cause Apify memory collisions

The dashboard MUST implement this check before allowing a user to trigger a run.

### No Secrets in Code
- All API keys, URLs, and tokens must be environment variables
- Dashboard should read Supabase credentials from `.env` (not hardcoded)
- n8n API key (if needed) should also be in `.env`

## Branch

Work will happen on `attempt-improve-enrichment` branch (or a new feature branch if preferred).

## Reference Files
- `workflows/current/deployed-fixed.json` — main workflow snapshot (22 nodes)
- `workflows/current/sub-workflow-deployed.json` — sub-workflow snapshot (6 nodes)
- `scripts/nodes/` — JavaScript source for all Code nodes
- `tracking/PROGRESS.md` — full session history and current state
- `tracking/TODO.md` — open tasks
- `tracking/BUGS.md` — known bugs
