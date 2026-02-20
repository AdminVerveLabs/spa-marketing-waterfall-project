// prepare-fixes.js — Extract and modify jsCode for 3 code nodes
const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, '..', 'workflows', 'current', 'deployed-fixed.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const outDir = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// === 1. Enrich Contacts: phone validation fix ===
const enrichNode = wf.nodes.find(n => n.name === 'Enrich Contacts');
let enrichCode = enrichNode.parameters.jsCode;

const oldPhoneLine = "else if (cleaned.length > 11) { return '+' + cleaned; }";
if (!enrichCode.includes(oldPhoneLine)) {
  console.error('ERROR: Could not find validatePhone pattern in Enrich Contacts');
  process.exit(1);
}

const newPhoneLines = [
  "else if (cleaned.length > 11 && cleaned.length <= 15) {",
  "    // International number — allow if not starting with 1 (NA)",
  "    if (cleaned.startsWith('1')) return null;  // NA number too long",
  "    return '+' + cleaned;",
  "  }",
  "  else if (cleaned.length > 15) { return null; }  // ITU max is 15 digits"
].join('\n');

enrichCode = enrichCode.replace(oldPhoneLine, newPhoneLines);
fs.writeFileSync(path.join(outDir, 'enrich-contacts-fixed.js'), enrichCode);
console.log(`1. Enrich Contacts: phone fix applied (${enrichCode.length} chars)`);

// Verify
if (enrichCode.includes('cleaned.length <= 15') && enrichCode.includes('ITU max')) {
  console.log('   Verification: fix patterns found');
} else {
  console.error('   ERROR: fix patterns NOT found');
  process.exit(1);
}

// === 2. Normalize Google Results: add business type blocklist ===
const googleNode = wf.nodes.find(n => n.name === 'Normalize Google Results');
let googleCode = googleNode.parameters.jsCode;

const businessBlocklistDecl = [
  '',
  '// Business type blocklist — filter non-target businesses before Supabase insert',
  "const BUSINESS_TYPE_BLOCKLIST = ['school','college','university','association','federation','union','board of','institute','academy','program'];",
  ''
].join('\n');

const blockedDomainsLine = "const BLOCKED_DOMAINS = ['wixsite.com','wix.com','setmore.com','schedulista.com','glossgenius.com','square.site','genbook.com','jane.app','acuityscheduling.com','mindbodyonline.com','mindbody.io','vagaro.com','fresha.com','schedulicity.com','booksy.com','massagebook.com','noterro.com','clinicsense.com','calendly.com','squarespace.com'];";

// Add business type blocklist after BLOCKED_DOMAINS
googleCode = googleCode.replace(blockedDomainsLine, blockedDomainsLine + businessBlocklistDecl);

// Add filter at start of .map() body
const googleMapStart = "return allPlaces.map(place => {\n  let city = '', state = '', country = '';";
const googleMapReplacement = [
  'return allPlaces.map(place => {',
  '  // Business type filter — skip non-target businesses',
  "  const _bizName = (place.displayName && place.displayName.text) || '';",
  "  const _bizCategory = (place.primaryTypeDisplayName && place.primaryTypeDisplayName.text) || place.primaryType || '';",
  '  const _bizNameLower = _bizName.toLowerCase();',
  '  const _bizCatLower = _bizCategory.toLowerCase();',
  '  if (BUSINESS_TYPE_BLOCKLIST.some(kw => _bizNameLower.includes(kw) || _bizCatLower.includes(kw))) return null;',
  '',
  "  let city = '', state = '', country = '';"
].join('\n');

if (!googleCode.includes(googleMapStart)) {
  console.error('ERROR: Could not find map start pattern in Normalize Google Results');
  console.error('Looking for:', JSON.stringify(googleMapStart));
  // Debug: show what the code actually has around that area
  const mapIdx = googleCode.indexOf('return allPlaces.map');
  if (mapIdx >= 0) {
    console.error('Found at:', mapIdx, 'Context:', JSON.stringify(googleCode.substring(mapIdx, mapIdx + 100)));
  }
  process.exit(1);
}

googleCode = googleCode.replace(googleMapStart, googleMapReplacement);

// Add .filter(Boolean) at the very end - the code ends with });
// The last line should be });
const lastSemicolon = googleCode.lastIndexOf('});');
if (lastSemicolon >= 0) {
  googleCode = googleCode.substring(0, lastSemicolon) + '}).filter(Boolean);';
} else {
  console.error('ERROR: Could not find closing }); in Normalize Google Results');
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, 'normalize-google-fixed.js'), googleCode);
console.log(`2. Normalize Google: business type blocklist applied (${googleCode.length} chars)`);

// === 3. Normalize Yelp Results: add business type blocklist ===
const yelpNode = wf.nodes.find(n => n.name === 'Normalize Yelp Results');
let yelpCode = yelpNode.parameters.jsCode;

// Add business type blocklist after BLOCKED_DOMAINS
yelpCode = yelpCode.replace(blockedDomainsLine, blockedDomainsLine + businessBlocklistDecl);

// Add filter after 'if (!biz.name) continue;'
const yelpContinueLine = '  if (!biz.name) continue;';
const yelpContinueReplacement = [
  '  if (!biz.name) continue;',
  '',
  '  // Business type filter — skip non-target businesses',
  '  const _bizNameLower = biz.name.toLowerCase();',
  "  const _bizCatLower = ((biz.categories || []).join(', ')).toLowerCase();",
  '  if (BUSINESS_TYPE_BLOCKLIST.some(kw => _bizNameLower.includes(kw) || _bizCatLower.includes(kw))) continue;'
].join('\n');

if (!yelpCode.includes(yelpContinueLine)) {
  console.error('ERROR: Could not find continue pattern in Normalize Yelp Results');
  process.exit(1);
}

yelpCode = yelpCode.replace(yelpContinueLine, yelpContinueReplacement);

fs.writeFileSync(path.join(outDir, 'normalize-yelp-fixed.js'), yelpCode);
console.log(`3. Normalize Yelp: business type blocklist applied (${yelpCode.length} chars)`);

console.log(`\nAll 3 files written to ${outDir}`);
