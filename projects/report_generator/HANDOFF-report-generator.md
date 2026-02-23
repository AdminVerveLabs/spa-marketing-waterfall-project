# Report Generator — Feature Handoff Document

> **Sessions:** 58–64 | **ADRs:** 033, 034 | **Bugs:** 042, 043, 044 | **Status:** Fully Operational

---

## 1. Overview

The Report Generator is a standalone n8n workflow that produces styled Excel (.xlsx) lead reports after each pipeline run completes. It fetches enriched company + contact data from Supabase, tiers leads by contact quality, generates a multi-sheet workbook with ExcelJS, uploads to Supabase Storage, and optionally emails the file via Resend.

| Property | Value |
|---|---|
| Workflow ID | `SL9RrJBYnZjJ8LI6` |
| Webhook path | `report-generator-v1` (POST) |
| Node count | 7 |
| Status | Active, verified exec #278+ |
| Trigger | Auto (batch completion), dashboard button, direct webhook, backfill utility |

---

## 2. Architecture — 7-Node Workflow

```
Webhook (POST)
  → Respond to Webhook (200 OK)
    → Fetch Report Data (Code)
      → Generate Report (Code)
        → Upload to Storage (HTTP Request)
          → Complete Report (Code)
            → Send Email via Resend (Code)
```

### Node-by-Node

| # | Node Name | Type | What It Does |
|---|---|---|---|
| 1 | **Webhook** | webhook | Receives `{ run_id, metro }` via POST |
| 2 | **Respond to Webhook** | respondToWebhook | Returns 200 OK immediately (fire-and-forget) |
| 3 | **Fetch Report Data** | code | GETs pipeline_run row, PATCHes `report_status = 'generating'`, calls `get_lead_report` RPC |
| 4 | **Generate Report** | code | Builds full styled xlsx with ExcelJS, outputs n8n binary attachment |
| 5 | **Upload to Storage** | httpRequest | PUTs binary xlsx to Supabase Storage bucket `run-reports/{run_id}/{filename}.xlsx` |
| 6 | **Complete Report** | code | Constructs public `report_url`, PATCHes pipeline_runs with URL + status |
| 7 | **Send Email via Resend** | code | Sends email with xlsx attachment via Resend API, PATCHes `report_emailed_at` |

**Critical design note:** Upload to Storage is an HTTP Request node (not Code) because binary data from Code nodes corrupts via IPC in n8n's external Task Runner architecture (BUG-043). The Complete Report node reads metadata from `$('Generate Report').first().json` (not `$input`) because the HTTP Request node replaces JSON with its response.

---

## 3. Tiering Logic

Leads are assigned to tiers based on contact data quality. Tiers determine sheet placement and row coloring.

| Tier | Criteria | Sort Rank | Row Color (ARGB) |
|---|---|---|---|
| **1a — Name + Email + Phone** | has contact_name AND contact_email AND contact_phone | 0 (highest) | `FF92D050` (bright green) |
| **1b — Name + Channel** | has contact_name AND (contact_email OR contact_phone) | 1 | `FFC6EFCE` (light green) |
| **2a — Phone + Website** | has contact_phone AND has website | 2 | `FFFCE4D6` (light orange) |
| **2b — Co.Phone + Web + Rating** | has company_phone AND website AND google_rating | 3 | `FFF2F2F2` (gray) |
| **Other** | none of the above | 4 (lowest) | `FFFFFFFF` (white) |

**Sendable** = tiers 1a, 1b, 2a, 2b. "Other" is separated into its own tab.

Within tiers, leads are sorted by: (1) tier rank, (2) lead_score DESC, (3) google_reviews DESC.

### Pre-Tier Filtering

Before tiering, records pass through:
1. **Junk category filter** — removes Transportation Service, Car Repair, Corporate Office, Car Rental, Educational Institution, Association/Organization, Storage Facility, Shipping Service, Car Dealer
2. **Deduplication** — by `company_name.toLowerCase().trim()`, first occurrence wins
3. **Category simplification** — maps verbose Google categories to clean labels (e.g., "Day Spa and Massage Therapy" → "Massage Spa")
4. **Metro group normalization** — maps city/state to metro area names (e.g., Scottsdale, AZ → "Phoenix Metro, AZ")

---

## 4. Excel Sheet Structure

### Sheets (in order)

