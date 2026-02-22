// Generate Report — ExcelJS-based report generator
// Mode: runOnceForAllItems
// Implements the full v2 report guide: clean, tier, build xlsx.
// Outputs binary xlsx as n8n binary attachment for downstream HTTP Request upload.
// Requires: NODE_FUNCTION_ALLOW_EXTERNAL=exceljs in n8n env vars.

const ExcelJS = require('exceljs');

const input = $input.first().json;
const { run_id, metro, metro_name, triggered_by, pipeline_run, data } = input;

if (!data || !Array.isArray(data) || data.length === 0) {
  // No data — mark report as failed
  const supabaseUrl = $env.SUPABASE_URL;
  const supabaseKey = $env.SUPABASE_SERVICE_KEY;
  try {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: `${supabaseUrl}/rest/v1/pipeline_runs?id=eq.${run_id}`,
      headers: {
        'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: { report_status: 'failed', report_error: 'No data returned from get_lead_report RPC' },
      json: true
    });
  } catch(e) { /* best effort */ }
  return [{ json: { error: 'No data to generate report', run_id } }];
}

const TODAY = new Date().toISOString().split('T')[0];

// ============================================================
// CONFIG
// ============================================================
const JUNK_CATEGORIES = [
  'Transportation Service', 'Car repair and maintenance service',
  'Corporate Office', 'Car Rental Agency', 'Educational Institution',
  'Association / Organization', 'Storage Facility', 'Shipping Service', 'Car Dealer'
];

const TIER_SORT = {
  '1a - Name + Email + Phone': 0,
  '1b - Name + Channel': 1,
  '2a - Phone + Website': 2,
  '2b - Co.Phone + Web + Rating': 3,
  'Other': 4
};

const TIER_COLORS = {
  '1a - Name + Email + Phone': 'FF92D050',
  '1b - Name + Channel': 'FFC6EFCE',
  '2a - Phone + Website': 'FFFCE4D6',
  '2b - Co.Phone + Web + Rating': 'FFF2F2F2',
  'Other': 'FFFFFFFF'
};

const OUTPUT_COLUMNS = {
  'tier': 'Tier', 'lead_score': 'Score', 'metro_group': 'Metro',
  'company_name': 'Business Name', 'category_clean': 'Category',
  'estimated_size': 'Est. Size', 'contact_name': 'Contact Name',
  'contact_role': 'Role', 'owner': 'Owner?', 'contact_email': 'Contact Email',
  'contact_phone': 'Contact Phone', 'company_phone': 'Business Phone',
  'cultural_affinity': 'Cultural Affinity', 'linkedin_url': 'LinkedIn',
  'website': 'Website', 'address': 'Address', 'city': 'City', 'state': 'State',
  'google_rating': 'Rating', 'google_reviews': 'Reviews',
  'booking_platform': 'Booking Platform', 'on_groupon': 'On Groupon?',
  'instagram_url': 'Instagram', 'facebook_url': 'Facebook',
  'tiktok_url': 'TikTok', 'social_platforms': 'Social Platforms',
  'contact_source': 'Contact Source'
};

const COLUMN_WIDTHS = {
  'Tier': 26, 'Score': 7, 'Metro': 20, 'Business Name': 32,
  'Category': 14, 'Est. Size': 10, 'Contact Name': 22, 'Role': 12,
  'Owner?': 8, 'Contact Email': 30, 'Contact Phone': 16,
  'Business Phone': 16, 'Cultural Affinity': 26, 'LinkedIn': 30,
  'Website': 26, 'Address': 38, 'City': 14, 'State': 7,
  'Rating': 7, 'Reviews': 9, 'Booking Platform': 16,
  'On Groupon?': 11, 'Instagram': 30, 'Facebook': 30,
  'TikTok': 28, 'Social Platforms': 25, 'Contact Source': 13
};

// ============================================================
// STEP 1: CLEAN
// ============================================================
let records = data.filter(r => !JUNK_CATEGORIES.includes(r.category));

