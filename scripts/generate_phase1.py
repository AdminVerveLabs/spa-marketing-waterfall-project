#!/usr/bin/env python3
"""Generate Phase 1 Node Inventory document from extracted_data.json."""

import json
import sys
import os
import textwrap

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "extracted_data.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "docs", "investigation", "phase1-node-inventory.md")

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

nodes = data['nodes']
type_counts = data['type_counts']
convergence_points = data['convergence_points']
cross_refs = data['cross_refs']
duplicate_groups = data['duplicate_code_groups']

# Step boundaries (by X position ranges)
STEPS = [
    ("Step 1: Discovery", -1200, 2513),
    ("Step 2: Company Enrichment", 2714, 10129),
    ("Step 3b: Social Enrichment", 10130, 12577),
    ("Step 3a: Find People", 12578, 16641),
    ("Step 4: Enrich People", 16642, 24000),
]

def get_step(x):
    for name, lo, hi in STEPS:
        if lo <= x <= hi:
            return name
    return "Unknown"

def nodes_in_step(step_name):
    for name, lo, hi in STEPS:
        if name == step_name:
            return [n for n in nodes if lo <= n['position'][0] <= hi]
    return []

# Identify bridge/config boundaries more precisely
def is_bridge(n):
    return n['name'].startswith('Bridge to')

def is_config(n):
    return n['name'].endswith('Config')

# Build output lines
out = []

def w(line=""):
    out.append(line)

def code_block(code, lang="javascript"):
    w(f"```{lang}")
    w(code)
    w("```")

# ============================================================
# HEADER
# ============================================================
w("# Phase 1: Node Inventory")
w()
w("**Workflow:** Step 4 (isolated) - with Layer 2 Verification")
w(f"**Total Nodes:** {data['total_nodes']}")
w(f"**Date:** 2026-02-17")
w(f"**Phase:** 1 of 7 (Investigation)")
w()

# ============================================================
# SUMMARY STATISTICS
# ============================================================
w("## 1. Summary Statistics")
w()
w("### Node Count by Type")
w()
w("| Type | Count |")
w("|------|-------|")
for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
    w(f"| {t} | {c} |")
w(f"| **TOTAL** | **{data['total_nodes']}** |")
w()

w("### Node Count by Step")
w()
w("| Step | Nodes |")
w("|------|-------|")
for step_name, lo, hi in STEPS:
    step_nodes = [n for n in nodes if lo <= n['position'][0] <= hi]
    w(f"| {step_name} | {len(step_nodes)} |")
w(f"| **TOTAL** | **{data['total_nodes']}** |")
w()

w("### Convergence Points (Multi-Input Nodes)")
w()
w(f"**{len(convergence_points)} nodes** receive input from 2+ upstream paths:")
w()
for cp in sorted(convergence_points, key=lambda c: c['target']):
    src_list = ", ".join(f"{s['source']} (out[{s['output_idx']}])" for s in cp['sources'])
    w(f"- **{cp['target']}** ({cp['target_type']}) ← {cp['count']} sources: {src_list}")
w()

w("### Duplicate Code Groups")
w()
for leader, names in duplicate_groups.items():
    w(f"- **{leader}** pattern: {len(names)} copies — {', '.join(names)}")
w()

# ============================================================
# MASTER NODE TABLES BY STEP
# ============================================================
w("---")
w()
w("## 2. Master Node Tables by Step")
w()

for step_name, lo, hi in STEPS:
    step_nodes = [n for n in nodes if lo <= n['position'][0] <= hi]
    w(f"### {step_name}")
    w()
    w(f"**{len(step_nodes)} nodes** | X range: [{lo}, {hi}]")
    w()
    w("| # | Node Name | Type | v | Mode | Position | onError | Notes |")
    w("|---|-----------|------|---|------|----------|---------|-------|")
    for i, n in enumerate(step_nodes, 1):
        mode = n.get('mode', '')
        if n['type'] == 'code' and not mode:
            mode = 'runOnceForAllItems'  # default for code nodes
        notes_short = n.get('notes', '')[:60].replace('|', '/').replace('\n', ' ')
        if len(n.get('notes', '')) > 60:
            notes_short += '...'
        onerr = n.get('onError', '')
        pos = f"[{n['position'][0]},{n['position'][1]}]"
        w(f"| {i} | {n['name']} | {n['type']} | {n['typeVersion']} | {mode} | {pos} | {onerr} | {notes_short} |")
    w()

# ============================================================
# SET NODES (5 total)
# ============================================================
w("---")
w()
w("## 3. Set Node Details (5 nodes)")
w()

