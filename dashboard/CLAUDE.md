# CLAUDE.md — Dashboard Project Rules

## Identity

You are working on the VerveLabs Run Manager — a React dashboard that manages pipeline runs for the Spa Marketing Waterfall system. The app was initially scaffolded in Lovable, then extracted here for integration and deployment. Your job is to wire it into the real infrastructure (Supabase, n8n webhooks, Coolify/Docker) and fix/refine anything that doesn't work correctly.

## Critical Rules

### 1. Always Track Your Work
- **START** every session by reading `dashboard/tracking/PROGRESS.md`
- **END** every session by updating:
  - `dashboard/tracking/PROGRESS.md` — What you accomplished
  - `dashboard/tracking/TODO.md` — New tasks discovered, completed tasks moved
  - `dashboard/tracking/BUGS.md` — Any bugs found or fixed
  - `dashboard/tracking/CHANGELOG.md` — Dated entry of changes
  - `dashboard/docs/decisions/DECISIONS.md` — Any architectural decisions made
- **NEVER** skip tracking updates. This is how continuity works across sessions.

### 2. Understand Before Changing
- **Read** the existing Lovable-generated code before modifying it
- **Check** if Lovable already handles something before reimplementing it
- **Preserve** Lovable's component structure unless there's a clear reason to refactor
- The app should already have pages, routing, and basic UI — your job is integration, not rebuilding

### 3. Supabase Rules
- Use `@supabase/supabase-js` client, initialized once in `src/lib/supabase.ts`
- **Auth:** Supabase email/password auth. No sign-up flow — users are pre-created in Supabase dashboard
- **Anon key only** in the frontend — RLS policies handle authorization server-side
- **Service role key** is NEVER in the frontend — only n8n uses it for write-back callbacks
- New tables (`pipeline_runs`, `search_query_templates`) must be created in Supabase SQL Editor using the schema in `dashboard/docs/architecture/schema.sql`
- The `run_coverage_stats` view must also be created — it powers the Coverage Report page

### 4. n8n Webhook Integration
- The dashboard triggers pipeline runs via a POST to the n8n webhook URL
- Webhook URL comes from `VITE_N8N_WEBHOOK_URL` env var
- The webhook call should fire-and-forget (don't wait for pipeline completion)
- The pipeline_runs record is inserted into Supabase FIRST, then the webhook is called with the `run_id`
- If the webhook fails, the pipeline_runs record stays in 'queued' status — show an error toast but don't delete the record
- n8n handles updating the pipeline_runs record status via callback (this is configured in the n8n workflow, not in the dashboard)

### 5. n8n Workflow Changes Required
The existing n8n workflows need these modifications to work with the dashboard (documented in `dashboard/docs/architecture/n8n-integration.md`):
- Replace `Manual Trigger` → `Webhook Trigger` node
- Update `Metro Config` node to read from webhook body
- Add status update nodes at start (→ running) and end (→ completed/failed)
- These are n8n-side changes, NOT dashboard code changes

### 6. Metro Data
- City/state/country data for the New Run form is a **static TypeScript file** (`src/data/metros.ts`)
- Do NOT fetch metro data from an API or database
- The file should cover top ~50 US metros and ~15 Canadian metros with accurate lat/lng coordinates
- Structure: `Country → State → City[]` with lat, lng, metro_name, yelp_location per city
- If Lovable generated this file, verify coordinates are accurate

### 7. Styling Rules
- Dark theme matching spamarketing.com brand
- Primary accent: `#3ecfad` (teal/mint)
- Font: DM Sans from Google Fonts
- Tailwind CSS for all styling — no separate CSS files unless absolutely necessary
- If Lovable's output looks good, leave it. Don't redesign for the sake of redesigning.

### 8. No Secrets in Code
- All credentials are environment variables (`VITE_*` prefix for Vite)
- `.env` files are gitignored
- Never hardcode Supabase URLs, keys, or webhook URLs

### 9. Docker Deployment
- Dockerfile: 2-stage build (Node for Vite build → Nginx for serving)
- nginx.conf: SPA routing (try_files → /index.html)
- Coolify handles: Git pull, Docker build, SSL cert, domain routing
- Target: deploy as a new service on the existing Hetzner VPS/Coolify instance

### 10. What This Dashboard Does NOT Do
- Does NOT modify pipeline logic (that's in `workflows/`)
- Does NOT store or display individual lead/company data (that's in Supabase Table Editor)
- Does NOT have real-time status updates (users refresh manually)
- Does NOT have user management (users are created directly in Supabase)
- Does NOT export data

### 11. Communication Style
- Be direct. State what you're doing and why.
- When you find a bug, log it in `dashboard/tracking/BUGS.md`
- When you make a decision, log it in `dashboard/docs/decisions/DECISIONS.md`
- If something Lovable generated is broken, document the issue before fixing it
