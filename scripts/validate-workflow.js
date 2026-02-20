#!/usr/bin/env node
/**
 * Validates n8n workflow JSON structure.
 * Usage: node scripts/validate-workflow.js workflows/generated/spa-waterfall-fixed.json
 */

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-workflow.js <workflow.json>');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
let wf;
try {
  wf = JSON.parse(raw);
} catch (e) {
  console.error('❌ Invalid JSON:', e.message);
  process.exit(1);
}

const errors = [];
const warnings = [];

// 1. Required top-level fields
for (const field of ['name', 'nodes', 'connections']) {
  if (!wf[field]) errors.push(`Missing required field: ${field}`);
}

if (errors.length > 0) {
  errors.forEach(e => console.error('❌', e));
  process.exit(1);
}

const nodes = wf.nodes;
const connections = wf.connections;

// 2. Node validation
const nodeNames = new Set();
const nodeIds = new Set();

for (const node of nodes) {
  // Required fields
  if (!node.id) errors.push(`Node missing id: ${JSON.stringify(node).slice(0, 100)}`);
  if (!node.name) errors.push(`Node missing name: ${node.id}`);
  if (!node.type) errors.push(`Node "${node.name}" missing type`);
  if (!node.position || !Array.isArray(node.position)) {
    warnings.push(`Node "${node.name}" missing position`);
  }

  // Duplicate names
  if (nodeNames.has(node.name)) {
    errors.push(`Duplicate node name: "${node.name}"`);
  }
  nodeNames.add(node.name);

  // Duplicate IDs
  if (nodeIds.has(node.id)) {
    errors.push(`Duplicate node id: ${node.id}`);
  }
  nodeIds.add(node.id);

  // Code node checks
  if (node.type === 'n8n-nodes-base.code') {
    const code = node.parameters?.jsCode;
    if (!code) {
      warnings.push(`Code node "${node.name}" has no jsCode`);
    } else {
      // Check for common mistakes
      if (code.includes('response.body') && !code.includes('response.data')) {
        warnings.push(`Code node "${node.name}" uses response.body — should it be response.data?`);
      }
    }
  }

  // HTTP node checks
  if (node.type === 'n8n-nodes-base.httpRequest') {
    if (node.onError !== 'continueRegularOutput') {
      warnings.push(`HTTP node "${node.name}" missing onError: continueRegularOutput`);
    }
  }

  // IF node checks
  if (node.type === 'n8n-nodes-base.if') {
    const opts = node.parameters?.conditions?.options;
    if (opts && opts.typeValidation !== 'loose') {
      warnings.push(`IF node "${node.name}" should use typeValidation: loose`);
    }
  }
}

// 3. Connection validation
for (const [sourceName, conn] of Object.entries(connections)) {
  if (!nodeNames.has(sourceName)) {
    errors.push(`Connection from non-existent node: "${sourceName}"`);
  }
  
  if (conn.main) {
    for (const branch of conn.main) {
      if (!Array.isArray(branch)) continue;
      for (const target of branch) {
        if (!nodeNames.has(target.node)) {
          errors.push(`Connection to non-existent node: "${sourceName}" → "${target.node}"`);
        }
      }
    }
  }
}

// 4. Orphan detection
const connectedNodes = new Set();
for (const [sourceName, conn] of Object.entries(connections)) {
  connectedNodes.add(sourceName);
  if (conn.main) {
    for (const branch of conn.main) {
      if (!Array.isArray(branch)) continue;
      for (const target of branch) {
        connectedNodes.add(target.node);
      }
    }
  }
}

for (const node of nodes) {
  if (!connectedNodes.has(node.name)) {
    warnings.push(`Orphan node (no connections): "${node.name}"`);
  }
}

// 5. Convergence point detection
const incomingCount = {};
for (const [sourceName, conn] of Object.entries(connections)) {
  if (conn.main) {
    for (const branch of conn.main) {
      if (!Array.isArray(branch)) continue;
      for (const target of branch) {
        incomingCount[target.node] = (incomingCount[target.node] || 0) + 1;
      }
    }
  }
}

for (const [nodeName, count] of Object.entries(incomingCount)) {
  if (count > 1) {
    warnings.push(`⚠️  CONVERGENCE POINT: "${nodeName}" has ${count} incoming connections — potential batching issue`);
  }
}

// Report
console.log(`\nValidation: ${file}`);
console.log(`Nodes: ${nodes.length}`);
console.log(`Connections: ${Object.keys(connections).length}`);
console.log(`Convergence points: ${Object.values(incomingCount).filter(c => c > 1).length}`);
console.log('');

if (errors.length > 0) {
  console.log(`❌ ${errors.length} ERROR(S):`);
  errors.forEach(e => console.log(`   ${e}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  ${warnings.length} WARNING(S):`);
  warnings.forEach(w => console.log(`   ${w}`));
}

if (errors.length === 0) {
  console.log('\n✅ Workflow structure is valid');
} else {
  process.exit(1);
}