| # | Sheet Name | Tab Color | Contents |
|---|---|---|---|
| 1 | `Summary` | Blue | Report metadata, tier breakdown, metro breakdown, quick stats, tier guide |
| 2 | `All Leads` | Green | All sendable leads (tiers 1a+1b+2a+2b) |
| 3 | `Tier 1 - Priority` | Bright green | Tier 1a + 1b leads only |
| 4 | `Tier 2a - Direct Phone` | Orange | Tier 2a leads only |
| 5 | `Tier 2b - Cold Call` | Gray | Tier 2b leads only |
| 6 | `All Other Leads` | Light gray | "Other" tier — not yet sendable |
| 7+ | `{MetroShortName}` | Blue | One tab per metro group (e.g., "Tampa", "Phoenix") |

Sheets 3–6 and per-metro sheets are only created if they contain data.

### Columns (27 total)

| # | Key | Header | Width |
|---|---|---|---|
| 1 | tier | Tier | 26 |
| 2 | lead_score | Score | 7 |
| 3 | metro_group | Metro | 20 |
| 4 | company_name | Business Name | 32 |
| 5 | category_clean | Category | 14 |
| 6 | estimated_size | Est. Size | 10 |
| 7 | contact_name | Contact Name | 22 |
| 8 | contact_role | Role | 12 |
| 9 | owner | Owner? | 8 |
| 10 | contact_email | Contact Email | 30 |
| 11 | contact_phone | Contact Phone | 16 |
| 12 | company_phone | Business Phone | 16 |
| 13 | cultural_affinity | Cultural Affinity | 26 |
| 14 | linkedin_url | LinkedIn | 30 |
| 15 | website | Website | 26 |
| 16 | address | Address | 38 |
| 17 | city | City | 14 |
| 18 | state | State | 7 |
| 19 | google_rating | Rating | 7 |
| 20 | google_reviews | Reviews | 9 |
| 21 | booking_platform | Booking Platform | 16 |
| 22 | on_groupon | On Groupon? | 11 |
| 23 | instagram_url | Instagram | 30 |
| 24 | facebook_url | Facebook | 30 |
| 25 | tiktok_url | TikTok | 28 |
| 26 | social_platforms | Social Platforms | 25 |
| 27 | contact_source | Contact Source | 13 |

Columns are conditionally included — only if at least one record has that field populated. Booleans render as "Yes"/"No". Nulls become empty string.

### Styling

- **Header row:** Dark blue background (`FF2F5496`), white Arial bold 10pt, center-aligned, word wrap
- **Data rows:** Arial 10pt, background = tier color, thin bottom border
- **Freeze pane:** Row 1 frozen on all sheets
- **AutoFilter:** Applied to all columns (uses `colLetter()` helper for >26 columns — e.g., column 27 = "AA")
- **Special formatting:** Rating = `0.0`, Reviews = `#,##0` centered, Score + Owner = centered

### Summary Sheet Sections

1. Title: "VerveLabs - Sales Lead Report" (Arial bold 18pt, blue)
2. Subtitle with date and counts
3. Tier Breakdown table (1a / 1b / 2a / 2b / Total Sendable / Other)
4. Metro Breakdown table (Metro | Total | Tier 1a | Tier 1b | Tier 2a | Tier 2b)
5. Quick Stats (total qualified, with contact name, confirmed owners, with email/phone/website/booking/social, avg rating, avg reviews)
6. Tier Guide with color swatches and descriptions
7. "Understanding Tier vs. Score" explainer

### Filename Format

`VerveLabs_Sales_Leads_{metro_slug}_{YYYY-MM-DD}.xlsx`

Where `metro_slug = metro.replace(/, /g, '_').replace(/ /g, '_')` (e.g., `Tampa_FL`).

---

## 5. Trigger Paths

### Auto-Trigger (Track Batch Completion)

When the last batch of a pipeline run completes, `track-batch-completion.js` fires a non-blocking POST to the report generator webhook:

```javascript
const reportWebhookUrl = $env.REPORT_GENERATOR_WEBHOOK_URL;
if (reportWebhookUrl) {
  await this.helpers.httpRequest({
    method: 'POST',
    url: reportWebhookUrl,
    body: { run_id: runId, metro: metro },
    json: true,
    timeout: 10000
  });
}
```

Fully guarded — skips silently if env var unset, catches failures as non-fatal.

### Dashboard Button