// Normalize nulls
const isBlank = (v) => v === null || v === undefined || v === '' || v === 'null' || v === 'None';
const clean = (v) => isBlank(v) ? null : v;

records = records.map(r => {
  const cleaned = {};
  for (const [k, v] of Object.entries(r)) {
    cleaned[k] = clean(v);
  }
  return cleaned;
});

// Simplify categories
function simplifyCategory(cat) {
  if (!cat) return 'Unknown';
  const cl = cat.toLowerCase();
  if (cl.includes('spa') && cl.includes('massage')) return 'Massage Spa';
  if (cl.includes('day spa')) return 'Day Spa';
  if (cl.includes('spa')) return 'Spa';
  if (cl.includes('massage')) return 'Massage';
  if (cl.includes('wellness')) return 'Wellness Center';
  if (cl.includes('chiro')) return 'Chiropractor';
  if (cl.includes('physical therap')) return 'Physical Therapist';
  if (cl.includes('nail salon')) return 'Nail Salon';
  if (cl.includes('hair salon') || cl.includes('beauty salon')) return 'Salon';
  if (cl.includes('medical') || cl.includes('doctor') || cl.includes('health')) return 'Health & Medical';
  return cat;
}

// Metro grouping
function normalizeMetro(row) {
  const m = String(row.metro || '');
  const st = String(row.state || '');
  if (st === 'AZ' && ['Sedona', 'Cornville', 'Cottonwood', 'Camp Verde', 'Rimrock', 'Big Park', 'Clarkdale', 'Flagstaff'].some(x => m.includes(x))) {
    return 'Sedona Area, AZ';
  }
  if (st === 'AZ') return 'Phoenix Metro, AZ';
  if (st === 'TN') return 'Nashville Area, TN';
  if (st === 'TX') return 'Austin Area, TX';
  if (st === 'CA') return 'San Diego Area, CA';
  if (st === 'ID') return 'Boise Area, ID';
  if (st === 'CO') return 'Denver Area, CO';
  if (st === 'OR') return 'Portland Area, OR';
  if (st === 'NC') return 'Asheville Area, NC';
  if (st === 'ON') return 'Toronto Area, ON';
  if (st === 'FL') return 'Tampa Area, FL';
  return m;
}

records = records.map(r => ({
  ...r,
  category_clean: simplifyCategory(r.category),
  metro_group: normalizeMetro(r)
}));

// Deduplicate by company_name
const seen = new Set();
records = records.filter(r => {
  const name = (r.company_name || '').toLowerCase().trim();
  if (seen.has(name)) return false;
  seen.add(name);
  return true;
});

const totalRecords = records.length;

// ============================================================
// STEP 2: TIER
// ============================================================
function assignTier(r) {
  const hasName = r.contact_name && String(r.contact_name).trim() !== '';
  const hasEmail = r.contact_email && String(r.contact_email).trim() !== '';
  const hasCPhone = r.contact_phone && String(r.contact_phone).trim() !== '';
  const hasWebsite = r.website && String(r.website).trim() !== '';
  const hasRating = r.google_rating !== null && r.google_rating !== undefined;
  const hasCoPhone = r.company_phone && String(r.company_phone).trim() !== '';

  if (hasName && hasEmail && hasCPhone) return '1a - Name + Email + Phone';
  if (hasName && (hasEmail || hasCPhone)) return '1b - Name + Channel';
  if (hasCPhone && hasWebsite) return '2a - Phone + Website';
  if (hasCoPhone && hasWebsite && hasRating) return '2b - Co.Phone + Web + Rating';
  return 'Other';
}

records = records.map(r => ({ ...r, tier: assignTier(r) }));

// Split sendable vs other
const sendable = records
  .filter(r => r.tier !== 'Other')
  .sort((a, b) => {
    const tierDiff = (TIER_SORT[a.tier] || 99) - (TIER_SORT[b.tier] || 99);
    if (tierDiff !== 0) return tierDiff;
    const scoreDiff = (b.lead_score || 0) - (a.lead_score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.google_reviews || 0) - (a.google_reviews || 0);
  });

