# Prospect List Automation — Claude Code Implementation Guide

**Project:** VerveLabs Spa Waterfall  
**Task:** Add a new "Assign to Prospect List" phase to the Apollo sync n8n workflow  
**Goal:** After contacts are upserted to Apollo, automatically assign them to a rotating prospect list (max 1000 contacts per list, then create a new one)

---

## Context

The Apollo sync workflow (`apollo-sync` or similar name in n8n) currently has 5 phases:

1. Setup Custom Fields
2. Fetch Unsynced Data
3. Upsert Accounts
4. Upsert Contacts ← **insert new node after this**
5. Mark Synced

You are adding **Phase 4.5: Assign to Prospect List** between Phase 4 and Phase 5.

The active list name is stored in a Supabase table called `pipeline_config` with key `active_prospect_list`. This table has already been created and seeded with value `VerveLabs-Prospects-001`.

---

## Pre-Flight Checks

Before making any changes, run these checks first.

### 1. Confirm Supabase config table is ready

Query Supabase:

```sql
SELECT * FROM pipeline_config WHERE key = 'active_prospect_list';
```

**Expected result:** One row with `value = 'VerveLabs-Prospects-001'`

If missing, stop and report — do not proceed without this row.

### 2. Identify the correct workflow in n8n

Use the MCP to list workflows and find the Apollo sync workflow. It will likely be named something like `Apollo Sync`, `apollo-sync`, or `VerveLabs Apollo Sync`. Confirm it contains nodes named approximately:

- `Upsert Contacts` (Phase 4)
- `Mark Synced` (Phase 5)

Note the exact node names — you'll need them for wiring.

### 3. Confirm the workflow's Set Config node

Find the `Set Config` node and confirm it has these fields set (values don't matter, just confirm the keys exist):

- `apollo_api_key`
- `supabase_url`
- `supabase_service_key`

If any are missing, stop and report before proceeding.

---

## Implementation

### Step 1: Add the new Code node

In the Apollo sync workflow, add a new **Code** node between `Upsert Contacts` and `Mark Synced`.

**Node settings:**
- Name: `Assign to Prospect List`
- Type: Code
- Mode: `runOnceForAllItems`

**Code:**

```javascript
// Phase 4.5: Assign Contacts to Prospect List with 1000-cap rotation
// Mode: runOnceForAllItems

const APOLLO_API_KEY = $('Set Config').item.json.apollo_api_key;
const SUPABASE_URL = $('Set Config').item.json.supabase_url;
const SUPABASE_KEY = $('Set Config').item.json.supabase_service_key;
const BASE_URL = 'https://api.apollo.io/api/v1';

const supabaseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

const apolloHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': APOLLO_API_KEY,
  'Cache-Control': 'no-cache'
};

// Helper: increment list name (VerveLabs-Prospects-001 -> VerveLabs-Prospects-002)
function getNextListName(current) {
  const match = current.match(/^(.*-)(\d+)$/);
  if (!match) return current + '-002';
  const prefix = match[1];
  const num = parseInt(match[2], 10) + 1;
  return prefix + String(num).padStart(3, '0');
}

// Step 1: Get active list name from Supabase config
const configRes = await fetch(
  `${SUPABASE_URL}/rest/v1/pipeline_config?key=eq.active_prospect_list&select=value`,
  { headers: supabaseHeaders }
);
const configData = await configRes.json();
let activeList = configData?.[0]?.value || 'VerveLabs-Prospects-001';

// Step 2: Count contacts currently in that list via Apollo search
const countRes = await fetch(`${BASE_URL}/contacts/search`, {
  method: 'POST',
  headers: apolloHeaders,
  body: JSON.stringify({
    label_names: [activeList],
    page: 1,
    per_page: 1
  })
});
const countData = await countRes.json();
const currentCount = countData?.pagination?.total_entries || 0;

await new Promise(r => setTimeout(r, 700));

// Step 3: Rotate list if at or over 1000
let rotated = false;
if (currentCount >= 1000) {
  activeList = getNextListName(activeList);
  rotated = true;

  // Update Supabase config with new list name
  await fetch(
    `${SUPABASE_URL}/rest/v1/pipeline_config?key=eq.active_prospect_list`,
    {
      method: 'PATCH',
      headers: supabaseHeaders,
      body: JSON.stringify({ value: activeList, updated_at: new Date().toISOString() })
    }
  );
}

// Step 4: Collect all Apollo contact IDs from this batch
const allItems = $input.all();
const apolloContactIds = [];

for (const item of allItems) {
  const contactResults = item.json.contact_results || [];
  for (const cr of contactResults) {
    if (cr.apollo_contact_id) {
      apolloContactIds.push(cr.apollo_contact_id);
    }
  }
}

if (apolloContactIds.length === 0) {
  return [{
    json: {
      phase: 'list_assignment',
      active_list: activeList,
      list_count_before: currentCount,
      rotated,
      contacts_added: 0,
      message: 'No Apollo contact IDs found in batch'
    }
  }];
}

// Step 5: Add contacts to active list in batches of 25
const BATCH_SIZE = 25;
const results = { success: 0, errors: [] };

for (let i = 0; i < apolloContactIds.length; i += BATCH_SIZE) {
  const batch = apolloContactIds.slice(i, i + BATCH_SIZE);

  try {
    const updateRes = await fetch(`${BASE_URL}/contacts/bulk_update`, {
      method: 'POST',
      headers: apolloHeaders,
      body: JSON.stringify({
        contact_ids: batch,
        label_names: [activeList]
      })
    });

    if (updateRes.ok) {
      results.success += batch.length;
    } else {
      const err = await updateRes.json();
      results.errors.push(`Batch ${i}: ${JSON.stringify(err)}`);
    }
  } catch (e) {
    results.errors.push(`Batch ${i}: ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 700));
}

