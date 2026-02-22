// Fetch Report Data — First Code node in Report Generator workflow
// Mode: runOnceForAllItems
// Reads run_id + metro from webhook body, fetches pipeline_runs row,
// marks report_status = 'generating', calls get_lead_report RPC.

const webhookData = $('Webhook').first().json;
const payload = webhookData.body || webhookData;
const runId = payload.run_id;
const metro = payload.metro;

if (!runId || !metro) {
  return [{ json: { error: 'Missing run_id or metro in webhook body', payload } }];
}

const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const sbHeaders = {
  'apikey': supabaseKey,
  'Authorization': 'Bearer ' + supabaseKey,
  'Content-Type': 'application/json'
};

// Fetch pipeline_runs row to get triggered_by email and metro_name
const pipelineRuns = await this.helpers.httpRequest({
  method: 'GET',
  url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${runId}&select=*`,
  headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey },
  json: true
});

if (!Array.isArray(pipelineRuns) || pipelineRuns.length === 0) {
  return [{ json: { error: `pipeline_runs not found for run_id: ${runId}` } }];
}

const pipelineRun = pipelineRuns[0];
const triggeredBy = pipelineRun.triggered_by || 'unknown';
const metroName = pipelineRun.metro_name || metro;

console.log(`Fetch Report Data: run_id=${runId}, metro=${metro}, triggered_by=${triggeredBy}`);

// Mark report_status = 'generating'
try {
  await this.helpers.httpRequest({
    method: 'PATCH',
    url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${runId}`,
    headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
    body: { report_status: 'generating' },
    json: true
  });
} catch(e) {
  console.log(`Fetch Report Data: WARNING — failed to set report_status: ${e.message}`);
}

// Call get_lead_report RPC to get companies + contacts + social profiles
const data = await this.helpers.httpRequest({
  method: 'POST',
  url: `${supabaseUrl}/rest/v1/rpc/get_lead_report`,
  headers: sbHeaders,
  body: { p_metro: metro },
  json: true
});

const records = Array.isArray(data) ? data : [];
console.log(`Fetch Report Data: got ${records.length} records for ${metro}`);

return [{ json: {
  run_id: runId,
  metro,
  metro_name: metroName,
  triggered_by: triggeredBy,
  pipeline_run: pipelineRun,
  data: records
}}];
