# Spa Marketing Waterfall — n8n Workflow Rebuild

## What This Is

An automated lead discovery and enrichment pipeline for massage therapy clinics across US metro areas. Built as n8n workflows connected to Supabase, hosted on Hetzner VPS via Coolify.

**Current state:** Steps 1-3a work. Step 4 (Enrich People) has critical n8n batching bugs when multiple workflow paths converge. This repo exists to methodically investigate, fix, and regenerate the complete n8n workflow JSON.

## Quick Start (for AI Coding Assistants)

**READ THESE FILES IN THIS ORDER:**

1. `CLAUDE.md` — Project rules, conventions, and constraints
2. `tracking/PROGRESS.md` — Current status, what's done, what's next
3. `docs/architecture/overview.md` — Full system architecture
4. `docs/architecture/schema.sql` — Supabase database schema
5. `docs/architecture/api-reference.md` — All external API integrations

**THEN execute Phase 1:**

6. `docs/investigation/INVESTIGATION-PLAN.md` — The phased investigation plan (START HERE for work)

## Repo Structure

```
spa-waterfall-repo/
├── CLAUDE.md                          # Rules for AI assistants (Cursor/Claude Code)
├── README.md                          # This file
├── .cursor/                           
│   └── rules                          # Cursor-specific rules
├── .claude/
│   └── CLAUDE.md                      # Claude Code rules (symlinked)
├── docs/
│   ├── architecture/
│   │   ├── overview.md                # Full system architecture & pipeline
│   │   ├── schema.sql                 # Supabase schema (source of truth)
│   │   ├── api-reference.md           # Hunter, Apollo, NamSor, Snov.io endpoints
│   │   └── n8n-patterns.md            # Known n8n quirks and patterns
│   ├── investigation/
│   │   ├── INVESTIGATION-PLAN.md      # Master plan for workflow analysis
│   │   ├── phase1-node-inventory.md   # [Generated] Every node cataloged
│   │   ├── phase2-connection-map.md   # [Generated] Full wiring diagram
│   │   ├── phase3-code-audit.md       # [Generated] Every code node reviewed
│   │   ├── phase4-issue-registry.md   # [Generated] All bugs/issues found
│   │   └── phase5-fix-plan.md         # [Generated] Prioritized fix plan
│   ├── decisions/
│   │   └── DECISIONS.md               # Architecture Decision Records
│   └── api-reference/
│       ├── hunter.md                  # Hunter.io API details
│       ├── apollo.md                  # Apollo API details
│       ├── namsor.md                  # NamSor API details
│       └── snovio.md                  # Snov.io API details
├── workflows/
│   ├── current/                       # Current n8n workflow JSONs (as-is)
│   │   └── README.md                  # How to export/import workflows
│   ├── generated/                     # AI-generated fixed workflows
│   └── backups/                       # Timestamped backups before changes
├── scripts/
│   └── validate-workflow.js           # Workflow JSON validation script
├── tests/
│   └── workflow-tests.md              # Test cases for each step
├── tracking/
│   ├── PROGRESS.md                    # Auto-updated progress tracker
│   ├── TODO.md                        # Prioritized task list
│   ├── BUGS.md                        # Known bugs with status
│   └── CHANGELOG.md                   # What changed and when
└── .gitignore
```

## How Progress Tracking Works

Every AI session MUST:
1. Read `tracking/PROGRESS.md` at the start
2. Update `tracking/PROGRESS.md` at the end with what was done
3. Log any new bugs in `tracking/BUGS.md`
4. Log any decisions in `docs/decisions/DECISIONS.md`
5. Move completed items in `tracking/TODO.md`

This is enforced in `CLAUDE.md` rules.

## Environment

- **n8n:** Self-hosted on Hetzner VPS via Coolify
- **Supabase:** Hosted Postgres with REST API
- **APIs:** Hunter.io, Apollo.io, NamSor, Snov.io (future), Google Places, Apify
- **All secrets** are in n8n environment variables (never committed to repo)
