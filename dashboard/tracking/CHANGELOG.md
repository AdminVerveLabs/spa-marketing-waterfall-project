# Changelog

## 2026-02-19 — Session 3: .xlsx Report Download

### Feature: Download report for completed runs
- Installed `xlsx` (SheetJS Community Edition) for client-side .xlsx generation
- Created `src/lib/export.ts` — `downloadRunReport(metroName)` function:
  - Queries companies WHERE `discovery_metro = metroName` AND `enrichment_status != 'needs_review'`
  - Queries contacts WHERE `company_id` IN those company IDs
  - Builds 2-sheet workbook: **Companies** (18 columns) and **Contacts** (15 columns)
  - Triggers browser download as `{metro_name}-report.xlsx`
- Updated `RunHistoryTable.tsx` — Download button with spinner next to Re-run (completed runs only)
- Updated `RecentRunsTable.tsx` — Same pattern, Download + Re-run side by side

### Build Verification
- `npx tsc --noEmit` — zero errors
- `npm run build` — clean (711KB JS + 14KB CSS)

---

## 2026-02-19 — Session 2: Pre-Supabase Code Fixes

### Fix 1: Re-run flow (CRITICAL)
- `NewRunPage.tsx` reads `rerun` query param via `useSearchParams()`, fetches previous run from Supabase
- `NewRunForm.tsx` accepts `initialData` prop, pre-fills country/state/city/radius/queries via `useEffect`
- Shows "Re-running: {metro_name}" indicator above the form

### Fix 2: Nested `<tbody>` (CRITICAL)
- `CoverageTable.tsx` replaced inner `<tbody>` wrappers with `React.Fragment`
- Single `<tbody>` now wraps all `<tr>` elements — valid HTML

### Fix 3: Sidebar active state (MEDIUM)
- `Sidebar.tsx` changed `startsWith` to exact `===` match for active detection
- `/runs/new` and `/runs` no longer both highlight simultaneously

### Fix 4: Error handling on Supabase fetches (HIGH)
- `DashboardPage`, `HistoryPage`, `ReportsPage`, `NewRunPage` all destructure `error` from Supabase queries
- Show `toast.error()` on failure, set `loading = false` so pages render with empty data

### Fix 5: Search query validation (LOW)
- `NewRunForm.tsx` caps queries at 10 (MAX_QUERIES constant)
- Shows red warning text when exceeded, disables submit button

### Build Verification
- `npx tsc --noEmit` — zero errors
- `npm run build` — clean (422KB JS + 14KB CSS)

## 2026-02-19 — Session 1: Full SPA Build

### Phase 1: Extract Prototype into SPA (20 files)
- Decomposed 1019-line prototype (`vervelabs-run-manager.jsx`) into 20 TypeScript files
- Created type definitions: `PipelineRun`, `SearchQueryTemplate`, `RunCoverageStats`, `MetroCity`, `MetroData`
- Expanded metro data from 16 cities to ~55 cities (30 US states, 7 CA provinces)
- Replaced all 16 inline SVG icon components with lucide-react imports
- Added `cancelled` status to StatusBadge component
- Created react-router-dom routing (5 routes: login, dashboard, new-run, history, reports)
- Fixed BUG-D001: hardcoded date in timeAgo → uses `new Date()`
- Fixed BUG-D002: hardcoded month in stats → dynamic month/year comparison

### Phase 2: Supabase Wiring (3 new files + page modifications)
- Created `src/lib/supabase.ts` — Supabase client with env var validation
- Created `src/lib/auth.tsx` — React auth context (session, signIn, signOut, onAuthStateChange)
- Created `src/lib/webhooks.ts` — Webhook trigger with graceful fallback
- Wired LoginPage to Supabase `signInWithPassword`
- Wired DashboardPage to fetch from `pipeline_runs`
- Wired NewRunPage to fetch templates + insert runs + trigger webhook
- Wired HistoryPage to fetch all runs
- Wired ReportsPage to fetch from `run_coverage_stats` view
- Protected routes redirect to `/login` when unauthenticated

### Phase 4: Docker Deployment (3 files)
- Created `Dockerfile` — 2-stage build (node:20-alpine → nginx:alpine)
- Created `nginx.conf` — SPA routing, asset caching, security headers
- Created `.dockerignore` — excludes node_modules, .env, docs, tracking

### Build Verification
- `npm run build` passes with zero TypeScript errors
- Output: 420KB JS + 14KB CSS (gzipped: 120KB + 4KB)

## 2026-02-18 — Initial Setup
- Created dashboard folder structure and documentation
- Build spec, Lovable prompt, and clickable prototype completed
- Supabase schema designed (pipeline_runs, search_query_templates, run_coverage_stats)
- n8n webhook integration pattern documented