set_nodes = [n for n in nodes if n['type'] == 'set']
for n in set_nodes:
    w(f"### {n['name']}")
    w()
    w(f"- **ID:** `{n['id']}`")
    w(f"- **Position:** [{n['position'][0]}, {n['position'][1]}]")
    w(f"- **Step:** {get_step(n['position'][0])}")
    if n.get('notes'):
        w(f"- **Notes:** {n['notes']}")
    w()
    assignments = n.get('set_assignments', [])
    if assignments:
        w("| # | Name | Value | Type |")
        w("|---|------|-------|------|")
        for i, a in enumerate(assignments, 1):
            val = str(a.get('value', '')).replace('|', '\\|').replace('\n', ' ')
            if len(val) > 80:
                val = val[:80] + '...'
            w(f"| {i} | `{a.get('name', '')}` | `{val}` | {a.get('type', '')} |")
    w()

# ============================================================
# IF NODES (32 total)
# ============================================================
w("---")
w()
w("## 4. IF Node Details (32 nodes)")
w()

if_nodes = [n for n in nodes if n['type'] == 'if']
for n in if_nodes:
    w(f"### {n['name']}")
    w()
    w(f"- **ID:** `{n['id']}`")
    w(f"- **Position:** [{n['position'][0]}, {n['position'][1]}]")
    w(f"- **Step:** {get_step(n['position'][0])}")
    if n.get('notes'):
        w(f"- **Notes:** {n['notes']}")
    w()

    # Parse conditions
    conditions = n.get('if_conditions', {})
    if_options = n.get('if_options', {})

    if conditions:
        w("**Conditions:**")
        w()
        w("```json")
        w(json.dumps(conditions, indent=2))
        w("```")
        w()

    if if_options:
        w(f"**Options:** `{json.dumps(if_options)}`")
        w()

    # Routing targets
    outgoing = n.get('outgoing', [])
    true_targets = [o['target'] for o in outgoing if o['output_idx'] == 0]
    false_targets = [o['target'] for o in outgoing if o['output_idx'] == 1]
    w(f"- **TRUE (output[0]) ->** {', '.join(true_targets) if true_targets else '(none)'}")
    w(f"- **FALSE (output[1]) ->** {', '.join(false_targets) if false_targets else '(none)'}")
    w()

# ============================================================
# HTTP REQUEST NODES (36 total)
# ============================================================
w("---")
w()
w("## 5. HTTP Request Node Details (36 nodes)")
w()

http_nodes = [n for n in nodes if n['type'] == 'httpRequest']
for n in http_nodes:
    w(f"### {n['name']}")
    w()
    w(f"- **ID:** `{n['id']}`")
    w(f"- **Position:** [{n['position'][0]}, {n['position'][1]}]")
    w(f"- **Step:** {get_step(n['position'][0])}")
    w(f"- **Method:** {n.get('http_method', 'GET')}")
    w(f"- **URL:** `{n.get('http_url', '')}`")
    if n.get('onError'):
        w(f"- **onError:** `{n['onError']}`")
    if n.get('notes'):
        w(f"- **Notes:** {n['notes']}")
    w()

    # Headers
    headers = n.get('http_headers', [])
    if headers:
        w("**Headers:**")
        w()
        w("| Name | Value |")
        w("|------|-------|")
        for h in headers:
            val = str(h.get('value', '')).replace('|', '\\|')
            if len(val) > 100:
                val = val[:100] + '...'
            w(f"| `{h.get('name', '')}` | `{val}` |")
        w()

    # Query params
    qparams = n.get('http_queryParams', [])
    if qparams:
        w("**Query Parameters:**")
        w()
        w("| Name | Value |")
        w("|------|-------|")
        for q in qparams:
            val = str(q.get('value', '')).replace('|', '\\|')
            w(f"| `{q.get('name', '')}` | `{val}` |")
        w()

    # Body
    body = n.get('http_jsonBody', '') or n.get('http_body', '')
    if body:
        w("**Body:**")
        w()
        w("```json")
        w(body)
        w("```")
        w()

    # Batching
    batching = n.get('http_batching')
    if batching:
        w(f"**Batching:** `{json.dumps(batching)}`")
        w()

    # Timeout
    timeout = n.get('http_timeout')
    if timeout:
        w(f"**Timeout:** {timeout}ms")
        w()

    # Options (other than batching/timeout)
    options = n.get('http_options', {})
    filtered_opts = {k: v for k, v in options.items() if k not in ('batching', 'timeout') and v}
    if filtered_opts:
        w(f"**Options:** `{json.dumps(filtered_opts)}`")
        w()

# ============================================================
# CODE NODES (72 total)
# ============================================================
w("---")
w()
w("## 6. Code Node Details (72 nodes)")
w()
w("### Duplicate Code Groups")
w()
w("The following code blocks are duplicated across multiple nodes. Each group is documented once,")
w("with all node names listed.")
w()
for leader, names in duplicate_groups.items():
    w(f"- **{leader} pattern:** {', '.join(names)}")
