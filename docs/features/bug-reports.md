# Bug Reports Feature

Submit and track dashboard bugs via a Supabase-backed UI. Added in Session 60 on the `metro-tablev0` branch.

## Files

| File | Role |
|---|---|
| `dashboard/src/pages/BugReportsPage.tsx` | Page component — fetches all bugs on mount, handles inline status updates |
| `dashboard/src/components/bugs/BugReportForm.tsx` | Submission form with page/severity/description fields |
| `dashboard/src/components/bugs/BugReportTable.tsx` | Expandable table with severity badges, status dropdown, detail panel |
| `dashboard/src/types/index.ts` (lines 76-90) | `BugReport` TypeScript interface |
| `dashboard/src/App.tsx` (line 40) | Route: `/bugs` |
| `dashboard/src/components/layout/Sidebar.tsx` (line 14) | Nav item using `Bug` icon from lucide-react |

## Database

Table: `bug_reports`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `page` | text | Required — which dashboard page |
| `severity` | text | Required — `broken`, `annoying`, or `cosmetic` |
| `what_happened` | text | Required — bug description |
| `expected_behavior` | text | Nullable |
| `steps_to_reproduce` | text | Nullable |
| `browser_info` | text | Nullable — auto-captured `navigator.userAgent` |
| `current_url` | text | Nullable — auto-captured `window.location.href` |
| `console_errors` | text | Nullable — not captured by form, display-only |
| `submitted_by` | text | Nullable — auto-captured from auth `user.email` |
| `status` | text | Default `open` |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto |

## UI Behavior

**Form** (`BugReportForm`):
- Required fields: page (dropdown), severity (dropdown), what happened (textarea)
- Optional fields: expected behavior, steps to reproduce
- Auto-captures on submit: browser UA, current URL, logged-in user email
- Inserts to `bug_reports` via Supabase JS client, prepends new row to table on success
- Resets all fields after successful submit

**Table** (`BugReportTable`):
- Columns: severity badge, page, description (truncated), status dropdown, date+time
- Click row to expand — shows full detail panel (what happened, expected behavior, steps to reproduce, submitted by, browser, URL, console errors)
- Status dropdown updates in-place via Supabase `update()` — click is isolated with `stopPropagation` so it doesn't toggle expansion
- Status colors: open = red, fixed = green, others = gray
- Empty state: "No bug reports yet"

## Enums / Constants

**Pages** (form dropdown): `Dashboard`, `New Run`, `History`, `Coverage`, `Other`

**Severities** (form dropdown + badge colors):
| Value | Badge |
|---|---|
| `broken` | Red background, red text |
| `annoying` | Amber background, amber text |
| `cosmetic` | Gray background, gray text |

**Statuses** (table dropdown): `open`, `investigating`, `fixed`, `wont_fix`

## Not Yet Built

- Screenshot upload
- Filtering / search
- Assignment to a person
- Linking to `tracking/BUGS.md` entries
- Console error auto-capture (column exists but form doesn't populate it)
