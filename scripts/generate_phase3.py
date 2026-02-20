#!/usr/bin/env python3
"""Generate Phase 3 Code Audit document.

Audits all 72 Code nodes for:
1. Data flow analysis (input mode, upstream refs, field access)
2. Logic correctness (null checks, edge cases, output schema)
3. Pattern violations (wrong return type for mode, missing null checks, hardcoded values)
4. Convergence cross-reference (downstream of convergence + .item.json = BUG)
"""

import json
import sys
import os
import re
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "extracted_data.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "docs", "investigation", "phase3-code-audit.md")

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

nodes = data['nodes']
cross_refs = data['cross_refs']
convergence_points = data['convergence_points']
duplicate_groups = data['duplicate_code_groups']

node_map = {n['name']: n for n in nodes}

# Step boundaries
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

# Build connection maps
incoming_map = defaultdict(list)
outgoing_map = defaultdict(list)
for n in nodes:
    for o in n.get('outgoing', []):
        label = 'TRUE' if (node_map.get(n['name'], {}).get('type') == 'if' and o['output_idx'] == 0) else \
                'FALSE' if (node_map.get(n['name'], {}).get('type') == 'if' and o['output_idx'] == 1) else 'main'
        outgoing_map[n['name']].append((o['target'], o['output_idx'], label))
        incoming_map[o['target']].append((n['name'], o['output_idx'], label))

# Build convergence set and downstream-of-convergence set
convergence_names = set(cp['target'] for cp in convergence_points)

# For each node, determine if it's downstream of a convergence point (within same step)
def is_downstream_of_convergence_in_step(node_name):
    """Check if node is at or downstream of a convergence point within its step."""
    n = node_map.get(node_name)
    if not n:
        return False, []
    step = get_step(n['position'][0])

    # BFS backwards from this node to find convergence ancestors in same step
    visited = set()
    queue = [node_name]
    conv_ancestors = []
    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        cn = node_map.get(current)
        if not cn:
            continue
        current_step = get_step(cn['position'][0])
        if current_step != step:
            continue  # Don't cross step boundaries

        if current in convergence_names and current != node_name:
            conv_ancestors.append(current)
        if current in convergence_names and current == node_name:
            conv_ancestors.append(current)

        for src, oidx, label in incoming_map.get(current, []):
            if src not in visited:
                queue.append(src)

    return len(conv_ancestors) > 0, conv_ancestors


