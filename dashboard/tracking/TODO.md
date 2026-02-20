# Task List

## Phase 0: Lovable Scaffold (Human-driven)

- [x] ~~Feed Lovable prompt~~ — SKIPPED, built directly from prototype
- [x] Verify all 5 pages render (Login, Dashboard, New Run, History, Coverage)
- [x] Verify cascading metro dropdowns work
- [x] Verify the app builds without errors
- [x] ~~Connect Lovable output to GitHub repo~~ — N/A

## Phase 1: Extract + Integrate into Repo

- [x] Create `src/` directory structure with all components
- [x] Verify `npm install && npm run build` works locally
- [x] Create `src/data/metros.ts` with accurate lat/lng data (~55 cities)
- [x] Create TypeScript types for `PipelineRun`, `SearchQueryTemplate`, `RunCoverageStats`
- [x] `.env.example` exists with the 3 required env vars

## Phase 2: Supabase Wiring

- [ ] Run `dashboard/docs/architecture/schema.sql` in Supabase SQL Editor
- [ ] Verify tables created: `pipeline_runs`, `search_query_templates`
- [ ] Verify view created: `run_coverage_stats`
- [ ] Verify RLS policies are active
- [ ] Create 2 auth users in Supabase dashboard (email/password)
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- [x] Wire login flow to real Supabase auth
- [x] Wire Dashboard page to read from `pipeline_runs`
- [x] Wire New Run form to read `search_query_templates`
- [x] Wire New Run form to insert into `pipeline_runs`
- [x] Wire Coverage Report to read from `run_coverage_stats`

## Phase 3: n8n Webhook Setup

- [ ] Set `VITE_N8N_WEBHOOK_URL` in `.env`
- [ ] In n8n: replace `Manual Trigger` with `Webhook Trigger` node
- [ ] In n8n: update `Metro Config` node to read from webhook body
- [ ] In n8n: add `run_id` field to Metro Config
- [ ] In n8n: add "Mark Running" HTTP Request node after Metro Config
- [ ] In n8n: add "Mark Completed" HTTP Request node after Run Summary
- [ ] In n8n: add error handling to PATCH `status: 'failed'`
- [ ] Test: trigger run from dashboard → verify n8n execution starts
- [ ] Test: verify pipeline_runs status updates (queued → running → completed)
- [ ] Test: verify result counts populate after completion

## Phase 4: Docker Deployment

- [x] Create `Dockerfile` (2-stage: Vite build → Nginx serve)
- [x] Create `nginx.conf` (SPA routing)
- [x] Create `.dockerignore`
- [ ] Test Docker build locally: `docker build -t vervelabs-dashboard .`
- [ ] Test Docker run locally: `docker run -p 3000:80 vervelabs-dashboard`
- [ ] Create new service in Coolify pointed at the GitHub repo
- [ ] Set env vars in Coolify
- [ ] Assign subdomain
- [ ] Verify SSL works
- [ ] Verify app loads at production URL

## Code Fixes (Pre-Supabase)

- [x] Fix re-run flow: read `rerun` query param, pre-fill form — 2026-02-19
- [x] Fix nested `<tbody>` in CoverageTable → `React.Fragment` — 2026-02-19
- [x] Fix sidebar active state: exact match instead of `startsWith` — 2026-02-19
- [x] Add error handling on all Supabase fetches — 2026-02-19
- [x] Add search query limit (max 10) with validation — 2026-02-19

## Phase 5: Testing + Polish

- [ ] End-to-end: trigger a real pipeline run from production dashboard
- [ ] Verify all pages show correct data after a completed run
- [ ] Verify re-run button works (with pre-filled form)
- [ ] Verify coverage report aggregates correctly
- [ ] Check for console errors across all pages
- [ ] Verify auth redirect works (unauthenticated user → login page)
- [ ] Verify session persistence (refresh page → still logged in)
- [ ] Test with both user accounts

## Features (Post-Session 3)

- [x] Add .xlsx report download for completed runs — 2026-02-19

## Future (Not in scope for initial build)

- [ ] Add run cost estimation
- [ ] Add ability to create/edit query templates from the UI
- [ ] Add individual run detail page with full run log
- [ ] Add Slack/email notification on run completion
- [ ] Add real-time status updates via Supabase subscriptions

## Completed

- Phase 1: SPA extraction from prototype (20 files) — 2026-02-19
- Phase 2: Supabase wiring (3 new files + all pages) — 2026-02-19
- Phase 4: Docker deployment files (3 files) — 2026-02-19
