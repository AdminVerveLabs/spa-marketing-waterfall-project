const fs = require('fs');
const path = require('path');

const B = 'C:/Users/zackm/OneDrive/Documents/GitHub/spa-marketing_waterfall_project';
const W = path.join(B, 'workflows', 'current', 'deployed-fixed.json');
const T = path.join(B, 'tmp');

console.log('=== Update Snapshot Script ===\n');

// 1. Read the workflow JSON
console.log('Reading deployed-fixed.json...');
const wf = JSON.parse(fs.readFileSync(W, 'utf8'));
console.log('  Found ' + wf.nodes.length + ' nodes\n');

// 2. Read and apply the three fixed JS files
const replacements = {
  'Enrich Contacts': 'enrich-contacts-fixed.js',
  'Normalize Google Results': 'normalize-google-fixed.js',
  'Normalize Yelp Results': 'normalize-yelp-fixed.js',
};

for (const [nodeName, fileName] of Object.entries(replacements)) {
  const node = wf.nodes.find(n => n.name === nodeName);
  if (!node) {
    console.error('ERROR: Node "' + nodeName + '" not found!');
    process.exit(1);
  }
  const newCode = fs.readFileSync(path.join(T, fileName), 'utf8');
  const oldLen = node.parameters.jsCode.length;
  node.parameters.jsCode = newCode;
  console.log('Updated "' + nodeName + '": ' + oldLen + ' -> ' + newCode.length + ' chars');
}

// 3. Verify/fix Metro Config
const mc = wf.nodes.find(n => n.name === 'Metro Config');
if (!mc) { console.error('ERROR: Metro Config not found!'); process.exit(1); }

const assignments = mc.parameters.assignments.assignments;
const expected = {
  metro_name: 'Austin, TX',
  latitude: '30.2672',
  longitude: '-97.7431',
  yelp_location: 'Austin, TX',
};

console.log('\nVerifying Metro Config:');
for (const [field, val] of Object.entries(expected)) {
  const a = assignments.find(i => i.name === field);
  if (!a) { console.error('  MISSING: ' + field); continue; }
  if (a.value !== val) {
    console.log('  FIXING: ' + field + ' "' + a.value + '" -> "' + val + '"');
    a.value = val;
  } else {
    console.log('  OK: ' + field + ' = "' + val + '"');
  }
}

// 4. Write back
console.log('\nWriting updated workflow...');
const output = JSON.stringify(wf, null, 2);
fs.writeFileSync(W, output, 'utf8');
console.log('  Written ' + output.length + ' chars to deployed-fixed.json');
console.log('\nDone!');
