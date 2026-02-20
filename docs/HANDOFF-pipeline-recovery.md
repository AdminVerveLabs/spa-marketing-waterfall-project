# HANDOFF: Pipeline Recovery — Fix Zero Digital Signals

**Created:** 2026-02-20, Session 41
**Status:** Investigation complete, fixes NOT yet applied
**Goal:** After applying fixes, re-run Sedona and get non-zero digital signals (booking platforms, ratings, emails, paid ads, on_yelp)

---

## What Happened

The pipeline went through major refactors over Sessions 29-38:
- **Session 34:** Simplified from 127 → 27 nodes (ADR-027). Collapsed ~40 enrichment nodes into a single `enrich-companies.js` Code node.
- **Session 36:** Parallelized into main workflow (22 nodes) + sub-workflow (6 nodes) (ADR-029).
- **Session 38:** Sedona AZ first clean end-to-end run (exec #170). Pipeline reported SUCCESS.
- **Session 41:** Diagnostic SQL revealed ALL digital signals are zero for Sedona.

Pre-simplification runs (San Diego #140, Phoenix #139) showed 33-47 booking platforms, 9-11 paid ads, 7-12 verified emails per metro. Post-simplification Sedona shows **zero across the board**.

## Root Cause Analysis

### Confirmed Issue 1: Insert to Supabase drops 12 fields

The "Prepare for Supabase" Code node computes 26 fields. The "Insert to Supabase" HTTP Request node body template only sends 14. **The 12 dropped fields:**

| Field | Prepared | Sent | Status |
|---|---|---|---|
| `google_rating` | ✅ from Google API | ❌ dropped | **Never reaches DB at discovery** |
| `google_review_count` | ✅ from Google API | ❌ dropped | **Never reaches DB at discovery** |
| `on_yelp` | ✅ computed from source_urls | ❌ dropped | **NEVER written by any node** |
| `on_groupon` | ✅ (hardcoded false) | ❌ dropped | **NEVER written by any node** |
| `has_online_booking` | ✅ (default false) | ❌ dropped | Should be backfilled by enrichment |
| `booking_platform` | ✅ (default null) | ❌ dropped | Should be backfilled by enrichment |
| `has_paid_ads` | ✅ (default false) | ❌ dropped | Should be backfilled by enrichment |
| `estimated_size` | ✅ (default null) | ❌ dropped | Should be backfilled by enrichment |
| `lead_score` | ✅ (default 0) | ❌ dropped | Set by Calculate Lead Scores |
| `enriched_at` | ✅ (default null) | ❌ dropped | Set by Enrich Companies PATCH |
| `_fuzzy_match_flag` | ✅ internal | ❌ dropped | Internal only, OK to drop |
| `email` | not computed at discovery | not sent | Set by Enrich Companies PATCH |

**The "Insert Flagged" HTTP Request node has the same 14-field body template.**

### Confirmed Issue 2: `on_yelp` and `on_groupon` are NEVER written

- Prepare for Supabase: computes `on_yelp` ✅
- Insert to Supabase: drops it ❌
- Enrich Companies (`enrich-companies.js`): does NOT write `on_yelp` or `on_groupon` ❌
- **Result: these fields are always false/null in the DB, no matter what**

### Confirmed Issue 3: 50 stuck companies (25%)

38 `discovered` + 12 `partially_enriched` out of 201 total. These were likely discovered in exec #167 (pre-BUG-035 fix) but never enriched. The Batch Dispatcher in exec #170 should have picked them up but may have missed some.

### Unknown Issue 4: Are enrichment PATCHes writing signals?

149 companies are `fully_enriched`, yet show zero for `booking_platform`, `google_rating`, `email`, `has_paid_ads`. The `enrich-companies.js` code IS comprehensive — it calls Google Details, scrapes websites, detects booking platforms, extracts emails. But we don't know if:
- (a) Sedona businesses genuinely have no detectable signals (possible — small town)
- (b) The enrichment code ran but PATCHes silently failed
- (c) Google Details API or website scraping didn't return data

**This needs investigation via n8n execution inspection.**

---

## Diagnostic Data (Sedona, AZ — 2026-02-20)

```json
{
  "company_funnel": {
    "total": 201, "fully_enriched": 149, "discovered": 38, "partially_enriched": 12,
    "has_domain": 60, "has_website": 173, "has_phone": 198,
    "has_email": 0, "has_rating": 0, "has_booking": 0, "has_paid_ads": 0,
    "on_groupon": 0, "on_yelp": 0
  },
  "contact_funnel": {
    "total": 13, "has_email": 0, "has_phone": 13, "has_linkedin": 0,
    "is_owner": 13
  },
  "contacts_by_source": [
    {"source": "solo_detection", "count": 13, "has_name": 9, "has_email": 0, "has_phone": 13}
  ],
  "quality_flags": {
    "blocked_domains": 0, "email_mismatches": 0, "dead_leads": 3,
    "no_name_contacts": 0, "stuck_companies": 50
  }
}
```

Key observations:
- **Zero Apollo contacts** — all 13 from solo_detection. Consistent with ADR-019 (Apollo has ~0% for local massage).
- **93.5% of companies have 0 contacts** (188/201)
- **185 unverified phones** — Telnyx only runs in Enrich Contacts (contacts-only path)
- **Scores clustered at 15** (86%) — only differentiator is has_website (±10 pts)

---

## Investigation Phase (Do This First)

### Step 1: Inspect sub-workflow execution data

```
Use MCP: n8n_executions action=get id=<exec_id> mode=summary
```

Check one of the Sedona sub-workflow executions (IDs #171-#178, skipping #176). Look at:
- **Enrich Companies node output:** Did Google Details return ratings? Did website scrape find booking platforms? Did it extract any emails? What was in the PATCH payload?
- **Find Contacts node output:** Did Apollo return results? How many solo detections?
- **Enrich Contacts node output:** Were any emails/phones verified?
- **Mark Fully Enriched node output:** How many company IDs were PATCHed?

### Step 2: Run diagnostic SQL for San Diego

Change `'Sedona, AZ'` to `'San Diego, CA'` in `scripts/diagnostic.sql` and run. San Diego exec #140 (pre-simplification) showed 47 booking platforms and 11 paid ads. If San Diego ALSO shows zero signals now, that means:
- The old pipeline wrote these fields during enrichment
- The simplified enrichment code doesn't write them (or they were overwritten)

If San Diego shows non-zero signals, the old enrichment DID work and only the new sub-workflow path is broken.

### Step 3: Check the Enrich Companies PATCH payload in code

Read `scripts/nodes/enrich-companies.js` lines ~470-500 (the Supabase PATCH call). Verify the PATCH object explicitly includes:
- `has_online_booking`, `booking_platform`, `has_paid_ads`, `estimated_size`
- `google_rating`, `google_review_count` (from Google Details backfill)
- `email` (from website scrape)

Check if any of these are inside conditional blocks that might not execute (e.g., only backfill if the field was previously null).

---

## Fix Plan (Execute After Investigation)

### Fix 1: Update Insert to Supabase node body

Via MCP `n8n_update_partial_workflow` on workflow `yxvQst30sWlNIeZq`:

Add these fields to the "Insert to Supabase" HTTP Request node jsonBody:
```javascript
google_rating: {{ $json.google_rating }},
google_review_count: {{ $json.google_review_count }},
on_yelp: {{ $json.on_yelp }},
on_groupon: {{ $json.on_groupon }},
has_online_booking: {{ $json.has_online_booking }},
booking_platform: {{ $json.booking_platform }},
has_paid_ads: {{ $json.has_paid_ads }},
estimated_size: {{ $json.estimated_size }}
```

Apply the same fix to "Insert Flagged" node.

### Fix 2: Add on_yelp/on_groupon to Enrich Companies PATCH (if needed)

If Step 1 investigation shows the enrichment PATCH doesn't include `on_yelp`/`on_groupon`, add them to `enrich-companies.js`. The code should preserve the value from Insert rather than overwrite with false.

### Fix 3: Fix enrichment code paths (if Step 1 reveals issues)

If the sub-workflow execution inspection shows Google Details isn't returning data or the PATCH payload is missing fields, fix the specific code path. Common issues:
- Google Details API key not set or rate limited
- `skip_google_details` config accidentally set to `"true"`
- Conditional backfill logic skipping fields that are already set to defaults

### Fix 4: Re-run Sedona clean

```sql
-- Clean Sedona data
DELETE FROM contacts WHERE company_id IN (SELECT id FROM companies WHERE discovery_metro = 'Sedona, AZ');
DELETE FROM social_profiles WHERE company_id IN (SELECT id FROM companies WHERE discovery_metro = 'Sedona, AZ');
DELETE FROM companies WHERE discovery_metro = 'Sedona, AZ';
```

Then re-trigger: `GET /webhook/001b878c-b5af-4c3c-8b78-d41e526049f4?metro_name=Sedona,%20AZ`

### Fix 5: Run diagnostic SQL and compare

Expected after fix:
- `on_yelp` > 0 (Yelp-sourced companies should be flagged)
- `google_rating` > 0 for most companies (Google returns ratings)
- `has_online_booking` > 0 (Sedona is a spa town — many use booking)
- `has_email` > 0 (website scraper should find info@, contact@)
- `stuck_companies` = 0 (all should reach fully_enriched)
- Score distribution shows meaningful spread (not all 15)

---

## Key Files

| File | Purpose |
|---|---|
| `scripts/nodes/enrich-companies.js` | ~540 lines. Google Details, website scrape, booking detection, email extraction, social profiles, size estimation. PATCHes companies in Supabase. |
| `scripts/nodes/find-contacts.js` | ~615 lines. Apollo search, solo detection, about page scraping. INSERTs contacts. |
| `scripts/nodes/enrich-contacts.js` | Email/phone verification (Hunter, NamSor, Telnyx). PATCHes contacts. |
| `scripts/nodes/prepare-for-supabase.js` | Maps discovery data to 26-field Supabase insert payload. |
| `scripts/nodes/batch-dispatcher.js` | ~151 lines. Polls for discovery, fetches company IDs, dispatches batches of 25 to sub-workflow. |
| `scripts/nodes/mark-fully-enriched.js` | ~42 lines. PATCHes companies to fully_enriched. |
| `scripts/diagnostic.sql` | Single-JSON health check. Find-and-replace metro name to reuse. |
| `workflows/current/deployed-fixed.json` | Snapshot of deployed main workflow (22 nodes). |
| `workflows/current/sub-workflow-deployed.json` | Snapshot of deployed sub-workflow (6 nodes). |

## Workflow IDs
- Main: `yxvQst30sWlNIeZq` (22 nodes, webhook GET `001b878c-b5af-4c3c-8b78-d41e526049f4`)
- Sub: `fGm4IP0rWxgHptN8` (6 nodes, webhook POST `batch-enrichment-v1`)

## Why Not Rebuild

1. **The enrichment code IS comprehensive** — `enrich-companies.js` does Google Details, website scraping, booking detection (15+ platforms), email extraction (regex + mailto + domain scoring), paid ads detection (5 ad networks), social profile extraction, and size estimation. This is ~540 lines of working code.
2. **The parallelized architecture solves the real problems** — n8n batching bug (convergence), worker crashes, timeouts. A rebuild would face these same issues.
3. **The root cause is 2 HTTP Request node body templates** missing 8 fields each. That's a 10-minute MCP fix.
4. **The unknown (Issue 4) may be Sedona-specific** — small town businesses with simple websites. Running the diagnostic on San Diego will confirm.

---

## Success Criteria

After all fixes, re-run Sedona diagnostic should show:
- [ ] `has_email` > 0
- [ ] `google_rating` non-null for most companies (`has_rating` > 50%)
- [ ] `on_yelp` > 0
- [ ] `has_booking` > 0
- [ ] `stuck_companies` = 0
- [ ] `score_distribution` shows meaningful spread
- [ ] `contacts_by_source` includes `apollo` (even if small)
