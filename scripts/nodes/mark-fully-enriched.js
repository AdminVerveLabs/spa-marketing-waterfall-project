// Mark Fully Enriched — Final node in sub-workflow batch enrichment chain
// Mode: runOnceForAllItems
// Input: results from Enrich Contacts (carries metro + company_ids)
// Output: confirmation of status update
//
// PATCHes all companies in the batch to enrichment_status = 'fully_enriched'.

const inputData = $input.first().json;
const companyIds = inputData.company_ids || [];
const metro = inputData.metro || 'unknown';

const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;

if (companyIds.length === 0) {
  console.log('Mark Fully Enriched: no company IDs in input, skipping');
  return [{ json: { step: 'mark_fully_enriched', metro, updated: 0 } }];
}

console.log(`Mark Fully Enriched: marking ${companyIds.length} companies as fully_enriched for ${metro}`);

try {
  await this.helpers.httpRequest({
    method: 'PATCH',
    url: `${supabaseUrl}/rest/v1/companies?id=in.(${companyIds.join(',')})`,
    headers: {
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: { enrichment_status: 'fully_enriched' },
    json: true
  });
  console.log(`  Successfully marked ${companyIds.length} companies as fully_enriched`);
} catch(e) {
  console.log(`  ERROR marking companies as fully_enriched: ${e.message}`);
  return [{ json: { step: 'mark_fully_enriched', metro, updated: 0, error: e.message, company_ids: companyIds } }];
}

return [{ json: { step: 'mark_fully_enriched', metro, updated: companyIds.length, company_ids: companyIds } }];