def audit_code_node(n):
    """Perform full audit of a Code node. Returns dict of findings."""
    code = n.get('jsCode', '')
    mode = n.get('mode', '') or 'runOnceForAllItems'
    name = n['name']
    step = get_step(n['position'][0])
    refs = n.get('ref_methods', [])
    upstream_refs = n.get('upstream_refs', [])

    findings = {
        'name': name,
        'step': step,
        'mode': mode,
        'lines': n.get('code_lines', 0),
        'data_flow': {},
        'logic_issues': [],
        'pattern_violations': [],
        'convergence_risk': {},
        'severity': 'OK',
    }

    # === DATA FLOW ANALYSIS ===
    uses_input_item = '$input.item' in code
    uses_input_all = '$input.all()' in code or '$input.first()' in code
    uses_upstream_item = any('item' in r['method'] for r in refs)
    uses_upstream_all = any('all' in r['method'] for r in refs)
    uses_upstream_first = any('first' in r['method'] for r in refs)

    findings['data_flow'] = {
        'uses_input_item': uses_input_item,
        'uses_input_all': uses_input_all,
        'uses_upstream_item_json': uses_upstream_item,
        'uses_upstream_all': uses_upstream_all,
        'uses_upstream_first': uses_upstream_first,
        'upstream_refs': [{'node': r['node'], 'method': r['method']} for r in refs],
    }

    # === LOGIC CORRECTNESS ===

    # Check for null/undefined handling
    has_null_check = 'null' in code or 'undefined' in code or '?' in code or 'try' in code
    if not has_null_check and (uses_upstream_item or uses_upstream_all):
        findings['logic_issues'].append({
            'issue': 'No null/undefined checks on upstream data access',
            'severity': 'MEDIUM',
            'detail': f'Accesses upstream nodes but has no null/undefined guards'
        })

    # Check for empty array handling
    if uses_upstream_all and '.length' not in code and 'if (' not in code:
        findings['logic_issues'].append({
            'issue': 'No empty array check on .all() result',
            'severity': 'LOW',
            'detail': 'Uses .all() but doesn\'t check for empty results'
        })

    # Check for API response error handling
    if '$input.item.json' in code and ('error' not in code.lower() and 'status' not in code.lower()):
        # Only flag if this seems to be parsing API responses
        incoming_nodes = [s for s, oidx, l in incoming_map.get(name, [])]
        incoming_types = [node_map.get(s, {}).get('type', '') for s in incoming_nodes]
        if 'httpRequest' in incoming_types:
            findings['logic_issues'].append({
                'issue': 'No error handling for API response parsing',
                'severity': 'MEDIUM',
                'detail': 'Receives HTTP response but doesn\'t check for error status'
            })

    # === PATTERN VIOLATIONS ===

    # Check return type matches mode
    if mode == 'runOnceForEachItem':
        # Should return single object { json: {...} }
        if 'return items' in code or 'return [' in code:
            findings['pattern_violations'].append({
                'violation': 'runOnceForEachItem returning array',
                'severity': 'HIGH',
                'detail': 'Mode is runOnceForEachItem but code returns an array'
            })
    elif mode == 'runOnceForAllItems':
        # Should return array of { json: {...} }
        # Check if it returns a single object without wrapping
        if re.search(r'return\s*\{\s*json:', code) and 'return items' not in code and '.map(' not in code:
            # Might be returning single object
            if 'return [' not in code and 'return items' not in code:
                findings['pattern_violations'].append({
                    'violation': 'runOnceForAllItems possibly returning single object',
                    'severity': 'MEDIUM',
                    'detail': 'Mode is runOnceForAllItems but may return single {json:...} instead of array'
                })

    # Check for hardcoded values
    hardcoded_urls = re.findall(r'https?://[^\s\'"]+', code)
    for url in hardcoded_urls:
        if 'supabase' in url.lower() or 'api' in url.lower():
            findings['pattern_violations'].append({
                'violation': 'Hardcoded API URL',
                'severity': 'LOW',
                'detail': f'URL in code: {url[:60]}...'
            })

    # Check for hardcoded API keys
    if re.search(r'(api[_-]?key|token|secret|password)\s*[:=]\s*[\'"][^\'"]+[\'"]', code, re.I):
        findings['pattern_violations'].append({
            'violation': 'Possible hardcoded credential',
            'severity': 'HIGH',
            'detail': 'Code contains what looks like a hardcoded API key or secret'
        })

    # === CONVERGENCE CROSS-REFERENCE ===
    is_downstream, conv_ancestors = is_downstream_of_convergence_in_step(name)
    is_at_convergence = name in convergence_names

    findings['convergence_risk'] = {
        'is_at_convergence': is_at_convergence,
        'is_downstream_of_convergence': is_downstream,
        'convergence_ancestors': conv_ancestors,
    }

    # THE CRITICAL CHECK: .item.json pairing downstream of convergence
    if (is_downstream or is_at_convergence) and uses_upstream_item:
        item_refs = [r for r in refs if 'item' in r['method']]
        for ref in item_refs:
            findings['convergence_risk']['CRITICAL_BUG'] = True
            findings['pattern_violations'].append({
                'violation': f'BATCHING BUG: .item.json pairing downstream of convergence',
                'severity': 'CRITICAL',
                'detail': f'Uses $(\'{ref["node"]}\').{ref["method"]} but is downstream of convergence point(s): {", ".join(conv_ancestors)}. Items will pair incorrectly across batches.'
            })

    # .all() at convergence (duplication risk)
    if (is_downstream or is_at_convergence) and uses_upstream_all:
        all_refs = [r for r in refs if 'all' in r['method']]
        for ref in all_refs:
            findings['pattern_violations'].append({
                'violation': f'.all() at convergence point — duplication risk',
                'severity': 'HIGH',
                'detail': f'Uses $(\'{ref["node"]}\').{ref["method"]} at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.'
            })

    # Determine overall severity
    severities = []
    for pv in findings['pattern_violations']:
        severities.append(pv['severity'])
    for li in findings['logic_issues']:
        severities.append(li['severity'])

    if 'CRITICAL' in severities:
        findings['severity'] = 'CRITICAL'
    elif 'HIGH' in severities:
        findings['severity'] = 'HIGH'
    elif 'MEDIUM' in severities:
        findings['severity'] = 'MEDIUM'
    elif 'LOW' in severities:
        findings['severity'] = 'LOW'
    else:
        findings['severity'] = 'OK'

    return findings


