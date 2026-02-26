// Apollo Custom Field Key Mapping — Diagnostic Utility
// Run this in an n8n Code node (mode: runOnceForAllItems) after the first
// Apollo Sync run has created custom fields.
//
// Returns a mapping of { label: key } for all VerveLabs custom fields,
// which can be used to update the sync workflow code nodes if Apollo
// requires field keys instead of labels.
//
// Usage: Paste into a Code node, set APOLLO_API_KEY, execute manually.

const APOLLO_API_KEY = $env.APOLLO_API_KEY; // or paste key directly for one-off use

const res = await fetch('https://api.apollo.io/api/v1/fields', {
  headers: {
    'x-api-key': APOLLO_API_KEY,
    'Content-Type': 'application/json'
  }
});
const data = await res.json();

// Filter for VerveLabs-created custom fields
const VERVELABS_LABELS = [
  'Lead Score', 'Has Website', 'Has Online Booking', 'Booking Platform',
  'Has Paid Ads', 'On Groupon', 'On Yelp', 'Google Review Count',
  'Google Rating', 'Estimated Size', 'Enrichment Status', 'Category',
  'VerveLabs Run Tag', 'Cultural Affinity', 'Is Owner', 'Contact Role',
  'Contact Source'
];

const labelSet = new Set(VERVELABS_LABELS.map(l => l.toLowerCase()));

const mapping = data.fields
  .filter(f => labelSet.has(f.label?.toLowerCase()))
  .map(f => ({
    label: f.label,
    key: f.key,
    modality: f.modality,
    field_type: f.field_type
  }));

return [{ json: { field_mapping: mapping, total_found: mapping.length } }];
