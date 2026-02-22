// Track Batch Completion — Final node in sub-workflow (after Mark Fully Enriched)
// Mode: runOnceForAllItems
// Increments completed_batches atomically. If last batch, marks run as completed.
// Skips if no run_id (legacy trigger).

const inputData = $input.first().json;
const companyIds = inputData.company_ids || [];
const metro = inputData.metro || 'unknown';

// Read run_id from webhook body (sub-workflow receives it via POST from Batch Dispatcher)
let runId = null;
try {
  const webhookData = $('Webhook').first().json;
  const payload = webhookData.body || webhookData;
  runId = payload.run_id || null;
} catch(e) {
  // Webhook reference failed — try from input chain
  runId = inputData.run_id || null;
}

if (!runId) {
  console.log('Track Batch Completion: no run_id, skipping (legacy trigger)');
  return [{ json: { step: 'track_batch_completion', metro, skipped: true, reason: 'no_run_id' } }];
}

const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const sbHeaders = {
  'apikey': supabaseKey,
  'Authorization': 'Bearer ' + supabaseKey,
  'Content-Type': 'application/json'
};

try {
  // Atomically increment completed_batches
  const result = await this.helpers.httpRequest({
    method: 'POST',
    url: `${supabaseUrl}/rest/v1/rpc/increment_completed_batches`,
    headers: sbHeaders,
    body: { p_run_id: runId },
    json: true
  });

  console.log(`Track Batch Completion: ${metro} batch done — ${JSON.stringify(result)}`);

  if (result && result.is_last_batch) {
    console.log('Track Batch Completion: LAST BATCH — marking run as completed');

    // Query totals for this metro
    let totalDiscovered = 0;
    let contactsFound = 0;
    try {
      const companies = await this.helpers.httpRequest({
        method: 'GET',
        url: `${supabaseUrl}/rest/v1/companies?discovery_metro=eq.${encodeURIComponent(metro)}&select=id`,
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey },
        json: true
      });
      totalDiscovered = Array.isArray(companies) ? companies.length : 0;

      // Count contacts for companies in this metro (server-side filter)
      const companyIdsStr = (Array.isArray(companies) ? companies : []).map(c => c.id).join(',');
      if (companyIdsStr) {
        const contacts = await this.helpers.httpRequest({
          method: 'GET',
          url: `${supabaseUrl}/rest/v1/contacts?company_id=in.(${companyIdsStr})&select=id`,
          headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey },
          json: true
        });
        contactsFound = Array.isArray(contacts) ? contacts.length : 0;
      }
    } catch(e) {
      console.log(`  WARNING: Failed to query totals: ${e.message}`);
    }

    // Mark run as completed
    try {
      await this.helpers.httpRequest({
        method: 'PATCH',
        url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${runId}`,
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: {
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_discovered: totalDiscovered,
          contacts_found: contactsFound
        },
        json: true
      });
      console.log(`Track Batch Completion: pipeline_runs ${runId} → completed (${totalDiscovered} companies, ${contactsFound} contacts)`);
    } catch(e) {
      console.log(`  WARNING: Failed to mark run as completed: ${e.message}`);
    }

    // Trigger report generation (non-blocking)
    const reportWebhookUrl = $env.REPORT_GENERATOR_WEBHOOK_URL;
    if (reportWebhookUrl) {
      try {
        await this.helpers.httpRequest({
          method: 'POST',
          url: reportWebhookUrl,
          body: { run_id: runId, metro: metro },
          json: true,
          timeout: 10000
        });
        console.log(`Track Batch Completion: report generation triggered for ${metro}`);
      } catch(e) {
        console.log(`Track Batch Completion: report trigger failed (non-fatal): ${e.message}`);
      }
    }
  }

  return [{ json: {
    step: 'track_batch_completion',
    metro,
    run_id: runId,
    completed_batches: result ? result.completed_batches : null,
    total_batches: result ? result.total_batches : null,
    is_last_batch: result ? result.is_last_batch : false,
    companies_in_batch: companyIds.length
  }}];

} catch(e) {
  console.log(`Track Batch Completion: ERROR — ${e.message}`);
  // Non-blocking — enrichment succeeded even if tracking fails
  return [{ json: { step: 'track_batch_completion', metro, run_id: runId, error: e.message } }];
}