# ============================================================
# AUDIT ALL CODE NODES
# ============================================================
code_nodes = [n for n in nodes if n['type'] == 'code']
audits = []

# Track duplicates — audit leader fully, mark others as duplicate
documented_as_duplicate = set()
for leader, names in duplicate_groups.items():
    for name in names[1:]:
        documented_as_duplicate.add(name)

for n in code_nodes:
    audit = audit_code_node(n)
    audit['is_duplicate'] = n['name'] in documented_as_duplicate
    if audit['is_duplicate']:
        for leader, names in duplicate_groups.items():
            if n['name'] in names:
                audit['duplicate_leader'] = leader
                break
    audits.append(audit)

# ============================================================
# BUILD DOCUMENT
# ============================================================
out = []
def w(line=""):
    out.append(line)

w("# Phase 3: Code Audit")
w()
w("**Workflow:** Step 4 (isolated) - with Layer 2 Verification")
w(f"**Code Nodes Audited:** {len(code_nodes)} (72 total, {len(code_nodes) - len(documented_as_duplicate)} unique)")
w(f"**Date:** 2026-02-17")
w(f"**Phase:** 3 of 7 (Investigation)")
w()

# ============================================================
# SUMMARY
# ============================================================
w("## 1. Audit Summary")
w()

severity_counts = defaultdict(int)
for a in audits:
    severity_counts[a['severity']] += 1

w("### Severity Distribution")
w()
w("| Severity | Count | Description |")
w("|----------|-------|-------------|")
w(f"| CRITICAL | {severity_counts.get('CRITICAL', 0)} | Batching bugs — `.item.json` pairing at convergence points |")
w(f"| HIGH | {severity_counts.get('HIGH', 0)} | `.all()` at convergence, possible wrong return types |")
w(f"| MEDIUM | {severity_counts.get('MEDIUM', 0)} | Missing null checks, possible wrong return types |")
w(f"| LOW | {severity_counts.get('LOW', 0)} | Missing empty checks, hardcoded values |")
w(f"| OK | {severity_counts.get('OK', 0)} | No issues found |")
w(f"| **TOTAL** | **{len(audits)}** | |")
w()

# Collect all critical/high bugs
critical_bugs = []
high_bugs = []
for a in audits:
    for pv in a['pattern_violations']:
        if pv['severity'] == 'CRITICAL':
            critical_bugs.append({'node': a['name'], 'step': a['step'], **pv})
        elif pv['severity'] == 'HIGH':
            high_bugs.append({'node': a['name'], 'step': a['step'], **pv})

w("### Critical Bugs (Batching)")
w()
if critical_bugs:
    w("| # | Node | Step | Bug | Detail |")
    w("|---|------|------|-----|--------|")
    for i, bug in enumerate(critical_bugs, 1):
        w(f"| {i} | {bug['node']} | {bug['step']} | {bug['violation']} | {bug['detail'][:100]} |")
else:
    w("(None found)")
w()

