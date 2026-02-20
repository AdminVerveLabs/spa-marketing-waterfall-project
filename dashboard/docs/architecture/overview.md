# Dashboard Architecture Overview

## System Context

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Browser                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         VerveLabs Run Manager (React SPA)              │ │
│  │                                                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────┐  ┌──────────┐  │ │
│  │  │Dashboard │  │ New Run  │  │History│  │ Coverage │  │ │
│  │  └──────────┘  └──────────┘  └──────┘  └──────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           │ Supabase JS Client               │ fetch() POST
           │ (auth, reads, inserts)            │ (fire-and-forget)
           ▼                                  ▼
┌──────────────────────┐         ┌──────────────────────┐
│      Supabase        │         │     n8n (webhook)    │
│                      │         │                      │
│  ● Auth (email/pw)   │◄────────│  Pipeline workflows  │
│  ● pipeline_runs     │ PATCH   │  update run status   │
│  ● query_templates   │ back    │  on complete/fail    │
│  ● run_coverage_stats│         │                      │
│  ● companies (read)  │         └──────────────────────┘
│  ● contacts (read)   │
└──────────────────────┘
```

## Data Flow

### Triggering a Run
1. User fills out New Run form (country → state → city, radius, queries)
2. App inserts row into `pipeline_runs` with `status: 'queued'`
3. App POSTs to n8n webhook with run config + `run_id`
4. n8n webhook responds immediately (202)
5. App redirects to confirmation screen
6. n8n workflow starts executing:
   - First node: PATCHes `pipeline_runs.status → 'running'`
   - Pipeline does its work (Steps 1-5)
   - Last node: PATCHes `pipeline_runs.status → 'completed'` with result counts
   - On error: PATCHes `pipeline_runs.status → 'failed'` with error messages

### Reading Data
- Dashboard stats: `SELECT` aggregates from `pipeline_runs` where `status = 'completed'`
- Recent runs: `SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT 10`
- Run history: `SELECT * FROM pipeline_runs ORDER BY created_at DESC` (with filters)
- Coverage report: `SELECT * FROM run_coverage_stats` (pre-aggregated view)
- Query templates: `SELECT * FROM search_query_templates`

### Re-running a Metro
1. Copy config from existing run (country, state, city, lat, lng, radius, queries, yelp_location)
2. Insert new `pipeline_runs` row with same config, fresh `status: 'queued'`
3. POST to n8n webhook
4. Same flow as triggering a new run

## Pages

### Login (`/login`)
- Supabase `signInWithPassword(email, password)`
- Redirect to `/` on success
- No sign-up — users pre-created in Supabase dashboard

### Dashboard (`/`)
- 4 stat cards (metros covered, companies found, contacts found, runs this month)
- Active run banner (conditional, if any run has status='running')
- Recent runs table (last 10, with re-run buttons)

### New Run (`/runs/new`)
- Location: cascading dropdowns (Country → State/Province → City) from static metro data
- Auto-populated lat/lng/yelp_location on city select
- Radius: preset toggle buttons (5km, 10km, 15km, 25km)
- Search queries: template selector + editable textarea
- Submit: insert to Supabase → POST to webhook → confirmation screen

### Run History (`/runs`)
- Full table of all pipeline_runs
- Filters: search by metro name, status toggle, country toggle
- Re-run button on completed/failed rows

### Coverage Report (`/reports`)
- Summary cards (countries, states, cities covered)
- Expandable tree table: Country → State → City
- Aggregated stats at each level (companies, contacts, runs, last run date)

## Auth Model

- Supabase Auth with email/password
- 2 users pre-created in Supabase dashboard
- Frontend uses anon key — RLS policies allow authenticated users full read/write on `pipeline_runs` and `search_query_templates`
- `ProtectedRoute` component wraps all pages except `/login`
- Session persisted via Supabase's built-in cookie/localStorage handling

## Component Structure (Expected from Lovable)

```
src/
  components/
    layout/
      Sidebar.tsx              # Fixed left sidebar with nav
      ProtectedRoute.tsx       # Auth gate wrapper
    dashboard/
      StatCard.tsx             # Metric card component
      RecentRunsTable.tsx      # Last 10 runs table
      ActiveRunBanner.tsx      # Amber banner for running pipelines
    runs/
      NewRunForm.tsx           # Full new run form
      RunHistoryTable.tsx      # Full history table
      RunFilters.tsx           # Search + filter bar
    reports/
      CoverageTable.tsx        # Expandable hierarchy table
    shared/
      StatusBadge.tsx          # Colored status pills
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    NewRunPage.tsx
    HistoryPage.tsx
    ReportsPage.tsx
  data/
    metros.ts                  # Static US + Canada metro data
  lib/
    supabase.ts                # Supabase client init
    webhooks.ts                # n8n webhook trigger function
  types/
    index.ts                   # TypeScript types
  App.tsx                      # Router + layout
  main.tsx                     # Entry point
```

Note: Lovable may organize slightly differently. That's fine — the important thing is that these concerns are separated, not that the exact file paths match.

## Environment Variables

| Variable | Description | Where Used |
|----------|-------------|------------|
| `VITE_SUPABASE_URL` | Supabase project URL | `src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public, RLS enforced) | `src/lib/supabase.ts` |
| `VITE_N8N_WEBHOOK_URL` | n8n webhook endpoint | `src/lib/webhooks.ts` |
