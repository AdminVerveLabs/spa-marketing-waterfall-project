# Apollo Sync Workflow v1

Automated Supabase-to-Apollo pipeline that syncs enriched spa/massage business data into Apollo.io for sales outreach.

## What It Does

1. **Setup Custom Fields** — Creates 13 account + 5 contact custom fields in Apollo (idempotent)
2. **Fetch Unsynced Data** — Queries Supabase for `fully_enriched` companies not yet synced (or re-enriched since last sync)
3. **Upsert Accounts** — Searches Apollo by domain, updates existing or creates new accounts with all enriched data
4. **Upsert Contacts** — Creates/updates contacts linked to their company account, with dedup enabled
5. **Mark Synced** — Updates `apollo_account_id`, `apollo_contact_id`, and `apollo_synced_at` in Supabase

## Prerequisites

### 1. Apollo API Key
- Apollo Professional plan or higher
- **Master API key** required (Settings > Integrations > API)
- Non-master keys cannot access write endpoints

### 2. Environment Variables (n8n)
| Variable | Description |
|----------|-------------|
| `APOLLO_API_KEY` | Apollo master API key |
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (bypasses RLS) |

### 3. SQL Migration
Run `migrations/001_apollo_tracking_columns.sql` in Supabase SQL Editor before first use. Adds:
- `companies.apollo_account_id` — Apollo account ID
- `companies.apollo_synced_at` — Last sync timestamp
- `contacts.apollo_contact_id` — Apollo contact ID
- `contacts.apollo_synced_at` — Last sync timestamp
- Index on `(enrichment_status, apollo_synced_at)` for sync queries

## Import Instructions

1. Open n8n Editor
2. Go to **Workflows** > **Add workflow** > **Import from File**
3. Select `workflow/apollo-sync-workflow.json`
4. The workflow imports **inactive** — do not activate until testing is complete
5. Execute manually first to verify custom fields and a small batch

## Workflow Architecture

```
Schedule Trigger (30 min) → Set Config → Setup Custom Fields → Fetch Unsynced → IF Has Data
  ↓ (true)
Split In Batches (25) → Upsert Account → Wait (2s) → Upsert Contacts → Mark Synced → [loop back]
  ↓ (done)
Log Summary
```

**11 nodes total.** Schedule trigger runs every 30 minutes. Safe to re-run — only processes unsynced or re-enriched records.

## Testing Checklist

1. Run the SQL migration against Supabase
2. Set environment variables in n8n (`APOLLO_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`)
3. Run workflow manually with a small test batch (edit Fetch Unsynced to add `&limit=5` to the URL)
4. Verify custom fields created in Apollo (Settings > Objects, fields, stages > Account/Contact fields)
5. Verify accounts appear in Apollo (Companies tab, search by name)
6. Verify contacts appear linked to correct accounts (People tab, filter by VerveLabs Run Tag)
7. Check custom field values populated correctly on a sample account and contact
8. Verify Supabase tracking columns updated (`apollo_account_id`, `apollo_synced_at`)
9. Re-run workflow — confirm no duplicates created (idempotency check)
10. Enable schedule trigger and monitor first automated run

## List & Tagging Strategy

Every account and contact gets a `VerveLabs Run Tag` custom field value like `vervelabs-2026-02-25-0800`.

**To create per-run lists in Apollo:**
1. Go to People or Companies in Apollo
2. Filter by `VerveLabs Run Tag` = your run tag value
3. Select all results > Add to list > Create new list

For metro-specific lists, add the metro name to the run tag in the Set Config node.

## Rate Limiting

- 700ms delay between individual API calls within code nodes
- 2-second Wait node between account upsert and contact upsert phases
- Batches of 25 companies per iteration
- Typical run of 200 companies + 250 contacts: ~650-700 API calls, ~8-10 minutes

## Error Handling

| Error | Action |
|-------|--------|
| HTTP 429 (Rate Limited) | Increase delay from 700ms to 1200ms or reduce batch size to 15 |
| HTTP 403 (Forbidden) | Verify you're using a **master** API key |
| Duplicate contacts | Handled by `run_dedupe=true` on create |
| Partial failures | Each company processes independently — one failure doesn't stop others |
| Re-runs | Safe — only picks up unsynced or re-enriched records |

## Cost Impact

Apollo sync uses only write/update operations — **no enrichment credits consumed**. Creating contacts and accounts via API is free of credit charges.

## File Inventory

| File | Purpose |
|------|---------|
| `workflow/apollo-sync-workflow.json` | Complete n8n workflow (11 nodes) |
| `migrations/001_apollo_tracking_columns.sql` | Supabase schema migration |
| `utils/get-field-mapping.js` | Diagnostic: maps Apollo custom field labels to keys |
| `apollo-sync-workflow-spec.md` | Full implementation specification |
| `README.md` | This file |