w("### High Severity Issues")
w()
if high_bugs:
    w("| # | Node | Step | Issue | Detail |")
    w("|---|------|------|-------|--------|")
    for i, bug in enumerate(high_bugs, 1):
        detail_short = bug['detail'][:120].replace('|', '/')
        w(f"| {i} | {bug['node']} | {bug['step']} | {bug['violation']} | {detail_short} |")
else:
    w("(None found)")
w()

# ============================================================
# PER-STEP AUDITS
# ============================================================
w("---")
w()
w("## 2. Detailed Audit by Step")
w()

for step_name, lo, hi in STEPS:
    step_audits = [a for a in audits if a['step'] == step_name]
    if not step_audits:
        continue

    w(f"### {step_name}")
    w()
    w(f"**{len(step_audits)} Code nodes**")
    w()

    for a in step_audits:
        severity_badge = {
            'CRITICAL': '🔴 CRITICAL',
            'HIGH': '🟠 HIGH',
            'MEDIUM': '🟡 MEDIUM',
            'LOW': '🔵 LOW',
            'OK': '✅ OK'
        }.get(a['severity'], a['severity'])

        if a['is_duplicate']:
            w(f"#### {a['name']} — {severity_badge}")
            w()
            w(f"> **DUPLICATE** of **{a['duplicate_leader']}** — see that node for full audit.")
            w(f"> Same convergence/severity analysis applies.")
            w()
            # Still show convergence info if relevant
            cr = a['convergence_risk']
            if cr.get('is_downstream_of_convergence') or cr.get('is_at_convergence'):
                w(f"- **Convergence:** Downstream of {', '.join(cr.get('convergence_ancestors', []))}")
            w()
            continue

        w(f"#### {a['name']} — {severity_badge}")
        w()
        w(f"- **Mode:** `{a['mode']}`")
        w(f"- **Lines:** {a['lines']}")
        w()

        # Data flow
        df = a['data_flow']
        w("**Data Flow:**")
        w()
        access_patterns = []
        if df['uses_input_item']:
            access_patterns.append('`$input.item.json` (per-item)')
        if df['uses_input_all']:
            access_patterns.append('`$input.all()` or `$input.first()` (batch)')
        if df['uses_upstream_item_json']:
            refs = [f"`$(\'{r['node']}\').{r['method']}`" for r in df['upstream_refs'] if 'item' in r['method']]
            access_patterns.append(f"Upstream `.item.json`: {', '.join(refs)}")
        if df['uses_upstream_all']:
            refs = [f"`$(\'{r['node']}\').{r['method']}`" for r in df['upstream_refs'] if 'all' in r['method']]
            access_patterns.append(f"Upstream `.all()`: {', '.join(refs)}")
        if df['uses_upstream_first']:
            refs = [f"`$(\'{r['node']}\').{r['method']}`" for r in df['upstream_refs'] if 'first' in r['method']]
            access_patterns.append(f"Upstream `.first()`: {', '.join(refs)}")

        if access_patterns:
            for p in access_patterns:
                w(f"- {p}")
        else:
            w("- No upstream references (self-contained)")
        w()

        # Convergence risk
        cr = a['convergence_risk']
        if cr.get('is_at_convergence') or cr.get('is_downstream_of_convergence'):
            w("**Convergence Risk:**")
            w()
            if cr.get('is_at_convergence'):
                w(f"- **AT convergence point** — receives multiple input batches")
            if cr.get('is_downstream_of_convergence'):
                w(f"- **Downstream of:** {', '.join(cr.get('convergence_ancestors', []))}")
            if cr.get('CRITICAL_BUG'):
                w(f"- **🔴 BATCHING BUG CONFIRMED** — `.item.json` pairing will break across batches")
            w()

        # Issues
        if a['pattern_violations'] or a['logic_issues']:
            w("**Issues Found:**")
            w()
            for pv in a['pattern_violations']:
                sev = pv['severity']
                w(f"- **[{sev}]** {pv['violation']}: {pv['detail']}")
            for li in a['logic_issues']:
                sev = li['severity']
                w(f"- **[{sev}]** {li['issue']}: {li['detail']}")
            w()
        else:
            w("**Issues:** None found")
            w()

