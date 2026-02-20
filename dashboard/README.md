# VerveLabs Run Manager — Dashboard

## What This Is

A lightweight internal web dashboard for managing pipeline runs across the Spa Marketing Waterfall system. It lets the team select a metro area, trigger the full n8n pipeline, track run status, and view coverage reports. The bulk of lead data lives in Supabase and is consumed elsewhere — this UI is purely for **run orchestration and visibility**.

**Stack:** React + Vite + TypeScript + Tailwind CSS + Supabase Auth/DB  
**Hosting:** Docker container on existing Hetzner VPS via Coolify  
**Users:** 2 (email/password auth via Supabase)

## How This Was Built

The initial app was scaffolded in **Lovable** and then extracted into this repo. Claude Code handles all integration work: Supabase wiring, n8n webhook connections, environment config, Docker deployment, and any fixes/refinements. There is also the initial version of the app (a prototype) that was done by claude (before lovable) you can look at both of these - the file is called "vervelabs-run-manager.jsx" and is in the "dashboard" folder. 

## Quick Start (for AI Coding Assistants)

**READ THESE FILES IN THIS ORDER:**

1. `dashboard/CLAUDE.md` — Project rules, conventions, constraints
2. `dashboard/tracking/PROGRESS.md` — Current status, what's done, what's next
3. `dashboard/docs/architecture/overview.md` — App architecture, pages, data flow
4. `dashboard/docs/architecture/schema.sql` — New Supabase tables (pipeline_runs, search_query_templates)
5. `dashboard/docs/architecture/n8n-integration.md` — Webhook trigger + callback setup

**THEN check the task list:**

6. `dashboard/tracking/TODO.md` — Prioritized work items

## Folder Structure

```
dashboard/
├── CLAUDE.md                          # Rules for AI assistants
├── README.md                          # This file
├── docs/
│   ├── architecture/
│   │   ├── overview.md                # App architecture, pages, data flow
│   │   ├── schema.sql                 # New Supabase tables (source of truth)
│   │   └── n8n-integration.md         # Webhook trigger + callback patterns
│   └── decisions/
│       └── DECISIONS.md               # Architecture Decision Records
├── tracking/
│   ├── PROGRESS.md                    # Session-by-session progress
│   ├── TODO.md                        # Prioritized task list
│   ├── BUGS.md                        # Known bugs with status
│   └── CHANGELOG.md                   # Dated changelog
├── tests/
│   └── test-plan.md                   # Manual + automated test cases
└── src/                               # ← Lovable output lives here (pulled from Lovable repo)
    ├── components/
    ├── pages/
    ├── data/
    ├── lib/
    ├── types/
    └── ...
```

## Relationship to Main Repo

This `dashboard/` folder lives inside the existing `spa-waterfall-repo/`. The dashboard is a **consumer** of the pipeline — it reads from and writes to the same Supabase database, and triggers the same n8n workflows. It does NOT modify pipeline logic.

```
spa-waterfall-repo/
├── workflows/          # n8n workflow JSONs (pipeline logic)
├── docs/               # Pipeline architecture docs
├── tracking/           # Pipeline tracking
├── scripts/            # Pipeline scripts
├── dashboard/          # ← THIS FOLDER (run manager UI)
│   ├── src/            # React app source
│   ├── docs/           # Dashboard-specific docs
│   └── tracking/       # Dashboard-specific tracking
├── CLAUDE.md           # Root project rules
└── README.md           # Root readme
```

## Environment Variables

```env
VITE_SUPABASE_URL=        # Supabase project URL
VITE_SUPABASE_ANON_KEY=   # Supabase anon/public key (RLS enforced)
VITE_N8N_WEBHOOK_URL=     # n8n webhook endpoint for triggering pipeline
```

## Deployment

Docker container on Coolify (same Hetzner VPS as n8n):
1. Vite builds static files
2. Nginx serves them
3. Coolify handles SSL + domain
4. Subdomain: `runs.yourdomain.com` (or similar)