const other = records
  .filter(r => r.tier === 'Other')
  .sort((a, b) => {
    const scoreDiff = (b.lead_score || 0) - (a.lead_score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.google_reviews || 0) - (a.google_reviews || 0);
  });

// ============================================================
// STEP 3: MAP TO OUTPUT COLUMNS
// ============================================================
const availableKeys = Object.keys(OUTPUT_COLUMNS).filter(k => {
  // Check if at least one record has this field
  return records.some(r => r[k] !== undefined);
});
const headers = availableKeys.map(k => OUTPUT_COLUMNS[k]);

function mapRow(r) {
  return availableKeys.map(k => {
    let v = r[k];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return v;
  });
}

// ============================================================
// STEP 4: BUILD XLSX WITH ExcelJS
// ============================================================
const workbook = new ExcelJS.Workbook();
workbook.creator = 'VerveLabs Pipeline';
workbook.created = new Date();

// Shared styles
const hdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
const hdrFont = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
const cellFont = { name: 'Arial', size: 10 };
const thinBorder = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } };

function writeLeadSheet(ws, rows) {
  // Header row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell, colNumber) => {
    cell.font = hdrFont;
    cell.fill = hdrFill;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  // Freeze panes
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto filter
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };

  // Data rows
  for (const r of rows) {
    const mapped = mapRow(r);
    const dataRow = ws.addRow(mapped);
    const tier = r.tier || 'Other';
    const fillColor = TIER_COLORS[tier] || 'FFFFFFFF';

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = cellFont;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.border = thinBorder;

      const colName = headers[colNumber - 1];
      if (colName === 'Rating' && cell.value !== '') {
        cell.numFmt = '0.0';
      }
      if (['Score', 'Owner?', 'Reviews'].includes(colName)) {
        cell.alignment = { horizontal: 'center' };
      }
      if (colName === 'Reviews' && cell.value !== '') {
        cell.numFmt = '#,##0';
      }
    });
  }

  // Column widths
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = COLUMN_WIDTHS[h] || 15;
  });
}

// --- Compute stats ---
const tierCounts = {};
for (const r of sendable) {
  tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
}

const metroGroups = [...new Set(sendable.map(r => r.metro_group).filter(Boolean))].sort();

function countNonEmpty(arr, key) {
  return arr.filter(r => {
    const v = r[key];
    return v !== null && v !== undefined && String(v).trim() !== '';
  }).length;
}

// ============================================================
// SHEET 1: SUMMARY
// ============================================================
const wsSummary = workbook.addWorksheet('Summary', {
  properties: { tabColor: { argb: 'FF4472C4' } }
});
wsSummary.getColumn(1).width = 55;
wsSummary.getColumn(2).width = 65;
for (let i = 3; i <= 6; i++) wsSummary.getColumn(i).width = 14;

let row = 1;

// Title
wsSummary.getCell(`A${row}`).value = 'VerveLabs - Sales Lead Report';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 18, color: { argb: 'FF2F5496' } };
row++;

wsSummary.getCell(`A${row}`).value = `Generated ${TODAY} | ${sendable.length} qualified leads across ${metroGroups.length} metros`;
wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 11, color: { argb: 'FF808080' } };
row++;

wsSummary.getCell(`A${row}`).value = `Filtered from ${totalRecords} total records. Only sendable leads in main tabs. "All Other Leads" tab has ${other.length} additional records.`;
wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FFA0A0A0' } };
row += 2;

// Tier Breakdown
wsSummary.getCell(`A${row}`).value = 'Tier Breakdown';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF2F5496' } };
row++;