# ============================================================
# SECTION 3: CONVERGENCE BUG DEEP ANALYSIS
# ============================================================
w("---")
w()
w("## 3. Convergence Bug Deep Analysis — Step 4")
w()
w("This section provides the detailed analysis of how the batching bug manifests in Step 4.")
w()

# Get Step 4 code nodes with convergence issues
step4_critical = [a for a in audits if a['step'] == 'Step 4: Enrich People' and a['severity'] in ('CRITICAL', 'HIGH')]

w("### 3.1 The Item Pairing Problem")
w()
w("When `$('NodeName').item.json` is used, n8n pairs the current item with the item at the")
w("**same index** in the referenced node's output. In a single-path flow, this works because")
w("item 0 in node A corresponds to item 0 in node B. But at convergence points:")
w()
w("- Items arrive in **separate batches** (one per upstream path)")
w("- Each batch has its own item indices starting from 0")
w("- `$('NodeName').item.json` references the item at the CURRENT batch's index in the REFERENCED node")
w("- If the referenced node was in a different batch, the pairing is **wrong or fails**")
w()

w("### 3.2 Affected Nodes in Step 4")
w()
w("The following nodes use `.item.json` pairing and are downstream of convergence:")
w()

for a in audits:
    if a['step'] != 'Step 4: Enrich People':
        continue
    cr = a['convergence_risk']
    if not cr.get('CRITICAL_BUG'):
        continue
    df = a['data_flow']
    item_refs = [r for r in df['upstream_refs'] if 'item' in r['method']]

    w(f"#### {a['name']}")
    w()
    refs_str = ', '.join('`$("' + r['node'] + '").' + r['method'] + '`' for r in item_refs)
    w(f"- **References:** {refs_str}")
    w(f"- **Convergence ancestors:** {', '.join(cr.get('convergence_ancestors', []))}")
    first_ref_node = item_refs[0]['node'] if item_refs else '?'
    w(f"- **What breaks:** The item from `{first_ref_node}` is paired by index, but the current")
    w(f"  item may be in a different batch than the referenced item. Items get paired with the wrong")
    w(f"  contact's data.")
    w()

w("### 3.3 The `.all()` Collector Problem")
w()
w("Step 4 uses `Collect *` nodes with `runOnceForAllItems` mode that try to gather items")
w("from multiple upstream paths using `.all()`. The issue:")
w()
w("```")
w("// This pattern appears in Collect Email Results, Collect Verified Results, etc.")
w("const items = [];")
w("try { items.push(...$('Path A').all()); } catch(e) {}")
w("try { items.push(...$('Path B').all()); } catch(e) {}")
w("try { items.push(...$('Path C').all()); } catch(e) {}")
w("")
w("// Problem: This node runs ONCE PER BATCH.")
w("// In batch 1: $('Path A').all() returns Path A's items")
w("//              $('Path B').all() returns Path B's items (from a PREVIOUS run)")
w("//              $('Path C').all() returns Path C's items (from a PREVIOUS run)")
w("// In batch 2: Same thing but items may be duplicated or stale")
w("```")
w()
w("The `try/catch` pattern prevents errors but also **hides the bug** — when a path hasn't")
w("run in the current batch, `.all()` either returns stale items from a previous batch or")
w("throws an error that's silently caught.")
w()

w("### 3.4 Collector Nodes Analysis")
w()

