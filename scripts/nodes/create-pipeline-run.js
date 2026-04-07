// Create Pipeline Run — inserts pipeline_runs row, stores run_id on queue item
// Mode: runOnceForEachItem
// Position: after IF Has Metro, before Trigger Pipeline (queue wrapper)
// Creates a pipeline_runs row so the main workflow can track status via run_id

const item = $input.item.json;
const url = item.supabase_url;
const key = item.supabase_key;
const headers = {
  apikey: key,
  Authorization: 'Bearer ' + key,
  'Content-Type': 'application/json'
};

const DEFAULT_QUERIES = 'massage therapy,massage clinic,massage therapist,spa massage,therapeutic massage,deep tissue massage,sports massage,bodywork,day spa,wellness spa,relaxation massage,licensed massage therapist';

// Parse city from metro_name (e.g., "Price, UT" → "Price")
const city = item.metro_name.split(',')[0].trim();

console.log(`Create Pipeline Run: ${item.metro_name} (queue_id: ${item.queue_id})`);

// Step 1: INSERT pipeline_runs row
const runRow = await this.helpers.httpRequest({
  method: 'POST',
  url: url + '/rest/v1/pipeline_runs',
  headers: { ...headers, Prefer: 'return=representation' },
  body: {
    metro_name: item.metro_name,
    country: item.country || 'US',
    state: item.state,
    city: city,
    latitude: item.latitude,
    longitude: item.longitude,
    radius_meters: item.radius_meters || 15000,
    search_queries: DEFAULT_QUERIES.split(','),
    status: 'queued',
    triggered_by: 'queue_wrapper'
  },
  json: true
});

const runId = runRow[0].id;
console.log(`  Created pipeline_runs: ${runId}`);

// Step 2: PATCH pipeline_queue to store run_id FK
await this.helpers.httpRequest({
  method: 'PATCH',
  url: url + '/rest/v1/pipeline_queue',
  qs: { id: 'eq.' + item.queue_id },
  headers: { ...headers, Prefer: 'return=minimal' },
  body: { run_id: runId },
  json: true
});

console.log(`  Linked queue_id ${item.queue_id} → run_id ${runId}`);

return { json: { ...item, run_id: runId } };