The dashboard's RunHistoryTable has a download button per completed run. If `report_url` exists, it opens the stored file directly. If not, it falls back to the legacy client-side export (`dashboard/src/lib/export.ts`).

### Direct Webhook

```bash
curl -X POST https://n8n.../webhook/report-generator-v1 \
  -H "Content-Type: application/json" \
  -d '{"run_id": "uuid-here", "metro": "Tampa, FL"}'
```

### Backfill Utility

`scripts/nodes/report-backfill.js` — a one-time utility (workflow `Rm96MRnMbgic2ghf`) that queries all completed pipeline_runs missing a `report_url` and triggers report generation for each with 15-second delays. Safe to re-run (filters `report_url IS NULL`).

---

## 6. Supabase Schema

### pipeline_runs Columns (report-related)

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `report_url` | TEXT | — | Public Supabase Storage URL to the xlsx |
| `report_status` | TEXT | CHECK IN ('generating', 'completed', 'failed') | Report lifecycle state |
| `report_error` | TEXT | — | Error message if failed (truncated to 500 chars) |
| `report_emailed_at` | TIMESTAMPTZ | — | When email was successfully sent |

Schema migration: `scripts/supabase/report-schema.sql`

### get_lead_report RPC

`get_lead_report(p_metro TEXT)` is a SECURITY DEFINER PL/pgSQL function that joins:
- **companies** — lead_score, name, category, phone, domain, address, Google rating/reviews, booking info
- **contacts** (LATERAL, best 1 per company) — prioritized by: is_owner DESC, email DESC, phone DESC, created_at ASC
- **social_profiles** (LATERAL aggregate) — all platform URLs, follower counts, most recent post

Filtered by `discovery_metro = p_metro AND enrichment_status != 'needs_review'` and the junk category exclusion list. Ordered by `lead_score DESC, google_review_count DESC`.

### Storage Bucket

- Bucket: `run-reports` (public)
- Path: `run-reports/{run_id}/{filename}.xlsx`
- Public URL: `{SUPABASE_URL}/storage/v1/object/public/run-reports/{run_id}/{filename}`
- Upload uses `x-upsert: true` header (idempotent re-uploads)

---

## 7. Dashboard Integration

### RunHistoryTable.tsx

Full report lifecycle display:
- **Generating state:** When `report_status === 'generating'`, the download button is replaced by a disabled "Generating..." spinner with `<Loader2>` icon
- **Completed state:** Normal download button — clicks `window.open(run.report_url, '_blank')` if `report_url` exists
- **Fallback:** If no `report_url`, falls back to `downloadRunReport(metro_name)` (client-side export from `dashboard/src/lib/export.ts`)

### RecentRunsTable.tsx

Same download logic but no "Generating..." spinner state — only shows download button for completed runs.

### Legacy Fallback Export (dashboard/src/lib/export.ts)

`downloadRunReport(metroName)` — client-side only, uses the `xlsx` npm package. Queries companies + contacts from Supabase directly, produces a basic 2-sheet (Companies, Contacts) unstyled xlsx. No tiering logic. Used for runs that predate the report generator or when `report_url` is null.

---

## 8. Environment Variables

| Variable | Used In | Purpose |
|---|---|---|
| `SUPABASE_URL` | All 4 Code nodes, Upload node | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | All 4 Code nodes, Upload node | Supabase service role key |
| `REPORT_GENERATOR_WEBHOOK_URL` | track-batch-completion.js, report-backfill.js | Full webhook URL (e.g., `https://n8n.../webhook/report-generator-v1`) |
| `RESEND_API_KEY` | send-email.js | Resend API key for email delivery |

All set in Coolify environment variables.

---

## 9. Bugs & Fixes

### BUG-042: ExcelJS Blocked by Task Runner (Session 59)

**Problem:** n8n external Task Runner (`n8nio/runners:2.1.5`) has `/etc/n8n-task-runners.json` with `env-overrides` that only allow `moment`. ExcelJS `require()` fails with "Module 'exceljs' is disallowed".

**Root cause:** The config file overrides `NODE_FUNCTION_ALLOW_EXTERNAL` env vars set in Coolify. The runner resolves modules from `/opt/runners/task-runner-javascript/node_modules/`, not the n8n-data volume.

