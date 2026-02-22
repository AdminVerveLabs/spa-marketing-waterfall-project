# New Run Page Redesign — Metro Table Selector + Map Preview

## Overview

Replace the cascading dropdown selectors (Country → State → City) on the New Pipeline Run page with a searchable, sortable table of all metros that shows run history inline, paired with an interactive map preview that visualizes the selected metro's location and search radius. This lets users immediately see which metros need attention and spatially verify the search area before launching a run.

**Reference prototype:** `new-run-metro-table.jsx` in the project files — this is a working React prototype built in Claude Chat. Use it as the visual/behavioral reference, but DO NOT copy-paste it. Implement using whatever component patterns and styling approach the dashboard already uses.

---

## Before You Start

### Investigate first:

1. **Current New Run page implementation:**
   - Find the current New Run page component (likely in `dashboard/src/pages/` or `dashboard/src/components/runs/`)
   - Understand how it currently handles metro selection (cascading dropdowns)
   - Identify where the static metro data lives (`src/data/metros.ts` or similar)
   - Understand the current form submission flow — what happens when "Start Pipeline" is clicked? What data gets sent where?

2. **Metro data structure:**
   - Check the shape of the static metros data file
   - Identify what fields exist per city (lat, lng, metro_name, yelp_location, etc.)
   - This table needs to JOIN static metro data with dynamic run history from Supabase

3. **Existing Supabase queries:**
   - Find how the dashboard currently queries `pipeline_runs`
   - Check if there's already a query that fetches the most recent run per metro, or if you'll need to write one
   - Check how auth/client is set up (there should be a shared Supabase client in `src/lib/`)

4. **Styling approach:**
   - Is the dashboard using plain Tailwind classes? Inline styles? CSS modules? A component library?
   - Are there existing shared components (StatusBadge, etc.) that should be reused?
   - Check if there's already a custom scrollbar style defined anywhere

5. **Form submission:**
   - What does the current submit handler do? (Insert to Supabase → POST webhook → confirmation screen?)
   - What fields does it send? Verify against what the metro table selection would provide
   - Does the confirmation screen exist already?

**Document your findings before making changes.** List any discrepancies between what you find and what this spec describes.

---

## What to Build

Step 1 (Location) contains two side-by-side panels: the metro table on the left and a map preview on the right. Search and filter controls sit above both at full width.

```
Search bar + filter buttons (full width)
┌──────────────────────────┬─────────────────┐
│  Metro Table (flex-[3])  │  Map  (flex-[2]) │
│  + "N metros shown" text │                  │
└──────────────────────────┴─────────────────┘
```

On narrow screens (`< lg`), the layout stacks vertically (map below table).

### The Metro Table (replaces Step 1: Location)

A table showing ALL metros from the static data file, enriched with the most recent run data from `pipeline_runs`.

**Data source:** Merge static metro data with a Supabase query on page load:

```sql
-- Get the most recent completed or failed run per metro
SELECT DISTINCT ON (city, state, country)
  city, state, country, metro_name,
  status, total_discovered, contacts_found, completed_at
FROM pipeline_runs
WHERE status IN ('completed', 'failed')
ORDER BY city, state, country, completed_at DESC;
```

**Investigate:** Whether this query shape works with your Supabase client setup. It may need to be adjusted depending on how the client handles `DISTINCT ON` or whether you need to use an RPC function instead.

For each metro in the static data, look up its most recent run from the query results. If no match, it's "Never Run."

**Table columns:**

| Column | Source | Sortable | Notes |
|--------|--------|----------|-------|
| Metro | Static data (city name) | Yes | Also show country code as a small badge (US/CA) |
| State | Static data | Yes | State/province code |
| Status | Supabase (last run status) | No | Colored badge: Completed (green), Failed (red), or "—" for never run |
| Found | Supabase (total_discovered) | No | Number or "—" |
| Contacts | Supabase (contacts_found) | No | Number or "—" |
| Last Run | Supabase (completed_at) | Yes | Relative time ("3d ago") or "Never" in teal |

**Interactions:**
- Click a row to select it → row highlights with teal left border
- Only one row selected at a time
- Selection populates the rest of the form (radius, queries) and enables Steps 2 and 3
- Clicking a selected row deselects it

**Filters (above the table):**

1. **Search input** — filters by city name or state code, case-insensitive
2. **Status filter toggles** — All / Never Run / Completed / Failed. Show counts in parentheses. These counts should reflect the FULL metro list, not the currently filtered view.
3. **Country filter toggles** — All / US / CA

