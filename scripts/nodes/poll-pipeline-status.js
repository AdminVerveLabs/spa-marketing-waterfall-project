// Poll Pipeline Status — waits for pipeline_runs to reach terminal state
// Mode: runOnceForEachItem
// Position: after Trigger Pipeline, before Run Cleanup (queue wrapper)
// Polls every 30s for up to 45 minutes. Throws on failure/timeout.

const item = $input.item.json;
const url = item.supabase_url;
const key = item.supabase_key;
const runId = item.run_id;

if (!runId) {
  console.log('Poll Pipeline Status: no run_id, skipping');
  return { json: item };
}

const MAX_POLLS = 90;       // 90 × 30s = 45 minutes max
const POLL_INTERVAL = 30000; // 30 seconds
const delay = (ms) => new Promise(r => setTimeout(r, ms));

console.log(`Poll Pipeline Status: watching run_id ${runId} for ${item.metro_name}`);

for (let i = 0; i < MAX_POLLS; i++) {
  const rows = await this.helpers.httpRequest({
    method: 'GET',
    url: url + '/rest/v1/pipeline_runs',
    qs: { id: 'eq.' + runId, select: 'status,completed_batches,total_batches' },
    headers: { apikey: key, Authorization: 'Bearer ' + key },
    json: true
  });

  const run = rows && rows[0];
  if (!run) {
    console.log('  Poll ' + (i+1) + ': run_id not found, waiting...');
    await delay(POLL_INTERVAL);
    continue;
  }

  console.log('  Poll ' + (i+1) + ': status=' + run.status + ', batches=' + (run.completed_batches || 0) + '/' + (run.total_batches || '?'));

  if (run.status === 'completed') {
    return {
      json: {
        ...item,
        pipeline_status: 'completed',
        completed_batches: run.completed_batches,
        total_batches: run.total_batches
      }
    };
  }

  if (run.status === 'failed') {
    throw new Error('Pipeline failed for ' + item.metro_name + ' (run_id: ' + runId + ')');
  }

  await delay(POLL_INTERVAL);
}

throw new Error('Pipeline timed out for ' + item.metro_name + ' after 45 minutes (run_id: ' + runId + ')');
