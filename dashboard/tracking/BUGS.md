# Known Bugs

## Open

_None currently._

## Fixed (Session 2)

### BUG-D003: Re-run button does not pre-fill form
- **Found:** 2026-02-19 (Session 2)
- **Location:** `NewRunPage.tsx` — navigates to `/runs/new?rerun={id}` but never reads the param
- **Fix:** Added `useSearchParams()` to read `rerun`, fetch run from Supabase, pass as `initialData` to `NewRunForm`. Form pre-fills all fields on mount.

### BUG-D004: Nested `<tbody>` in CoverageTable produces invalid HTML
- **Found:** 2026-02-19 (Session 2)
- **Location:** `CoverageTable.tsx` — inner `<tbody key={...}>` wrappers inside outer `<tbody>`
- **Fix:** Replaced inner `<tbody>` with `React.Fragment`. Single `<tbody>` wraps all `<tr>` rows.

### BUG-D005: Sidebar highlights both "New Run" and "Run History" on /runs/new
- **Found:** 2026-02-19 (Session 2)
- **Location:** `Sidebar.tsx` — `startsWith(item.path)` matches `/runs` for both items
- **Fix:** Changed to exact `===` match: `location.pathname === item.path`

### BUG-D006: Supabase fetch errors cause infinite "Loading..." state
- **Found:** 2026-02-19 (Session 2)
- **Location:** `DashboardPage`, `HistoryPage`, `ReportsPage`, `NewRunPage`
- **Fix:** Destructure `error` from Supabase response, show toast on error, set loading=false regardless.

## Fixed (Session 1)

### BUG-D001: Hardcoded date in timeAgo function
- **Found:** 2026-02-19 (Session 1)
- **Location:** Prototype line 177: `new Date("2026-02-18T15:00:00Z")`
- **Fix:** Changed to `new Date()` in `src/lib/utils.ts`

### BUG-D002: Hardcoded month in "Runs This Month" stat
- **Found:** 2026-02-19 (Session 1)
- **Location:** Prototype line 381: `getMonth() === 1`
- **Fix:** Dynamic comparison using `d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()` in `src/pages/DashboardPage.tsx`