return [{
  json: {
    phase: 'list_assignment',
    active_list: activeList,
    rotated,
    list_count_before: currentCount,
    contacts_added: results.success,
    errors: results.errors
  }
}];
```

### Step 2: Wire the node

Connect the nodes in this order:

```
Upsert Contacts → Assign to Prospect List → Mark Synced
```

Remove the existing direct connection between `Upsert Contacts` and `Mark Synced` and replace it with these two new connections.

### Step 3: Save the workflow

Save the workflow. Do not activate or run it yet.

---

## Verification

### Verification 1: Dry run check (Supabase)

After saving, query Supabase to confirm the config row is still intact and unmodified:

```sql
SELECT key, value, updated_at FROM pipeline_config WHERE key = 'active_prospect_list';
```

Expected: `value = 'VerveLabs-Prospects-001'`, `updated_at` unchanged.

### Verification 2: Test run with a small batch

Trigger the Apollo sync workflow manually. Before doing so, confirm there are at least a few `fully_enriched` companies with `apollo_synced_at IS NULL` in Supabase so the workflow has data to process:

```sql
SELECT COUNT(*) 
FROM companies 
WHERE enrichment_status = 'fully_enriched' 
  AND (apollo_synced_at IS NULL OR enriched_at > apollo_synced_at);
```

If count is 0, the workflow will exit at the `IF Has Data` node — that's fine, but you won't be able to verify the new node ran. In that case, temporarily reset a few records:

```sql
UPDATE companies 
SET apollo_synced_at = NULL 
WHERE id IN (
  SELECT id FROM companies 
  WHERE enrichment_status = 'fully_enriched' 
  LIMIT 3
);
```

Then trigger the workflow.

### Verification 3: Inspect the node output

After the run completes, inspect the output of the `Assign to Prospect List` node. You should see:

```json
{
  "phase": "list_assignment",
  "active_list": "VerveLabs-Prospects-001",
  "rotated": false,
  "list_count_before": <some number>,
  "contacts_added": <number matching batch size>,
  "errors": []
}
```

Flag any run where `errors` is non-empty or `contacts_added` is 0 but contacts were expected.

### Verification 4: Confirm label in Apollo

In Apollo, go to **People** → filter by label `VerveLabs-Prospects-001`. Confirm the contacts from the test run appear there.

If the label doesn't exist yet in Apollo's UI, that's normal on the first run — Apollo creates labels automatically when they're first assigned to a contact.

### Verification 5: Confirm rotation logic (simulate)

To verify rotation works without waiting for 1000 real contacts, temporarily update the Supabase config to a test list name and manually set the count check threshold. The cleanest way is to:

1. Temporarily change the condition in the code from `>= 1000` to `>= 2` 
2. Run the workflow
3. Confirm the output shows `rotated: true` and a new list name (e.g. `VerveLabs-Prospects-002`)
4. Confirm Supabase `pipeline_config` updated to `VerveLabs-Prospects-002`
5. Revert the condition back to `>= 1000`
6. Reset Supabase config back to `VerveLabs-Prospects-001`

```sql
UPDATE pipeline_config 
SET value = 'VerveLabs-Prospects-001', updated_at = NOW() 
WHERE key = 'active_prospect_list';
```

### Verification 6: End-to-end run confirmation

After reverting the rotation threshold, do one final clean run and confirm:

1. `Assign to Prospect List` node output shows no errors
2. `Mark Synced` node still runs successfully after the new node
3. `apollo_synced_at` is updated on the companies in Supabase
4. Contacts appear in the correct Apollo label

---

## What to Report Back

After completing implementation and verification, report:

- Whether all 6 verification steps passed
- The output JSON from the `Assign to Prospect List` node on the final clean run
- Any errors encountered and how they were resolved
- Current value of `pipeline_config.active_prospect_list` in Supabase

---

## Known Edge Cases

- **No contacts in batch:** The node handles this gracefully and returns `contacts_added: 0` with a message. This is not an error.
- **Apollo rate limits (429):** The 700ms delays should prevent this. If 429s appear in errors, increase the delay to 1200ms in both `await` calls.
- **Apollo bulk_update endpoint returns 404:** Fall back to individual PATCH calls per contact. Report this if it occurs — the endpoint name may differ on your Apollo plan.
- **Rotation fires mid-batch:** This is intentional. All contacts in the batch go to the new list. The old list stays at whatever count triggered the rotation.
