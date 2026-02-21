// Mark Running — PATCHes pipeline_runs to 'running' status
// Mode: runOnceForAllItems
// Position: between Metro Config and Split Search Queries
// Skips if no run_id (legacy trigger)
// Non-blocking: catches errors without stopping pipeline

const items = $input.all();
const metroConfig = items[0].json;
const runId = metroConfig.run_id || null;

if (!runId) {
  console.log('Mark Running: no run_id, skipping (legacy trigger)');
  return items;
}

const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;

try {
  await this.helpers.httpRequest({
    method: 'PATCH',
    url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${runId}`,
    headers: {
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: {
      status: 'running',
      started_at: new Date().toISOString(),
      n8n_execution_id: $execution.id
    },
    json: true
  });
  console.log(`Mark Running: pipeline_runs ${runId} → running (execution: ${$execution.id})`);
} catch(e) {
  console.log(`Mark Running: WARNING — failed to update pipeline_runs: ${e.message}`);
  // Non-blocking — pipeline continues regardless
}

// Pass through all items unchanged
return items;
