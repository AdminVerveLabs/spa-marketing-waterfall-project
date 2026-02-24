# Spa Marketing Waterfall

Automated lead discovery and enrichment pipeline for massage therapy and spa businesses across North American metro areas. The system finds businesses via Google Places and Yelp, enriches them with website data, contact info, and verification, then scores leads for sales outreach. Built with n8n (workflow orchestration), Supabase (PostgreSQL + REST API), and a React dashboard, all deployed on Hetzner VPS via Coolify.

## Architecture

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

    All data stored in Supabase (PostgreSQL):
    companies, contacts, social_profiles, pipeline_runs
```

## How the Pieces Connect

1. **Dashboard triggers a run** — User selects a metro from the dashboard, which POSTs `{ metro_name, run_id }` to the main workflow webhook.
2. **Discovery** — Main workflow queries Google Places API and Yelp (via Apify) for massage/spa businesses, normalizes results, deduplicates, and inserts to Supabase.
3. **Batch dispatch** — Batch Dispatcher polls Supabase for newly discovered companies, splits them into batches of 25, PATCHes `total_batches` to `pipeline_runs`, and fires all batches to the sub-workflow in parallel.
4. **Enrichment** — Each sub-workflow batch enriches companies (Google Details, website scrape, booking detection), finds contacts (Apollo, solo detection, about page, Hunter Domain Search, Google Reviews, Yelp Owner), and enriches contacts (Hunter email finder/verifier, NamSor origin, Telnyx phone verify).
5. **Batch tracking** — Track Batch Completion increments `completed_batches` via Supabase RPC. When the last batch finishes, it PATCHes the run to `completed` and triggers the Report Generator.
6. **Report generation** — Fetches enriched data, generates an xlsx via ExcelJS, uploads to Supabase Storage, optionally emails via Resend.
7. **Dashboard polling** — Dashboard polls `pipeline_runs` to show progress (running/completed/failed), batch counts, and download links.

## Current State

**Working:**
- 12 metros operational: Austin TX, Denver CO, Phoenix AZ, Toronto ON, San Diego CA, Boise ID, Portland OR, Nashville TN, Asheville NC, Sedona AZ, Scottsdale AZ, Tampa FL
- 5 of 6 enrichment APIs enabled: Apollo, NamSor, Hunter (Finder + Verifier), Telnyx
- 2 of 4 new contact sources enabled: Hunter Domain Search, Google Reviews (Enrichment Enhancement v1)
- Report generator fully operational (xlsx generation + Supabase Storage upload)
- Dashboard-pipeline integration fully operational (trigger, progress tracking, download)
- Lead scoring via Supabase RPC function

**Pending:**
- Yelp Owner source — enabled but parsing needs validation (login wall risk)
- Facebook Page source — not yet enabled (login wall risk)
- Snov.io — no API key/account yet
- Resend email delivery — domain not verified (403), non-blocking
- Email-domain mismatch detection (ISSUE-012)

## File Reading Order

For a new Claude Code session, read these files in this order:

| # | File | What You'll Learn |
|---|------|-------------------|
| 1 | `CLAUDE.md` | Project rules, n8n patterns, Supabase conventions |
| 2 | `tracking/PROGRESS.md` | Session history and current state |
| 3 | `tracking/TODO.md` | Open tasks and priorities |
| 4 | `docs/decisions/DECISIONS.md` | 38 architectural decision records |
| 5 | `docs/architecture/schema.sql` | Full Supabase database schema |
| 6 | `docs/architecture/api-reference.md` | All external API integrations |
| 7 | `scripts/nodes/` | The actual pipeline logic (9 Code nodes + 4 report nodes) |
| 8 | `projects/` | Feature handoff docs (report generator, enrichment v1, help center) |

## Environment Variables

### n8n (configured in Coolify environment)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project REST API base URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (full access) |
| `APIFY_TOKEN` | Apify API token for Yelp scraping |
| `GOOGLE_PLACES_API_KEY` | Google Places API key |
| `HUNTER_API_KEY` | Hunter.io API key (email finder + verifier + domain search) |
| `APOLLO_API_KEY` | Apollo.io API key (people search) |
| `NAMSOR_API_KEY` | NamSor API key (name origin/ethnicity) |
| `TELNYX_API_KEY` | Telnyx API key (phone verification) |
| `BATCH_ENRICHMENT_WEBHOOK_URL` | Sub-workflow webhook URL (internal) |
| `REPORT_GENERATOR_WEBHOOK_URL` | Report generator webhook URL (internal) |
| `RESEND_API_KEY` | Resend email API key |
| `SNOVIO_API_KEY` | Snov.io API key (not yet configured) |

### Dashboard (configured in `dashboard/.env.production`)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (public) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (row-level security) |

### Coolify (Docker Compose)

See `coolify-docker-compose-fixed.yaml` for the full service configuration. Key services: n8n, n8n-worker, postgresql, redis, task-runners.

## Common Changes

### Add a new metro
1. Add metro to `dashboard/src/data/metros.ts` (name, state/province, coordinates)
2. Trigger from dashboard — the pipeline handles the rest via Metro Config

### Add search queries
Edit `scripts/nodes/metro-config.js` — search terms are defined per-metro with defaults

### Modify lead scoring
Edit the `calculate_lead_scores` Supabase RPC function (defined in `scripts/dashboard-schema.sql`)

### Add a dashboard page
1. Create component in `dashboard/src/pages/`
2. Add route in `dashboard/src/App.tsx`
3. Add nav link in `dashboard/src/components/layout/Sidebar.tsx`

### Add an enrichment source
1. Add source logic to `scripts/nodes/find-contacts.js` with a `SKIP_*` toggle
2. Add source to `contacts.source` CHECK constraint in Supabase
3. Deploy via manual paste into n8n editor (large Code node — see `scripts/deploy-find-contacts.py` for reference)
4. Enable by setting `SKIP_*` to `false` in the Code node

### Deploy code changes to n8n
- **Small Code nodes (<3KB):** Use n8n API via `n8n_update_partial_workflow` MCP tool with `nodeId`
- **Large Code nodes (>3KB):** Copy file content → paste into n8n editor → Save → Activate
- **Workflow structure changes:** Edit workflow JSON → import via n8n editor
- Always backup current state to `workflows/current/` before changes

## Dashboard

The React dashboard is in `dashboard/`. See `dashboard/README.md` for setup, build, and deployment instructions.

Key features: pipeline trigger + progress tracking, run history, lead reports with xlsx download, metro coverage table, bug reporting, help center.

## Repo Structure

```
├── CLAUDE.md                              # AI assistant rules
├── README.md                              # This file
├── coolify-docker-compose-fixed.yaml      # Live deployment config
├── dashboard/                             # React dashboard (Vite + Tailwind)
│   ├── CLAUDE.md                          # Dashboard-specific AI rules
│   ├── README.md                          # Dashboard setup guide
│   ├── src/                               # React source code
│   ├── docs/                              # Dashboard architecture docs
│   └── tracking/                          # Dashboard progress tracking
├── docs/
│   ├── architecture/
│   │   ├── schema.sql                     # Supabase schema (source of truth)
│   │   ├── api-reference.md               # External API integrations
│   │   └── n8n-patterns.md                # n8n quirks and patterns
│   ├── decisions/
│   │   └── DECISIONS.md                   # 38 architectural decision records
│   └── features/
│       └── bug-reports.md                 # Dashboard bug report feature
├── projects/
│   ├── report_generator/                  # Report generator handoff + guide
│   ├── enrichment-enhancement-v1/         # Enrichment v1 handoff + design
│   └── help_center/                       # Help center handoff + spec
├── scripts/
│   ├── nodes/                             # Live Code node source (9 files)
│   │   ├── batch-dispatcher.js            # 176 lines — batch dispatch logic
│   │   ├── enrich-companies.js            # 545 lines — company enrichment
│   │   ├── enrich-contacts.js             # 613 lines — contact enrichment
│   │   ├── find-contacts.js               # 968 lines — contact discovery (6 sources)
│   │   ├── mark-fully-enriched.js         # 41 lines — mark companies done
│   │   ├── mark-running.js                # 43 lines — mark run as running
│   │   ├── metro-config.js                # 84 lines — metro configuration
│   │   ├── run-summary4.js                # 146 lines — execution summary
│   │   ├── track-batch-completion.js      # 127 lines — batch progress + report trigger
│   │   └── report-generator/              # Report generator Code nodes (4 files)
│   ├── dashboard-schema.sql               # Dashboard DB schema + RPC
│   ├── diagnostic.sql                     # Reusable health check query
│   ├── deploy-find-contacts.py            # Deploy script for find-contacts.js
│   ├── build-report-workflow.py           # Generate report workflow JSON
│   └── supabase/                          # SQL migrations
├── workflows/
│   ├── current/                           # Live workflow snapshots
│   │   ├── deployed-fixed.json            # Main workflow (23 nodes)
│   │   ├── sub-workflow-deployed.json      # Sub-workflow (7 nodes)
│   │   ├── error-handler-deployed.json    # Error handler (2 nodes)
│   │   └── README.md                      # Import/export instructions
│   └── generated/
│       └── report-generator-workflow.json # Report generator workflow
├── tracking/
│   ├── PROGRESS.md                        # Session history
│   ├── TODO.md                            # Active task list
│   ├── BUGS.md                            # Bug tracking
│   └── CHANGELOG.md                       # Change log
└── _archive/                              # Historical files (gitignored)
```