**Investigate:** Whether the dashboard has existing filter/toggle components that can be reused here.

**Sorting:**
- Default sort: Last Run descending (most recent first), with "Never Run" metros at top
- Click column header to sort. Click again to reverse. Show sort direction indicator.

**Scrollable area:**
- Table body scrolls vertically (max height ~340px), header stays sticky
- Custom scrollbar: thin (6px), teal thumb (`rgba(62,207,173,0.25)`), near-transparent track (`rgba(255,255,255,0.02)`)
- **Investigate:** Whether the dashboard already has global scrollbar styles. If so, extend them rather than adding new ones.

**Footer text below table:** "{N} metros shown · Click a row to select"

### Map Preview (right panel)

**Component:** `MapPreview` at `dashboard/src/components/runs/MapPreview.tsx`

A read-only Leaflet map that shows the selected metro's location with a teal circle representing the search radius. It sits to the right of the metro table in a `flex-[2]` column (table is `flex-[3]`).

**Dependencies:**
- `leaflet` ^1.9.4
- `react-leaflet` ^4.2.1
- `@types/leaflet` ^1.9.21 (dev)
- `@import 'leaflet/dist/leaflet.css'` added to `dashboard/src/index.css`

**Tile provider:** CARTO dark basemap (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`) — matches the dashboard's dark theme.

**Behavior:**
- **No selection:** Zoomed-out US overview (center `[39.8, -98.6]`, zoom 4) at 50% opacity, with a centered overlay label: "Select a metro to preview location"
- **Metro selected:** `flyTo` animates to the metro coordinates (0.8s), then after 850ms `fitBounds` zooms to fit the radius circle with 30% padding
- **Radius changed (Step 2):** Circle updates to new radius; map re-fits to new bounds
- **Metro deselected:** Returns to US overview
- **All user interaction disabled:** `dragging`, `zoomControl`, `scrollWheelZoom`, `doubleClickZoom`, `touchZoom`, `keyboard`, `boxZoom` all set to `false`

**Radius circle styling:**
- Stroke: `#3ecfad`, 2px weight
- Fill: `#3ecfad`, 12% opacity

**Container styling:**
- 400px fixed height
- Rounded corners (`rounded-xl`), `overflow: hidden`
- 1px border matching table: `rgba(255,255,255,0.06)`
- Opacity transitions from 0.5 → 1.0 when a metro is selected

**Dark theme attribution (in `index.css`):**
- Background: `rgba(0,0,0,0.5)`
- Text: `rgba(255,255,255,0.3)`, 9px font
- Links: `rgba(255,255,255,0.4)`

### Selected Metro Badge

When a metro is selected, show a teal badge in the Step 1 header:
```
① Select Metro                                    Austin, TX ✓
```

This gives visual confirmation without the user needing to look at the table.

### Steps 2 and 3 (Search Radius + Search Queries)

These remain UNCHANGED functionally. The only change:
- Steps 2 and 3 should appear visually dimmed/disabled (`opacity: 0.4`, `pointer-events: none`) until a metro is selected
- Once a metro is selected, they become interactive

**Investigate:** Whether the current implementation already has this dimming behavior. If not, add it.

### Submit Section

The submit bar at the bottom should show:
- Left side: "Ready to discover businesses in **{City}, {State}**" + "· Last run {time ago}" if the selected metro has been run before
- Right side: "Start Pipeline" button — disabled until a metro is selected

**Investigate:** What the current submit handler does. The data it sends should be the same — the only difference is that the city/state/country/lat/lng now comes from the selected table row instead of cascading dropdowns.

### Confirmation Screen

After submission, show a confirmation screen with:
- Check icon
- "Run Queued" heading
- Metro name
- "The pipeline will start automatically. Check back in ~15–30 minutes."
- "Start Another" button (resets the form)

**Investigate:** Whether this confirmation screen already exists. If so, keep it. If not, add it.

---

## What to Remove

- The cascading Country → State → City dropdown components
- Any helper logic specific to the cascading dropdown behavior (e.g., "filter states by country, filter cities by state")
- **DO NOT remove** the static metro data file — the table reads from it

**Investigate:** Whether the dropdown components are used anywhere else in the app (e.g., the queue edit modal). If they are, keep the components and only remove them from the New Run page.

---

## What NOT to Change

- Steps 2 and 3 functionality (radius selection, query templates, editable textarea)
- Form submission logic (insert to Supabase → POST webhook)
- The data shape sent to the webhook
- Any other pages (Dashboard, History, Coverage, Queue)
- The static metro data file structure

---

## Implementation Order

### Stage 1: Data layer
- Write the Supabase query to fetch most recent run per metro
- Write a merge function that combines static metros + run data
- Test: log the merged data to console. Verify metros with runs show status/counts, metros without show nulls.

### Stage 2: Table component + Map preview
- Build the metro table with columns, row click selection, sticky header, custom scrollbar
- Build the `MapPreview` component using `react-leaflet` (CARTO dark tiles, disabled interactions)
- Wire up the merged data from Stage 1
- Lay out table and map side-by-side (`flex-[3]` / `flex-[2]`), search/filters above both
- Test: table renders all metros, clicking a row selects it, scrolling works with custom scrollbar, map animates to selected metro with radius circle

### Stage 3: Filters + sorting
- Add search input, status toggles, country toggles
- Add column header sorting
- Test: each filter narrows results correctly, filters combine (search + status + country), sorting works on all sortable columns, "Never Run" filter shows correct metros

### Stage 4: Wire to existing form
- Remove cascading dropdowns from the page
- Connect table selection to Steps 2/3 enable/disable
- Connect selected metro data to the submit handler (verify lat/lng/metro_name/yelp_location all flow through)
- Test: select a metro → configure radius + queries → click Start Pipeline → verify the correct data is sent (check Supabase insert and webhook POST payload)

### Stage 5: Polish
- Add selected metro badge in Step 1 header
- Add "Last run X ago" text in submit bar
- Add confirmation screen (if not already present)
- Verify dimming behavior on Steps 2/3 when no metro selected
- Test: full flow end-to-end, visuals match the prototype reference

---

## Testing Checklist

After each stage, verify:

- [ ] Page loads without errors (check console)
- [ ] All metros from static data appear in the table
- [ ] Metros with past runs show correct status, found count, contacts count, and relative time
- [ ] Metros without past runs show "—" for stats and "Never" for last run
- [ ] Search filters by city and state
- [ ] Status filters show correct counts and filter correctly
- [ ] Country filter works
- [ ] Combining filters works (e.g., "Never Run" + "CA" shows only unrun Canadian metros)
- [ ] Sorting by Metro, State, and Last Run works in both directions
- [ ] Clicking a row selects it (teal highlight + left border)
- [ ] Clicking again or clicking another row updates selection
- [ ] Steps 2/3 are dimmed until selection is made
- [ ] Submit button is disabled until selection is made
- [ ] Submitting sends correct data (same fields as before, sourced from table row)
- [ ] Confirmation screen appears after submission
- [ ] "Start Another" resets the form and deselects the metro
- [ ] Custom scrollbar appears when table has enough rows to scroll
- [ ] Map renders at 50% opacity with "Select a metro to preview location" when no metro selected
- [ ] Selecting a metro animates the map to the correct location with a teal radius circle
- [ ] Teal circle size matches the selected search radius
- [ ] Changing radius (Step 2) updates the circle and map zoom
- [ ] Deselecting a metro returns the map to the zoomed-out US overview
- [ ] Map is non-interactive (no drag, zoom, scroll, or keyboard)
- [ ] Map top edge aligns with the table header (search/filters are above both)
- [ ] On mobile/narrow screens, map stacks below the table
- [ ] No regressions on other pages

---

## Key Files

| File | Purpose |
|------|---------|
| `dashboard/src/components/runs/NewRunForm.tsx` | Main form component — table, map, filters, form submission |
| `dashboard/src/components/runs/MapPreview.tsx` | Leaflet map preview component |
| `dashboard/src/data/metros.ts` | Static metro data (city, state, country, lat, lng, metro_name, yelp_location) |
| `dashboard/src/types/index.ts` | `MetroTableRow` type definition |
| `dashboard/src/index.css` | Custom scrollbar styles + Leaflet dark theme overrides |

## Reference

The interactive prototype (`new-run-metro-table.jsx`) demonstrates:
- Exact column layout and data display
- Filter toggle design and behavior
- Sort interaction pattern
- Row selection visual treatment
- Dimming behavior on Steps 2/3
- Confirmation screen design
- Custom scrollbar styling

Use it as a visual guide. Implement using the dashboard's existing patterns and components.
