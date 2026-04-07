// Phase 4.5: Assign Contacts to Prospect List with 1000-cap rotation
// Mode: runOnceForAllItems
// Node: "Assign to Prospect List" in Apollo Sync v1 (g9uplPwBAaaVgm4X)
// Position: Between "Upsert Contacts" and "Mark Synced"

const items = $input.all();
const cfg = items[0].json._config;
if (!cfg) throw new Error('_config missing from input items');

const APOLLO_API_KEY = cfg.apollo_api_key;
const SUPABASE_URL = cfg.supabase_url;
const SUPABASE_KEY = cfg.supabase_service_key;
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
const configData = await this.helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/pipeline_config?key=eq.active_prospect_list&select=value`,
  headers: supabaseHeaders,
  json: true
});
let activeList = configData?.[0]?.value || 'VerveLabs-Prospects-001';

// Step 2: Count contacts currently in that list via Apollo search
let currentCount = 0;
try {
  const countData = await this.helpers.httpRequest({
    method: 'POST',
    url: `${BASE_URL}/contacts/search`,
    headers: apolloHeaders,
    body: {
      label_names: [activeList],
      page: 1,
      per_page: 1
    },
    json: true
  });
  currentCount = countData?.pagination?.total_entries || 0;
} catch (e) {
  // If search fails, proceed with count=0 (safe: won't rotate)
}

await new Promise(r => setTimeout(r, 700));

// Step 3: Rotate list if at or over 1000
let rotated = false;
if (currentCount >= 1000) {
  activeList = getNextListName(activeList);
  rotated = true;

  // Update Supabase config with new list name
  await this.helpers.httpRequest({
    method: 'PATCH',
    url: `${SUPABASE_URL}/rest/v1/pipeline_config?key=eq.active_prospect_list`,
    headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
    body: { value: activeList, updated_at: new Date().toISOString() },
    json: true
  });
}

// Step 4: Collect all Apollo contact IDs from this batch
const apolloContactIds = [];
for (const item of items) {
  const contactResults = item.json.contact_results || [];
  for (const cr of contactResults) {
    if (cr.apollo_contact_id) {
      apolloContactIds.push(cr.apollo_contact_id);
    }
  }
}

const summary = {
  phase: 'list_assignment',
  active_list: activeList,
  list_count_before: currentCount,
  rotated,
  contacts_found: apolloContactIds.length,
  contacts_added: 0,
  errors: []
};

// Step 5: Add contacts to active list in batches of 25
if (apolloContactIds.length > 0) {
  const BATCH_SIZE = 25;
  for (let i = 0; i < apolloContactIds.length; i += BATCH_SIZE) {
    const batch = apolloContactIds.slice(i, i + BATCH_SIZE);
    try {
      await this.helpers.httpRequest({
        method: 'POST',
        url: `${BASE_URL}/contacts/bulk_update`,
        headers: apolloHeaders,
        body: {
          contact_ids: batch,
          label_names: [activeList]
        },
        json: true
      });
      summary.contacts_added += batch.length;
    } catch (e) {
      summary.errors.push(`Batch ${i}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 700));
  }
}

// Return ALL original items with _config intact for Mark Synced
// Attach list assignment summary to first item for logging
return items.map((item, idx) => ({
  json: {
    ...item.json,
    ...(idx === 0 ? { _listAssignment: summary } : {})
  }
}));