const tierNames = ['1a - Name + Email + Phone', '1b - Name + Channel', '2a - Phone + Website', '2b - Co.Phone + Web + Rating'];
for (const tn of tierNames) {
  wsSummary.getCell(`A${row}`).value = `  ${tn}`;
  wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 11 };
  wsSummary.getCell(`B${row}`).value = tierCounts[tn] || 0;
  wsSummary.getCell(`B${row}`).font = { name: 'Arial', bold: true, size: 11 };
  row++;
}

wsSummary.getCell(`A${row}`).value = '  Total Sendable';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 11 };
wsSummary.getCell(`B${row}`).value = sendable.length;
wsSummary.getCell(`B${row}`).font = { name: 'Arial', bold: true, size: 11 };
row++;

wsSummary.getCell(`A${row}`).value = '  Other (not yet sendable)';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 11, color: { argb: 'FF999999' } };
wsSummary.getCell(`B${row}`).value = other.length;
wsSummary.getCell(`B${row}`).font = { name: 'Arial', size: 11, color: { argb: 'FF999999' } };
row += 2;

// Metro Breakdown
wsSummary.getCell(`A${row}`).value = 'Metro Breakdown';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF2F5496' } };
row++;

const metroHeaders = ['Metro', 'Total', 'Tier 1a', 'Tier 1b', 'Tier 2a', 'Tier 2b'];
metroHeaders.forEach((h, i) => {
  wsSummary.getCell(row, i + 1).value = h;
  wsSummary.getCell(row, i + 1).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF2F5496' } };
});
row++;

for (const mg of metroGroups) {
  const metroLeads = sendable.filter(r => r.metro_group === mg);
  const mtc = {};
  for (const r of metroLeads) mtc[r.tier] = (mtc[r.tier] || 0) + 1;

  wsSummary.getCell(row, 1).value = mg;
  wsSummary.getCell(row, 1).font = { name: 'Arial', size: 11 };
  wsSummary.getCell(row, 2).value = metroLeads.length;
  wsSummary.getCell(row, 2).font = { name: 'Arial', bold: true, size: 11 };
  wsSummary.getCell(row, 3).value = mtc['1a - Name + Email + Phone'] || 0;
  wsSummary.getCell(row, 4).value = mtc['1b - Name + Channel'] || 0;
  wsSummary.getCell(row, 5).value = mtc['2a - Phone + Website'] || 0;
  wsSummary.getCell(row, 6).value = mtc['2b - Co.Phone + Web + Rating'] || 0;
  row++;
}
row++;

// Quick Stats
wsSummary.getCell(`A${row}`).value = 'Quick Stats';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF2F5496' } };
row++;

const ownerCount = sendable.filter(r => r.owner === true || r.owner === 'true').length;
const ratingValues = sendable.map(r => r.google_rating).filter(v => v !== null && v !== undefined && v !== '');
const reviewValues = sendable.map(r => r.google_reviews).filter(v => v !== null && v !== undefined && v !== '');
const avgRating = ratingValues.length > 0 ? (ratingValues.reduce((a, b) => a + Number(b), 0) / ratingValues.length).toFixed(1) : 'N/A';
const avgReviews = reviewValues.length > 0 ? Math.round(reviewValues.reduce((a, b) => a + Number(b), 0) / reviewValues.length) : 'N/A';

const stats = [
  ['Total Qualified Leads', sendable.length],
  ['With Contact Name', countNonEmpty(sendable, 'contact_name')],
  ['Confirmed Owners', ownerCount],
  ['With Contact Email', countNonEmpty(sendable, 'contact_email')],
  ['With Contact Phone', countNonEmpty(sendable, 'contact_phone')],
  ['With Website', countNonEmpty(sendable, 'website')],
  ['With Booking Platform', countNonEmpty(sendable, 'booking_platform')],
  ['With Instagram', countNonEmpty(sendable, 'instagram_url')],
  ['With Facebook', countNonEmpty(sendable, 'facebook_url')],
  ['With LinkedIn', countNonEmpty(sendable, 'linkedin_url')],
  ['With Cultural Affinity', countNonEmpty(sendable, 'cultural_affinity')],
  ['Avg Google Rating', avgRating],
  ['Avg Google Reviews', avgReviews]
];

