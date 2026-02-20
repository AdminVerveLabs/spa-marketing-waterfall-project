#!/usr/bin/env python3
"""Extract all node data from n8n workflow JSON for Phase 1 Node Inventory.
Outputs structured JSON to scripts/extracted_data.json for document generation."""

import json
import sys
import os
import re

sys.stdout.reconfigure(encoding='utf-8')

WORKFLOW_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "workflows", "current", "Step 4 (isolated) - with Layer 2 Verification.json")
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extracted_data.json")

with open(WORKFLOW_PATH, 'r', encoding='utf-8') as f:
    wf = json.load(f)

nodes = wf.get('nodes', [])
connections = wf.get('connections', {})

# Build node lookup
node_lookup = {n['name']: n for n in nodes}

# Count by type
type_counts = {}
for n in nodes:
    t = n['type'].replace('n8n-nodes-base.', '')
    type_counts[t] = type_counts.get(t, 0) + 1

# Sort by X position
nodes_sorted = sorted(nodes, key=lambda n: (n.get('position', [0,0])[0], n.get('position', [0,0])[1]))

# Build connection maps
outgoing = {}  # node_name -> [(target, output_idx, input_idx)]
incoming = {}  # node_name -> [(source, output_idx, input_idx)]
for src_name, outputs in connections.items():
    for out_idx, out in enumerate(outputs.get('main', [])):
        if out:
            for conn in out:
                tgt = conn.get('node', '?')
                inp_idx = conn.get('index', 0)
                if src_name not in outgoing:
                    outgoing[src_name] = []
                outgoing[src_name].append({'target': tgt, 'output_idx': out_idx, 'input_idx': inp_idx})
                if tgt not in incoming:
                    incoming[tgt] = []
                incoming[tgt].append({'source': src_name, 'output_idx': out_idx, 'input_idx': inp_idx})

# Extract $('NodeName') references from code
def extract_upstream_refs(code):
    if not code:
        return []
    pattern = r"\$\(['\"]([^'\"]+)['\"]\)"
    return list(set(re.findall(pattern, code)))

def extract_ref_methods(code):
    """Find all $('NodeName').method patterns"""
    if not code:
        return []
    pattern = r"\$\(['\"]([^'\"]+)['\"]\)\.([\w.]+)"
    refs = re.findall(pattern, code)
    return [{'node': r[0], 'method': r[1]} for r in refs]

# Process each node
extracted = []
for n in nodes_sorted:
    short_type = n['type'].replace('n8n-nodes-base.', '')
    params = n.get('parameters', {})

    entry = {
        'name': n['name'],
        'id': n['id'],
        'type': short_type,
        'full_type': n['type'],
        'typeVersion': n.get('typeVersion', '?'),
        'position': n.get('position', [0, 0]),
        'notes': n.get('notes', ''),
        'onError': n.get('onError', ''),
        'mode': params.get('mode', ''),
        'incoming': incoming.get(n['name'], []),
        'outgoing': outgoing.get(n['name'], []),
    }

    # Type-specific extraction
    if short_type == 'code':
        code = params.get('jsCode', '')
        entry['jsCode'] = code
        entry['upstream_refs'] = extract_upstream_refs(code)
        entry['ref_methods'] = extract_ref_methods(code)
        entry['code_lines'] = len(code.split('\n')) if code else 0

    elif short_type == 'httpRequest':
        entry['http_method'] = params.get('method', 'GET')
        entry['http_url'] = params.get('url', '')
        entry['http_sendHeaders'] = params.get('sendHeaders', False)
        entry['http_headers'] = params.get('headerParameters', {}).get('parameters', [])
        entry['http_sendBody'] = params.get('sendBody', False)
        entry['http_bodyType'] = params.get('specifyBody', '')
        entry['http_jsonBody'] = params.get('jsonBody', '')
        entry['http_body'] = params.get('body', '')
        entry['http_options'] = params.get('options', {})
        # Check for batching
        batch = params.get('options', {}).get('batching', {})
        entry['http_batching'] = batch if batch else None
        entry['http_timeout'] = params.get('options', {}).get('timeout', None)
        # Check for sendQuery
        entry['http_sendQuery'] = params.get('sendQuery', False)
        entry['http_queryParams'] = params.get('queryParameters', {}).get('parameters', [])

    elif short_type == 'if':
        conditions = params.get('conditions', {})
        entry['if_conditions'] = conditions
        entry['if_options'] = params.get('options', {})

    elif short_type == 'set':
        assignments = params.get('assignments', {}).get('assignments', [])
        entry['set_assignments'] = assignments
        entry['set_options'] = params.get('options', {})

    elif short_type == 'merge':
        entry['merge_mode'] = params.get('mode', '')
        entry['merge_options'] = params.get('options', {})

    elif short_type == 'wait':
        entry['wait_amount'] = params.get('amount', '')
        entry['wait_unit'] = params.get('unit', '')

    elif short_type == 'manualTrigger':
        pass  # No special params

    extracted.append(entry)

# Build convergence points
convergence_points = []
for tgt_name, sources in incoming.items():
    if len(sources) > 1:
        convergence_points.append({
            'target': tgt_name,
            'target_type': node_lookup.get(tgt_name, {}).get('type', '').replace('n8n-nodes-base.', ''),
            'sources': sources,
            'count': len(sources)
        })

# Build cross-reference table (Code nodes referencing other nodes)
cross_refs = []
for entry in extracted:
    if entry['type'] == 'code' and entry.get('ref_methods'):
        for ref in entry['ref_methods']:
            cross_refs.append({
                'code_node': entry['name'],
                'referenced_node': ref['node'],
                'method': ref['method']
            })

# Identify duplicate code blocks
code_hashes = {}
for entry in extracted:
    if entry['type'] == 'code' and entry.get('jsCode'):
        code = entry['jsCode'].strip()
        if code not in code_hashes:
            code_hashes[code] = []
        code_hashes[code].append(entry['name'])

duplicates = {names[0]: names for code, names in code_hashes.items() if len(names) > 1}

output = {
    'workflow_name': wf.get('name', ''),
    'total_nodes': len(nodes),
    'type_counts': type_counts,
    'nodes': extracted,
    'convergence_points': convergence_points,
    'cross_refs': cross_refs,
    'duplicate_code_groups': duplicates,
    'connections_raw': connections,
}

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(extracted)} nodes to {OUTPUT_PATH}")
print(f"Type counts: {json.dumps(type_counts, indent=2)}")
print(f"Convergence points: {len(convergence_points)}")
print(f"Cross-references: {len(cross_refs)}")
print(f"Duplicate code groups: {len(duplicates)}")
for leader, names in duplicates.items():
    print(f"  {leader}: {names}")