**Fix (ADR-034):** Docker Compose entrypoint for task-runners service:
```yaml
user: '0'  # root required to edit /etc/
entrypoint: /bin/sh
command:
  - -c
  - |
    sed -i 's/"moment"/"moment,exceljs"/' /etc/n8n-task-runners.json
    ln -sf /home/node/.n8n/node_modules/exceljs /opt/runners/task-runner-javascript/node_modules/exceljs
    exec tini -- /usr/local/bin/task-runner-launcher javascript python
volumes:
  - 'n8n-data:/home/node/.n8n'
```

Runs on every container restart — resilient to redeployments.

### BUG-043: xlsx File Corruption from IPC (Session 60)

**Problem:** Generated xlsx files wouldn't open in Excel. Binary data passed through `this.helpers.httpRequest()` in Code nodes gets corrupted during IPC transit between the task runner container and n8n main process.

**Root cause:** n8n external Task Runners serialize ALL data via IPC/JSON. Binary buffers lose fidelity.

**Fix:** Split the original single Code node into 3 nodes:
1. **Generate Report** (Code) — outputs xlsx as n8n binary attachment via `this.helpers.prepareBinaryData(buffer, filename, mimeType)`
2. **Upload to Storage** (HTTP Request) — handles binary upload natively, bypassing IPC
3. **Complete Report** (Code) — PATCHes pipeline_runs

**Principle:** Never upload binary from Code nodes. Use `prepareBinaryData()` to output, let HTTP Request nodes handle uploads.

### BUG-044: Empty Data Sheets in xlsx (Session 61)

**Problem:** All 6 data sheets had 0 rows. Summary tab worked fine.

**Root cause (dual):**
1. `String.fromCharCode(64 + 27)` = `[` not `AA` — invalid autoFilter for >26 columns
2. ExcelJS `ws.addRow(array)` produces empty `<sheetData/>` in the task runner environment

**Fix:**
1. Added `colLetter()` helper for correct multi-letter column references
2. Rewrote all data writing to use `ws.getCell(rowNum, colNum).value = ...` instead of `addRow()`

```javascript
function colLetter(n) {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}
```

---

## 10. Key Files

| File | Purpose |
|---|---|
| `scripts/nodes/report-generator/fetch-report-data.js` | Node 3: fetch pipeline_run + call get_lead_report RPC |
| `scripts/nodes/report-generator/generate-report.js` | Node 4: tiering, Excel generation with ExcelJS |
| `scripts/nodes/report-generator/complete-report.js` | Node 6: construct report_url, PATCH pipeline_runs |
| `scripts/nodes/report-generator/send-email.js` | Node 7: email via Resend API |
| `scripts/nodes/track-batch-completion.js` | Auto-trigger code (lines ~95–110) |
| `scripts/nodes/report-backfill.js` | Backfill utility for historical runs |
| `scripts/supabase/report-schema.sql` | SQL migration: columns + RPC + storage bucket |
| `dashboard/src/components/runs/RunHistoryTable.tsx` | Report download + generating spinner |
| `dashboard/src/components/dashboard/RecentRunsTable.tsx` | Report download (no spinner) |
| `dashboard/src/lib/export.ts` | Legacy fallback client-side export |
| `docs/decisions/DECISIONS.md` | ADR-033 (report generator), ADR-034 (task runner fix) |
| `tracking/BUGS.md` | BUG-042, BUG-043, BUG-044 details |

---

## 11. Known Issues & Gaps

| Issue | Status | Impact |
|---|---|---|
| **Resend email not working** | Domain `vervelabs.com` not verified (403) | Reports generate and upload fine; email delivery blocked |
| **RecentRunsTable missing "Generating..." spinner** | Not implemented | Only RunHistoryTable shows the generating state; RecentRunsTable shows download button immediately |
| **No retry on report failure** | By design | If report generation fails, `report_status = 'failed'` is set. Manual re-trigger via webhook required. |
| **Backfill workflow deleted** | Intentional | Was one-time utility. Re-create from `scripts/nodes/report-backfill.js` if needed (workflow ID was `Rm96MRnMbgic2ghf`). |

---

## 12. Quick Reference: How to Re-Generate a Report

```bash
# Direct webhook call
curl -X POST https://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/report-generator-v1 \
  -H "Content-Type: application/json" \
  -d '{"run_id": "<pipeline_run_uuid>", "metro": "Tampa, FL"}'
```

The report_url in pipeline_runs will be overwritten (upsert). Allow ~30–60 seconds for generation + upload.