w()

# Track which nodes we've already documented via duplicate groups
documented_as_duplicate = set()
for leader, names in duplicate_groups.items():
    for name in names[1:]:  # Skip the leader — it gets full documentation
        documented_as_duplicate.add(name)

code_nodes = [n for n in nodes if n['type'] == 'code']
for n in code_nodes:
    is_dup = n['name'] in documented_as_duplicate
    dup_leader = None
    for leader, names in duplicate_groups.items():
        if n['name'] in names and n['name'] != leader:
            dup_leader = leader
            break

    w(f"### {n['name']}")
    w()
    w(f"- **ID:** `{n['id']}`")
    w(f"- **Position:** [{n['position'][0]}, {n['position'][1]}]")
    w(f"- **Step:** {get_step(n['position'][0])}")
    mode = n.get('mode', '') or 'runOnceForAllItems'
    w(f"- **Mode:** `{mode}`")
    w(f"- **Lines:** {n.get('code_lines', 0)}")
    if n.get('notes'):
        w(f"- **Notes:** {n['notes']}")
    w()

    if is_dup and dup_leader:
        w(f"> **DUPLICATE:** Identical code to **{dup_leader}** — see that node for full jsCode.")
        w()
        # Still list upstream refs
        refs = n.get('upstream_refs', [])
        if refs:
            w(f"**Upstream refs:** {', '.join(f'`$(\"{r}\")`' for r in refs)}")
            w()
        continue

    # Upstream references
    refs = n.get('upstream_refs', [])
    ref_methods = n.get('ref_methods', [])
    if refs:
        w("**Upstream References:**")
        w()
        w("| Referenced Node | Method |")
        w("|-----------------|--------|")
        seen = set()
        for rm in ref_methods:
            key = f"{rm['node']}|{rm['method']}"
            if key not in seen:
                seen.add(key)
                w(f"| `{rm['node']}` | `.{rm['method']}` |")
        # Also list any refs without methods
        method_nodes = {rm['node'] for rm in ref_methods}
        for r in refs:
            if r not in method_nodes:
                w(f"| `{r}` | (unknown) |")
        w()

    # Full jsCode
    code = n.get('jsCode', '')
    if code:
        # Note if this is the leader of a duplicate group
        if n['name'] in duplicate_groups:
            names = duplicate_groups[n['name']]
            w(f"> **Shared by {len(names)} nodes:** {', '.join(names)}")
            w()
        w("**jsCode:**")
        w()
        code_block(code)
        w()

    # Input/output field analysis
    # Analyze input fields (rough: look for $input, .json.field patterns)
    if code:
        import re
        input_fields = set()
        # $input.item.json.field or $input.first().json.field
        for m in re.findall(r'\$input\.[^;]+?\.json\.(\w+)', code):
            input_fields.add(m)
        # item.json.field or item.field (after const item = ...)
        for m in re.findall(r'(?:item|contact|company|result)\.(?:json\.)?(\w+)', code):
            if m not in ('json', 'map', 'filter', 'forEach', 'length', 'push', 'trim',
                         'toLowerCase', 'toUpperCase', 'replace', 'split', 'join',
                         'includes', 'startsWith', 'endsWith', 'match', 'test',
                         'toString', 'slice', 'substring', 'indexOf', 'concat'):
                input_fields.add(m)

        output_fields = set()
        # return { json: { field: ... } }
        for m in re.findall(r'(\w+)\s*:', code):
            if m not in ('json', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
                         'return', 'function', 'true', 'false', 'null', 'undefined',
                         'name', 'value', 'type', 'key', 'default', 'case', 'switch',
                         'try', 'catch', 'finally', 'throw', 'new', 'this', 'class',
                         'https', 'http'):
                output_fields.add(m)

        # This is rough — don't include if too noisy
        if len(input_fields) <= 30:
            w(f"**Input fields (detected):** {', '.join(sorted(input_fields)) if input_fields else '(none detected)'}")
        else:
            w(f"**Input fields (detected):** ({len(input_fields)} fields — see code above)")
        w()

# ============================================================
# MERGE NODES (2 total)
# ============================================================
w("---")
w()
w("## 7. Merge Node Details (2 nodes)")
w()

