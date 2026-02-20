# Test Plan — VerveLabs Run Manager

## Auth Tests

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| A1 | Navigate to `/` without auth | Redirected to `/login` | 🔲 |
| A2 | Login with valid credentials | Redirected to `/`, sidebar shows user | 🔲 |
| A3 | Login with wrong password | Error message shown, stays on login | 🔲 |
| A4 | Refresh page after login | Still authenticated, stays on current page | 🔲 |
| A5 | Click sign out | Redirected to `/login`, session cleared | 🔲 |

## Dashboard Tests

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| D1 | Load dashboard with no pipeline_runs | All stat cards show 0, empty table | 🔲 |
| D2 | Load dashboard with completed runs | Stat cards show correct aggregates | 🔲 |
| D3 | Active run exists (status='running') | Amber banner visible with metro name | 🔲 |
| D4 | No active runs | No banner shown | 🔲 |
| D5 | Click "New Run" button | Navigates to `/runs/new` | 🔲 |
| D6 | Click "View all" on recent runs | Navigates to `/runs` | 🔲 |
| D7 | Click "Re-run" on a completed run | New pipeline_runs row created, webhook fired, toast shown | 🔲 |

## New Run Form Tests

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| N1 | Select country | State dropdown populates with correct states | 🔲 |
| N2 | Select country "Canada" | Label changes to "Province" | 🔲 |
| N3 | Select state | City dropdown populates with correct cities | 🔲 |
| N4 | Select city | Lat/lng/yelp_location auto-populate below | 🔲 |
| N5 | Change country after selecting city | State and city reset | 🔲 |
| N6 | Click radius preset buttons | Selected button highlighted, radius value updates | 🔲 |
| N7 | Select query template | Textarea populated with template queries | 🔲 |
| N8 | Edit queries textarea | Custom queries preserved | 🔲 |
| N9 | Submit without city selected | Button disabled, nothing happens | 🔲 |
| N10 | Submit with valid form | Row inserted in pipeline_runs, webhook POSTed, confirmation shown | 🔲 |
| N11 | Submit but webhook fails | Row still in pipeline_runs (queued), error toast shown | 🔲 |
| N12 | Click "Go to Dashboard" on confirmation | Navigates to `/` | 🔲 |
| N13 | Click "Start Another" on confirmation | Form resets | 🔲 |

## Run History Tests

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| H1 | Load with no runs | Empty state message | 🔲 |
| H2 | Load with runs | All runs shown, sorted by date DESC | 🔲 |
| H3 | Search by metro name | Table filters correctly | 🔲 |
| H4 | Filter by status "Completed" | Only completed runs shown | 🔲 |
| H5 | Filter by country "CA" | Only Canadian runs shown | 🔲 |
| H6 | Combine search + status filter | Both filters applied | 🔲 |
| H7 | Failed run shows error text | First error message visible in small text | 🔲 |
| H8 | Click re-run on failed run | New run created with same config | 🔲 |

## Coverage Report Tests

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| R1 | Load with no completed runs | Summary cards show 0, empty table | 🔲 |
| R2 | Load with completed runs | Summary cards show correct counts | 🔲 |
| R3 | Click country row | Expands to show state rows | 🔲 |
| R4 | Click country row again | Collapses state rows | 🔲 |
| R5 | Click state row | Expands to show city rows | 🔲 |
| R6 | Country totals match sum of state totals | Aggregation is correct | 🔲 |
| R7 | State totals match sum of city totals | Aggregation is correct | 🔲 |

## Integration Tests (after n8n webhook setup)

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| I1 | Trigger run from dashboard | n8n execution starts | 🔲 |
| I2 | Check pipeline_runs after trigger | status = 'running', n8n_execution_id populated | 🔲 |
| I3 | Wait for pipeline completion | status = 'completed', result counts populated | 🔲 |
| I4 | Refresh dashboard after completion | Stats updated, run appears in recent runs | 🔲 |
| I5 | Coverage report after completion | Metro appears with correct counts | 🔲 |
| I6 | Re-run a completed metro | New execution starts, new row in pipeline_runs | 🔲 |
| I7 | Pipeline fails mid-run | status = 'failed', errors array populated | 🔲 |

## Deployment Tests

| # | Test | Expected Result | Status |
|---|------|----------------|--------|
| P1 | Docker build succeeds | `docker build` exits 0 | 🔲 |
| P2 | Docker container serves app | App loads at localhost:80 | 🔲 |
| P3 | SPA routing works in Docker | Direct URL to `/runs` loads correctly (not 404) | 🔲 |
| P4 | Coolify deployment succeeds | App loads at production URL | 🔲 |
| P5 | SSL works | HTTPS with valid cert | 🔲 |
| P6 | Env vars passed correctly | App connects to real Supabase + n8n | 🔲 |