for (const [label, val] of stats) {
  wsSummary.getCell(`A${row}`).value = `  ${label}`;
  wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 11 };
  wsSummary.getCell(`B${row}`).value = val;
  wsSummary.getCell(`B${row}`).font = { name: 'Arial', bold: true, size: 11 };
  row++;
}
row++;

// Tier Guide
wsSummary.getCell(`A${row}`).value = 'Tier Guide';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF2F5496' } };
row++;

const guides = [
  ['1a - Name + Email + Phone', 'FF92D050', 'Best leads. Call by name, follow up by email.'],
  ['1b - Name + Channel', 'FFC6EFCE', 'Contact name + either email or phone. Call by name.'],
  ['2a - Phone + Website', 'FFFCE4D6', 'Direct contact phone + website but no name. Research the site, then call.'],
  ['2b - Co.Phone + Web + Rating', 'FFF2F2F2', 'Company phone + website + Google rating. Call and ask for the owner.']
];

for (const [tn, color, desc] of guides) {
  wsSummary.getCell(`A${row}`).value = `  ${tn}`;
  wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 10 };
  wsSummary.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  wsSummary.getCell(`B${row}`).value = desc;
  wsSummary.getCell(`B${row}`).font = { name: 'Arial', size: 10, color: { argb: 'FF666666' } };
  wsSummary.mergeCells(row, 2, row, 6);
  row++;
}
row++;

// Tier vs Score Explainer
wsSummary.getCell(`A${row}`).value = 'Understanding Tier vs. Score';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF2F5496' } };
row++;
wsSummary.getCell(`A${row}`).value = 'These measure different things. Tier = can we reach them? Score = do they need us?';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF444444' } };
wsSummary.mergeCells(row, 1, row, 6);
row += 2;

wsSummary.getCell(`A${row}`).value = 'TIER = "Can we reach them?"';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF2F5496' } };
wsSummary.mergeCells(row, 1, row, 6);
row++;
for (const line of [
  'Based on contact data quality: name, phone, email, website.',
  'Tier 1a (bright green) = name + email + phone. Tier 2b (gray) = company phone + website + rating.'
]) {
  wsSummary.getCell(`A${row}`).value = line;
  wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 10, color: { argb: 'FF808080' } };
  wsSummary.mergeCells(row, 1, row, 6);
  row++;
}
row++;

wsSummary.getCell(`A${row}`).value = 'SCORE = "How much do they need us?"';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF2F5496' } };
wsSummary.mergeCells(row, 1, row, 6);
row++;
for (const line of [
  'Solo practitioner (+20), on Groupon (+15), no website (+10), no booking (+10),',
  'runs paid ads (+5), under 20 reviews (+5). Higher = more signals they need help.'
]) {
  wsSummary.getCell(`A${row}`).value = line;
  wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 10, color: { argb: 'FF808080' } };
  wsSummary.mergeCells(row, 1, row, 6);
  row++;
}
row++;

wsSummary.getCell(`A${row}`).value = 'WHY HIGH SCORES CAN APPEAR IN LOWER TIERS';
wsSummary.getCell(`A${row}`).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFC00000' } };
wsSummary.mergeCells(row, 1, row, 6);
row++;
for (const line of [
  'Scoring rewards missing things (no website = +10). But those gaps also reduce reachability.',
  'Tier 1 leads are established businesses — easy to reach but fewer "needs help" signals.',
  '',
  'HOW TO USE: Work Tier 1a first, then 1b, then 2a/2b. Within each tier, prioritize by score.'
]) {
  wsSummary.getCell(`A${row}`).value = line;
  wsSummary.getCell(`A${row}`).font = { name: 'Arial', size: 10, color: { argb: 'FF808080' } };
  wsSummary.mergeCells(row, 1, row, 6);
  row++;
}

