# Help Center — Handoff Document

**Feature:** In-app Help Center with pipeline documentation and FAQ
**Status:** Deployed, merged to `enrichment-enhancement-v1`
**Commit:** `d04a6da` — "Add Help Center page with pipeline documentation and FAQ"

---

## Feature Overview

The Help Center is a self-service documentation page built into the VerveLabs Run Manager dashboard. It provides operators with everything they need to run the pipeline without external docs — operational rules, step-by-step workflows, troubleshooting, report interpretation, and admin instructions.

It exists because the pipeline has non-obvious rules (e.g., never double-trigger, re-run behavior, tier vs. score distinction) that operators need to reference quickly.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `dashboard/src/pages/HelpCenterPage.tsx` | Full page component (370 lines) — sections, accordion, video |
| `dashboard/src/App.tsx` | Route: `<Route path="/help" element={<HelpCenterPage />} />` |
| `dashboard/src/components/layout/Sidebar.tsx` | Nav entry with `HelpCircle` icon from lucide-react |
| `dashboard/src/lib/supabase.ts` | Supabase client used for Storage bucket video check |

### Route & Navigation

- **Path:** `/help`
- **Sidebar position:** Below "Bug Reports", above nothing (last item)
- **Icon:** `HelpCircle` from lucide-react (size 18)
- Active state: teal highlight (`#3ecfad`)

---

## Content Structure — 12 Accordion Sections

| # | Title | What It Covers |
|---|-------|----------------|
| 1 | Welcome to VerveLabs Run Manager | Tool overview — what it does, who it's for |
| 2 | Important Rules | 5 critical operational rules (don't double-trigger, etc.) |
| 3 | How the Pipeline Works | 4-step flow: Discovery → Company Enrichment → Contact Finding → Contact Enrichment |
| 4 | Starting a Run | Full step-by-step workflow for initiating a pipeline run |
| 5 | How Long Does a Run Take? | Time estimates by metro size (small/medium/large) |
| 6 | Re-Runs | What happens on re-run — dedup behavior, new vs. existing companies |
| 7 | What To Do If a Run Fails | Error handling, troubleshooting steps, when to contact admin |
| 8 | The Report | Report structure, tier explanations, download behavior |
| 9 | Understanding Tiers vs. Scores | Scoring system breakdown, tier definitions and thresholds |
| 10 | Helpful Fields in the Report | Column-by-column field guide for the XLSX report |
| 11 | Bug Reports | How to use the Bug Reports page in the dashboard |
| 12 | Admin: Adding Users and Metros | Administrative tasks — user management, metro configuration |

Content is JSX (`React.ReactNode`), not strings — uses `<p>`, `<ul>`, `<ol>`, `<strong>`, `<code>` tags with Tailwind arbitrary selector styling.

---

## Video Feature

### How It Works

1. On mount, `useEffect` checks Supabase Storage bucket `help-assets` for `walkthrough.mp4`
2. If found → renders `<video>` element with native controls (max-width 800px)
3. If missing → renders styled placeholder: "Walkthrough video coming soon"

### Supabase Storage Bucket

The bucket does **not exist yet**. To create it, run this SQL in Supabase:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('help-assets', 'help-assets', false);

CREATE POLICY "Authenticated users can read help assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'help-assets');
```

Then upload `walkthrough.mp4` to the bucket. The component will detect it automatically on next page load.

### Constants

- Bucket name: `help-assets`
- File path: `walkthrough.mp4` (constant `HELP_VIDEO_PATH` at line 5)

---

## Implementation Details

### State Management

```tsx
const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));  // Welcome section open by default
const [videoUrl, setVideoUrl] = useState<string | null>(null);
const [videoChecked, setVideoChecked] = useState(false);
```

- `expanded` uses a `Set<number>` — multiple sections can be open simultaneously
- Section 0 ("Welcome") is expanded by default
- Video check runs once on mount, guarded by `videoChecked` flag

### Styling

- Dark theme consistent with dashboard: `#0d1219` background, teal `#3ecfad` accents
- Accordion panels: subtle borders (`rgba(255,255,255,0.06)`), hover effects
- Open sections: teal title + teal chevron; closed: gray title + slate chevron
- Nested content uses Tailwind arbitrary selectors for `ul`, `ol`, `strong`, `code`
- No external CSS files — all inline Tailwind classes

### Dependencies

- **None beyond existing dashboard stack** — React, lucide-react icons, Supabase client
- No new packages added

---

## Outstanding Items

| Item | Status | Notes |
|------|--------|-------|
| Supabase `help-assets` bucket | Not created | SQL above; needed before video works |
| Walkthrough video upload | Not done | Record and upload `walkthrough.mp4` to bucket |
| Resend email domain verification | Blocked | Unrelated to Help Center but referenced in report section |

---

## How to Modify

### Adding a New Section

In `HelpCenterPage.tsx`, add an object to the `helpSections` array (starts at line 12):

```tsx
{
  title: 'Your Section Title',
  content: (
    <>
      <p>Your content here.</p>
      <ul>
        <li>Use standard HTML tags</li>
        <li>Styling is handled by parent <code>className</code></li>
      </ul>
    </>
  ),
},
```

The accordion auto-renders all items in the array. No other files need changes.

### Editing Existing Content

Find the section by title in the `helpSections` array (lines 12–259). Edit the JSX content directly. Supported tags: `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<code>`.

### Changing the Video

Update the `HELP_VIDEO_PATH` constant (line 5) if using a different filename. Upload the new file to the `help-assets` Supabase Storage bucket.

### Styling Conventions

- Text: `text-slate-400` (body), `text-slate-300` (strong/emphasis)
- Accents: `#3ecfad` (teal) for interactive/active elements
- Backgrounds: `rgba(255,255,255, 0.02–0.06)` for subtle layering
- Code inline: `text-teal-400 bg-white/5 px-1.5 py-0.5 rounded text-xs`
