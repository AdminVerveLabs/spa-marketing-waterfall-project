// Batch Dispatcher — Dispatches enrichment batches to sub-workflow
// Mode: runOnceForAllItems
// Input: items from Insert to Supabase (single input, no convergence from Insert Flagged)
// Output: summary for Calculate Lead Scores
//
// Phase 1: Poll for discovery inserts to stabilize (upstream Merge convergence may cause batches)
// Phase 2: Fetch all company IDs needing enrichment
// Phase 3: Split into batches of BATCH_SIZE and dispatch to sub-workflow
// (Phase 4 removed — sub-workflows are fire-and-forget, lead scoring recalculates from Supabase)

const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const sbHeaders = { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey };

const BATCH_SIZE = 25;
const BATCH_WEBHOOK_URL = $env.BATCH_ENRICHMENT_WEBHOOK_URL;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ═══ CONVERGENCE GUARD ═══
// Upstream Merge All Sources convergence can cause multiple batches to reach this node.
// Only fire on the first batch.
const staticData = $getWorkflowStaticData('global');
if (staticData._batch_dispatcher_fired) {
  console.log('Batch Dispatcher: already fired this execution, skipping duplicate batch');
  return [];
}
staticData._batch_dispatcher_fired = true;

// ═══ GET METRO FROM INPUT ═══
const inputItems = $input.all();
let metro = null;
for (const item of inputItems) {
  const d = item.json;
  if (d.discovery_metro) { metro = d.discovery_metro; break; }
  if (d.metro_name) { metro = d.metro_name; break; }
}

if (!metro) {
  try {
    metro = $('Metro Config').first().json.metro_name;
  } catch(e) {
    throw new Error('Batch Dispatcher: cannot determine metro from input or Metro Config');
  }
}

// ═══ GET RUN_ID FROM METRO CONFIG ═══
let runId = null;
try {
  runId = $('Metro Config').first().json.run_id || null;
} catch(e) {
  // No run_id — legacy trigger
}

console.log(`Batch Dispatcher: starting for metro "${metro}" (run_id: ${runId || 'none'})`);

// ═══ PHASE 1: POLL FOR DISCOVERY INSERTS TO STABILIZE ═══
// Upstream Merge convergence means Insert to Supabase may execute in multiple batches.
// Poll until the discovered count stabilizes (all batches committed).
let prevCount = -1;
let stableRounds = 0;
let discoveredCount = 0;

for (let i = 0; i < 20; i++) {
  const discovered = await this.helpers.httpRequest({
    method: 'GET',
    url: `${supabaseUrl}/rest/v1/companies?discovery_metro=eq.${encodeURIComponent(metro)}&enrichment_status=eq.discovered&select=id`,
    headers: sbHeaders,
    json: true
  });

  const count = Array.isArray(discovered) ? discovered.length : 0;
  console.log(`  Discovery poll ${i + 1}: ${count} discovered companies`);

  if (count === prevCount && count > 0) {
    stableRounds++;
    if (stableRounds >= 2) {
      discoveredCount = count;
      console.log(`  Stable at ${count} discovered companies after ${(i + 1) * 15}s`);
      break;
    }
  } else {
    stableRounds = 0;
  }
  prevCount = count;

  if (i < 19) await delay(15000);
}

if (discoveredCount === 0) {
  console.log('Batch Dispatcher: no discovered companies found after polling (20 iterations)');
  return [{ json: { step: 'batch_dispatcher', metro, status: 'no_companies', batches_dispatched: 0, message: 'No discovered companies found after 300s of polling' } }];
}

// ═══ PHASE 2: FETCH ALL COMPANIES NEEDING ENRICHMENT ═══
// Include both discovered AND partially_enriched (ADR-020)
const allCompanies = await this.helpers.httpRequest({
  method: 'GET',
  url: `${supabaseUrl}/rest/v1/companies?discovery_metro=eq.${encodeURIComponent(metro)}&enrichment_status=in.(discovered,partially_enriched)&select=id&limit=2000`,
  headers: sbHeaders,
  json: true
});

const companyIds = (Array.isArray(allCompanies) ? allCompanies : []).map(c => c.id);
const totalCompanies = companyIds.length;
console.log(`Batch Dispatcher: ${totalCompanies} companies need enrichment (${discoveredCount} discovered + ${totalCompanies - discoveredCount} partially_enriched)`);

if (totalCompanies === 0) {
  return [{ json: { step: 'batch_dispatcher', metro, status: 'no_companies_to_enrich', batches_dispatched: 0 } }];
}

// ═══ PHASE 3: SPLIT INTO BATCHES AND DISPATCH ═══
const batches = [];
for (let i = 0; i < companyIds.length; i += BATCH_SIZE) {
  batches.push(companyIds.slice(i, i + BATCH_SIZE));
}

console.log(`Batch Dispatcher: dispatching ${batches.length} batches of up to ${BATCH_SIZE} companies each`);

// ═══ WRITE TOTAL_BATCHES TO PIPELINE_RUNS (if run_id exists) ═══
if (runId) {
  try {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${runId}`,
      headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: { total_batches: batches.length, total_discovered: discoveredCount },
      json: true
    });
    console.log(`  Updated pipeline_runs: total_batches=${batches.length}, total_discovered=${discoveredCount}`);
  } catch(e) {
    console.log(`  WARNING: Failed to update pipeline_runs total_batches: ${e.message}`);
    // Non-blocking — pipeline continues
  }
}

// Fire all webhooks simultaneously — Respond to Webhook returns 200 immediately
const promises = batches.map((batch, i) =>
  this.helpers.httpRequest({
    method: 'POST',
    url: BATCH_WEBHOOK_URL,
    headers: { 'Content-Type': 'application/json' },
    body: { company_ids: batch, metro, run_id: runId },
    json: true,
    timeout: 30000
  }).then(() => {
    console.log(`  Batch ${i + 1}/${batches.length}: ${batch.length} companies dispatched`);
    return { batch: i, size: batch.length, status: 'dispatched' };
  }).catch(e => {
    console.log(`  Batch ${i + 1}/${batches.length}: dispatch ERROR: ${e.message}`);
    return { batch: i, size: batch.length, status: 'error', error: e.message };
  })
);

const dispatchResults = await Promise.all(promises);
const successfullyDispatched = dispatchResults.filter(r => r.status === 'dispatched').length;
console.log(`Batch Dispatcher: ${successfullyDispatched}/${batches.length} batches dispatched successfully`);

// ═══ SUMMARY (no completion polling — sub-workflows are fire-and-forget) ═══
const summary = {
  step: 'batch_dispatcher',
  metro,
  run_id: runId,
  discovered_count: discoveredCount,
  total_companies_dispatched: totalCompanies,
  batches_dispatched: successfullyDispatched,
  batches_total: batches.length,
  batch_size: BATCH_SIZE,
  status: successfullyDispatched === batches.length ? 'all_dispatched' : 'partial_dispatch',
  message: `Dispatched ${successfullyDispatched}/${batches.length} batches (${totalCompanies} companies in batches of ${BATCH_SIZE}). Enrichment running asynchronously.`
};

console.log('=== BATCH DISPATCHER SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

return [{ json: summary }];
