// Complete Report — PATCH pipeline_runs after Supabase Storage upload
// Mode: runOnceForAllItems
// Constructs report_url, marks report as completed (or failed if upload errored).
// Passes all data through for Send Email node.

const input = $input.first().json;
const { run_id, metro, triggered_by, filename, base64, summary } = input;

const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const sbHeaders = {
  'apikey': supabaseKey,
  'Authorization': 'Bearer ' + supabaseKey,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// Check if the Upload to Storage node returned an error
// n8n HTTP Request with "Continue on Error" puts error info in the item
const uploadError = input.error || input.errorMessage || null;

let reportUrl = null;
let reportStatus = 'completed';

if (uploadError) {
  // Upload failed — mark report as failed
  reportStatus = 'failed';
  const errorMsg = typeof uploadError === 'string' ? uploadError : JSON.stringify(uploadError);
  console.log(`Complete Report: upload failed — ${errorMsg}`);

  try {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${run_id}`,
      headers: sbHeaders,
      body: { report_status: 'failed', report_error: errorMsg.substring(0, 500) },
      json: true
    });
  } catch(e) {
    console.log(`Complete Report: WARNING — failed to PATCH pipeline_runs: ${e.message}`);
  }
} else {
  // Upload succeeded — construct report_url and mark completed
  const storagePath = `${run_id}/${filename}`;
  reportUrl = `${supabaseUrl}/storage/v1/object/public/run-reports/${storagePath}`;

  try {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${run_id}`,
      headers: sbHeaders,
      body: { report_url: reportUrl, report_status: 'completed' },
      json: true
    });
    console.log(`Complete Report: marked completed — ${reportUrl}`);
  } catch(e) {
    console.log(`Complete Report: WARNING — failed to PATCH pipeline_runs: ${e.message}`);
  }
}

// Pass through all data for Send Email node
return [{ json: {
  run_id,
  metro,
  triggered_by,
  report_url: reportUrl,
  filename,
  base64,
  summary,
  report_status: reportStatus
}}];