collectors = ['Collect Email Results', 'Collect Verified Results', 'Collect NamSor Results', 'Collect Updates']
for cname in collectors:
    cn = node_map.get(cname)
    if not cn:
        continue
    code = cn.get('jsCode', '')
    sources = incoming_map.get(cname, [])
    a = next((au for au in audits if au['name'] == cname), None)

    w(f"#### {cname}")
    w()
    w(f"- **Inputs:** {len(sources)} sources: {', '.join(f'{s} ({l})' for s, oidx, l in sources)}")
    w(f"- **Mode:** {cn.get('mode', '') or 'runOnceForAllItems'}")
    w(f"- **Uses deduplication:** {'yes (by id)' if 'seen' in code.lower() or 'Set()' in code else 'no'}")
    w(f"- **Uses try/catch:** {'yes' if 'try' in code else 'no'}")
    w()

    # Analyze the collection pattern
    all_refs = re.findall(r"\$\(['\"]([^'\"]+)['\"]\)\.all\(\)", code)
    if all_refs:
        w(f"- **Collects from:** {', '.join(f'`{r}`' for r in all_refs)}")
    w()

    if a:
        for pv in a.get('pattern_violations', []):
            w(f"- **[{pv['severity']}]** {pv['violation']}")
    w()

# ============================================================
# SECTION 4: NON-STEP-4 CONVERGENCE ANALYSIS
# ============================================================
w("---")
w()
w("## 4. Non-Step-4 Convergence Analysis")
w()
w("While Step 4 is the primary bug location, other steps also have convergence points.")
w("This section assesses whether those convergence points cause practical bugs.")
w()

for step_name in ['Step 1: Discovery', 'Step 2: Company Enrichment', 'Step 3b: Social Enrichment', 'Step 3a: Find People']:
    step_issues = [a for a in audits if a['step'] == step_name and a['severity'] in ('CRITICAL', 'HIGH')]
    if not step_issues:
        w(f"### {step_name}")
        w()
        w("No CRITICAL or HIGH issues found in Code nodes.")
        w()
        continue

    w(f"### {step_name}")
    w()
    for a in step_issues:
        w(f"- **{a['name']}** ({a['severity']})")
        for pv in a['pattern_violations']:
            if pv['severity'] in ('CRITICAL', 'HIGH'):
                w(f"  - {pv['violation']}: {pv['detail'][:120]}")
    w()

# ============================================================
# SECTION 5: PATTERN VIOLATION SUMMARY
# ============================================================
w("---")
w()
w("## 5. Pattern Violation Summary")
w()

all_violations = []
for a in audits:
    for pv in a['pattern_violations']:
        all_violations.append({**pv, 'node': a['name'], 'step': a['step']})
    for li in a['logic_issues']:
        all_violations.append({**li, 'node': a['name'], 'step': a['step'], 'violation': li['issue']})

# Group by violation type
violation_types = defaultdict(list)
for v in all_violations:
    violation_types[v['violation']].append(v)

for vtype, vlist in sorted(violation_types.items(), key=lambda x: -len(x[1])):
    w(f"### {vtype} ({len(vlist)} occurrences)")
    w()
    for v in vlist:
        w(f"- **{v['node']}** ({v['step']}): {v.get('detail', '')[:100]}")
    w()

# ============================================================
# SECTION 6: COMPLETENESS CHECK
# ============================================================
w("---")
w()
w("## 6. Completeness Verification")
w()
w(f"- **Total Code nodes in workflow:** 72")
w(f"- **Code nodes audited:** {len(audits)}")
w(f"- **Unique code blocks audited:** {len(audits) - len(documented_as_duplicate)}")
w(f"- **Duplicate code blocks (audited once):** {len(documented_as_duplicate)}")
w(f"- **All Code nodes covered:** {'YES' if len(audits) == 72 else 'NO - MISMATCH'}")
w()

# All node names audited
w("### Audited Nodes")
w()
for a in sorted(audits, key=lambda a: a['name']):
    sev = a['severity']
    dup = " (duplicate)" if a.get('is_duplicate') else ""
    w(f"- [{sev}] {a['name']}{dup}")
w()

# ============================================================
# WRITE OUTPUT
# ============================================================
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print(f"Phase 3 document written to {OUTPUT_PATH}")
print(f"Total lines: {len(out)}")
print(f"Nodes audited: {len(audits)}")
print(f"Critical bugs: {len(critical_bugs)}")
print(f"High bugs: {len(high_bugs)}")