merge_nodes = [n for n in nodes if n['type'] == 'merge']
for n in merge_nodes:
    w(f"### {n['name']}")
    w()
    w(f"- **ID:** `{n['id']}`")
    w(f"- **Position:** [{n['position'][0]}, {n['position'][1]}]")
    w(f"- **Step:** {get_step(n['position'][0])}")
    w(f"- **Mode:** `{n.get('merge_mode', 'append')}`")
    w(f"- **typeVersion:** {n['typeVersion']}")
    if n.get('merge_options'):
        w(f"- **Options:** `{json.dumps(n['merge_options'])}`")
    w()
    inc = n.get('incoming', [])
    if inc:
        w("**Inputs:**")
        for i in inc:
            w(f"- input[{i.get('input_idx', 0)}] <- {i['source']} (output[{i['output_idx']}])")
    w()

# ============================================================
# WAIT NODES (3 total)
# ============================================================
w("---")
w()
w("## 8. Wait Node Details (3 nodes)")
w()

wait_nodes = [n for n in nodes if n['type'] == 'wait']
for n in wait_nodes:
    w(f"### {n['name']}")
    w()
    w(f"- **ID:** `{n['id']}`")
    w(f"- **Position:** [{n['position'][0]}, {n['position'][1]}]")
    w(f"- **Step:** {get_step(n['position'][0])}")
    w(f"- **Amount:** {n.get('wait_amount', '?')}")
    w(f"- **Unit:** {n.get('wait_unit', '?')}")
    w()

# ============================================================
# MANUAL TRIGGER (1 total)
# ============================================================
w("---")
w()
w("## 9. Manual Trigger (1 node)")
w()

trigger_nodes = [n for n in nodes if n['type'] == 'manualTrigger']
for n in trigger_nodes:
    w(f"### {n['name']}")
    w()
    w(f"- **ID:** `{n['id']}`")
    w(f"- **Position:** [{n['position'][0]}, {n['position'][1]}]")
    w(f"- **typeVersion:** {n['typeVersion']}")
    outg = n.get('outgoing', [])
    if outg:
        w(f"- **Connects to:** {', '.join(o['target'] for o in outg)}")
    w()

# ============================================================
# CROSS-REFERENCE TABLE
# ============================================================
w("---")
w()
w("## 10. Cross-Reference Table: `$('NodeName')` References")
w()
w("Every Code node that references another node via `$('NodeName')`, and which method it uses.")
w()
w("| Code Node | Referenced Node | Method | Step |")
w("|-----------|-----------------|--------|------|")
for cr in sorted(cross_refs, key=lambda x: x['code_node']):
    code_node_entry = next((n for n in nodes if n['name'] == cr['code_node']), None)
    step = get_step(code_node_entry['position'][0]) if code_node_entry else '?'
    w(f"| {cr['code_node']} | {cr['referenced_node']} | `.{cr['method']}` | {step} |")
w()

# Flag dangerous patterns
w("### Dangerous Patterns at Convergence Points")
w()
w("The following references use `.item.json` (per-item pairing) and may be downstream of convergence points.")
w("These are **potential batching bug locations** for Phase 2 analysis:")
w()
dangerous = [cr for cr in cross_refs if 'item' in cr['method'] and 'all' not in cr['method']]
if dangerous:
    for cr in dangerous:
        w(f"- **{cr['code_node']}** references `$(\"{cr['referenced_node']}\").{cr['method']}` — VERIFY in Phase 2")
else:
    w("(None found — all references use .all() or .first())")
w()

# ============================================================
# COMPLETENESS VERIFICATION
# ============================================================
w("---")
w()
w("## 11. Completeness Verification")
w()
w(f"- **Total nodes in JSON:** {data['total_nodes']}")
w(f"- **Total nodes documented:** {len(nodes)}")

# Count by section
set_count = len([n for n in nodes if n['type'] == 'set'])
if_count = len([n for n in nodes if n['type'] == 'if'])
http_count = len([n for n in nodes if n['type'] == 'httpRequest'])
code_count = len([n for n in nodes if n['type'] == 'code'])
merge_count = len([n for n in nodes if n['type'] == 'merge'])
wait_count = len([n for n in nodes if n['type'] == 'wait'])
trigger_count = len([n for n in nodes if n['type'] == 'manualTrigger'])
total_check = set_count + if_count + http_count + code_count + merge_count + wait_count + trigger_count

w(f"- **Sum by type:** {set_count} Set + {if_count} IF + {http_count} HTTP + {code_count} Code + {merge_count} Merge + {wait_count} Wait + {trigger_count} Trigger = **{total_check}**")
w(f"- **Match:** {'YES' if total_check == data['total_nodes'] else 'NO - MISMATCH!'}")
w()

# List all node names for verification
w("### All Node Names (alphabetical)")
w()
for name in sorted(n['name'] for n in nodes):
    w(f"- {name}")
w()

# ============================================================
# WRITE OUTPUT
# ============================================================
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print(f"Phase 1 document written to {OUTPUT_PATH}")
print(f"Total lines: {len(out)}")
print(f"Nodes documented: {len(nodes)}")
