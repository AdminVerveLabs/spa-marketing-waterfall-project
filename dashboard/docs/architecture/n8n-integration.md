# n8n Integration — Webhook Trigger + Callbacks

## Overview

The dashboard triggers n8n workflows via webhook and n8n reports results back by directly updating Supabase. The dashboard itself never polls for status — users refresh manually.

```
Dashboard → POST webhook → n8n starts
                           n8n PATCHes pipeline_runs.status → 'running'
                           n8n runs Steps 1-5
                           n8n PATCHes pipeline_runs.status → 'completed' + results
```

## 1. Webhook Trigger Setup

### Replace Manual Trigger with Webhook

In each n8n workflow that currently starts with `Manual Trigger → Metro Config`:

**Remove:** `Manual Trigger` node  
**Add:** `Webhook` node with these settings:
- HTTP Method: `POST`
- Path: `pipeline-trigger` (same for all workflows, or unique per step if you want granular control later)
- Response Mode: `Immediately` (returns 200 right away, pipeline runs async)

### Update Metro Config Node

Change the `Metro Config` Set node from hardcoded values to reading from the webhook body:

| Field | Old Value | New Value (Expression) |
|-------|-----------|----------------------|
| metro_name | `Austin, TX` | `{{ $json.body.metro_name }}` |
| latitude | `30.2672` | `{{ $json.body.latitude }}` |
| longitude | `-97.7431` | `{{ $json.body.longitude }}` |
| radius_meters | `10000` | `{{ $json.body.radius_meters }}` |
| search_queries | `massage therapy,...` | `{{ $json.body.search_queries }}` |
| yelp_location | `Austin, TX` | `{{ $json.body.yelp_location }}` |

Also add a new field to carry the run_id through the pipeline:
| Field | Value |
|-------|-------|
| run_id | `{{ $json.body.run_id }}` |

## 2. Status Callbacks (n8n → Supabase)

### Mark as Running (add after Metro Config)

Add an HTTP Request node right after Metro Config:

- **Method:** PATCH
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/pipeline_runs?id=eq.{{ $json.run_id }}`
- **Headers:**
  - `apikey`: `{{ $env.SUPABASE_SERVICE_KEY }}`
  - `Authorization`: `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=minimal`
- **Body (JSON):**
```json
{
  "status": "running",
  "started_at": "{{ $now.toISO() }}",
  "n8n_execution_id": "{{ $execution.id }}"
}
```

### Mark as Completed (add at workflow end, after Run Summary)

Add an HTTP Request node after the final Run Summary node:

- **Method:** PATCH
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/pipeline_runs?id=eq.{{ $('Metro Config').first().json.run_id }}`
- **Headers:** Same as above
- **Body (JSON):**
```json
{
  "status": "completed",
  "total_discovered": {{ $json.total_unique_records || 0 }},
  "new_records": {{ $json.new_records || 0 }},
  "contacts_found": {{ $json.contacts_found || 0 }},
  "duplicates_merged": {{ $json.duplicates_merged || 0 }},
  "completed_at": "{{ $now.toISO() }}"
}
```

Note: The exact field names from the Run Summary node may vary. Check the Run Summary output to match field names.

### Mark as Failed (error handler)

Add an Error Trigger workflow (or use n8n's built-in error handling on the workflow settings):

- **Method:** PATCH
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/pipeline_runs?id=eq.{{ run_id }}`
- **Body (JSON):**
```json
{
  "status": "failed",
  "errors": ["{{ $json.error.message || 'Unknown error' }}"],
  "completed_at": "{{ $now.toISO() }}"
}
```

Getting the `run_id` in error handlers is tricky in n8n — it depends on which node failed. The simplest approach: store `run_id` in a workflow-level variable or pass it through every node via a shared field.

## 3. Webhook Request Format

This is what the dashboard sends to n8n:

```
POST {VITE_N8N_WEBHOOK_URL}
Content-Type: application/json

{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "metro_name": "Austin, TX",
  "latitude": "30.2672",
  "longitude": "-97.7431",
  "radius_meters": "10000",
  "search_queries": "massage therapy,massage clinic,RMT,spa massage",
  "yelp_location": "Austin, TX",
  "country": "US",
  "state": "TX",
  "city": "Austin"
}
```

**Important:** `search_queries` is sent as a comma-separated STRING, not an array. The existing n8n `Split Search Queries` node already splits on commas. `latitude`, `longitude`, and `radius_meters` are sent as strings to match the current Metro Config node types.

## 4. Environment Variables Needed in n8n

These should already exist but verify:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (without trailing slash) |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (bypasses RLS) |

## 5. Testing the Integration

1. **Webhook only:** POST to the webhook URL manually (curl or Postman) with the JSON above. Verify n8n execution starts.
2. **Status callback:** Check that `pipeline_runs` row updates from 'queued' → 'running' → 'completed'.
3. **Error handling:** Kill a workflow mid-run and verify the row gets 'failed' status.
4. **Dashboard end-to-end:** Trigger from the UI, refresh dashboard, see updated status.