// ============================================================
// SHEET 2: ALL LEADS
// ============================================================
const wsAll = workbook.addWorksheet('All Leads', {
  properties: { tabColor: { argb: 'FF70AD47' } }
});
writeLeadSheet(wsAll, sendable);

// ============================================================
// SHEET 3: TIER 1 - PRIORITY
// ============================================================
const tier1 = sendable.filter(r => r.tier.startsWith('1'));
if (tier1.length > 0) {
  const wsT1 = workbook.addWorksheet('Tier 1 - Priority', {
    properties: { tabColor: { argb: 'FF92D050' } }
  });
  writeLeadSheet(wsT1, tier1);
}

// ============================================================
// SHEET 4: TIER 2a - DIRECT PHONE
// ============================================================
const tier2a = sendable.filter(r => r.tier === '2a - Phone + Website');
if (tier2a.length > 0) {
  const ws2a = workbook.addWorksheet('Tier 2a - Direct Phone', {
    properties: { tabColor: { argb: 'FFFCE4D6' } }
  });
  writeLeadSheet(ws2a, tier2a);
}

// ============================================================
// SHEET 5: TIER 2b - COLD CALL
// ============================================================
const tier2b = sendable.filter(r => r.tier === '2b - Co.Phone + Web + Rating');
if (tier2b.length > 0) {
  const ws2b = workbook.addWorksheet('Tier 2b - Cold Call', {
    properties: { tabColor: { argb: 'FFF2F2F2' } }
  });
  writeLeadSheet(ws2b, tier2b);
}

// ============================================================
// SHEET 6: ALL OTHER LEADS
// ============================================================
if (other.length > 0) {
  const wsOther = workbook.addWorksheet('All Other Leads', {
    properties: { tabColor: { argb: 'FFD9D9D9' } }
  });
  writeLeadSheet(wsOther, other);
}

// ============================================================
// SHEETS 7+: PER-METRO TABS
// ============================================================
for (const mg of metroGroups) {
  const metroData = sendable.filter(r => r.metro_group === mg);
  if (metroData.length > 0) {
    const shortName = mg.split(',')[0].replace(' Area', '').replace(' Metro', '').replace(/ /g, '');
    const wsMetro = workbook.addWorksheet(shortName, {
      properties: { tabColor: { argb: 'FF4472C4' } }
    });
    writeLeadSheet(wsMetro, metroData);
  }
}

// ============================================================
// STEP 5: GENERATE BUFFER & OUTPUT AS BINARY
// ============================================================

// Generate filename
const metroSlug = metro.replace(/, /g, '_').replace(/ /g, '_');
const filename = `VerveLabs_Sales_Leads_${metroSlug}_${TODAY}.xlsx`;

// Build summary for downstream nodes
const summary = {
  total_records: totalRecords,
  sendable: sendable.length,
  other: other.length,
  tier_1a: tierCounts['1a - Name + Email + Phone'] || 0,
  tier_1b: tierCounts['1b - Name + Channel'] || 0,
  tier_2a: tierCounts['2a - Phone + Website'] || 0,
  tier_2b: tierCounts['2b - Co.Phone + Web + Rating'] || 0,
  metros: metroGroups.length,
  filename
};

const arrayBuffer = await workbook.xlsx.writeBuffer();
const nodeBuffer = Buffer.from(arrayBuffer);
const base64Data = nodeBuffer.toString('base64');

console.log(`Generate Report: SUCCESS — ${sendable.length} sendable, ${other.length} other, ${metroGroups.length} metros, ${nodeBuffer.length} bytes`);

// Output binary xlsx as n8n binary attachment.
// Downstream HTTP Request node will upload this binary data correctly
// (avoids IPC serialization corruption with task runners).
return [{
  json: { run_id, metro, triggered_by, filename, base64: base64Data, summary },
  binary: {
    data: await this.helpers.prepareBinaryData(
      nodeBuffer,
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  }
}];
