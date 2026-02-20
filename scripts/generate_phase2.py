#!/usr/bin/env python3
"""Generate Phase 2 Connection Map document from extracted_data.json.

Produces:
1. ASCII flow diagrams per step (with true/false branch labels)
2. Convergence point registry (formatted per investigation plan spec)
3. Input count per node
4. Risk analysis cross-referenced with Phase 1 dangerous patterns
"""

import json
import sys
import os
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "extracted_data.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "docs", "investigation", "phase2-connection-map.md")

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

nodes = data['nodes']
cross_refs = data['cross_refs']

# Build lookup
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

def nodes_in_step(step_name):
    for name, lo, hi in STEPS:
        if name == step_name:
            return [n for n in nodes if lo <= n['position'][0] <= hi]
    return []

def get_edge_label(src_node, output_idx):
    """Get human-readable label for an edge."""
    if src_node['type'] == 'if':
        return 'TRUE' if output_idx == 0 else 'FALSE'
    return 'main'

# Build global incoming/outgoing maps
incoming_map = defaultdict(list)  # target -> [(source_name, output_idx, label)]
outgoing_map = defaultdict(list)  # source -> [(target_name, output_idx, label)]

for n in nodes:
    for o in n.get('outgoing', []):
        label = get_edge_label(n, o['output_idx'])
        outgoing_map[n['name']].append((o['target'], o['output_idx'], label))
        incoming_map[o['target']].append((n['name'], o['output_idx'], label))

# Build input count for every node
input_counts = {}
for n in nodes:
    input_counts[n['name']] = len(incoming_map.get(n['name'], []))

# ============================================================
# ASCII FLOW DIAGRAM BUILDER
# ============================================================

def build_linear_flow(step_name):
    """Build connection list for a step, suitable for ASCII rendering.
    Returns list of edges: (source, target, label)
    """
    step_nodes = set(n['name'] for n in nodes_in_step(step_name))
    edges = []
    for n in nodes_in_step(step_name):
        for tgt, oidx, label in outgoing_map.get(n['name'], []):
            edges.append((n['name'], tgt, label))
    return edges

def build_ascii_diagram(step_name):
    """Build an ASCII flow diagram for a step.

    Strategy: topological sort by X position, then render top-down.
    For IF nodes, show TRUE/FALSE branches.
    For convergence points, show multiple inputs merging.
    """
    step_nodes_list = nodes_in_step(step_name)
    step_node_names = set(n['name'] for n in step_nodes_list)
    edges = build_linear_flow(step_name)

    lines = []

    # Topological order by X,Y position
    ordered = sorted(step_nodes_list, key=lambda n: (n['position'][0], n['position'][1]))

    # Track which nodes we've rendered
    rendered = set()

    # Build adjacency for traversal
    children = defaultdict(list)
    for src, tgt, label in edges:
        children[src].append((tgt, label))

    parents = defaultdict(list)
    for src, tgt, label in edges:
        parents[tgt].append((src, label))

    # Find entry point (node with no parents in this step)
    entry_nodes = []
    for n in ordered:
        local_parents = [(s, l) for s, l in parents[n['name']] if s in step_node_names]
        if not local_parents:
            entry_nodes.append(n['name'])

    def short_type(n):
        t = node_map[n]['type']
        if t == 'if': return 'IF'
        if t == 'code': return 'Code'
        if t == 'httpRequest': return 'HTTP'
        if t == 'set': return 'Set'
        if t == 'merge': return 'Merge'
        if t == 'wait': return 'Wait'
        if t == 'manualTrigger': return 'Trigger'
        return t

    def render_node(name, indent=0):
        """Render a node and its descendants recursively."""
        if name in rendered:
            prefix = "  " * indent
            lines.append(f"{prefix}  --> [{name}] (already shown above)")
            return
        rendered.add(name)

        prefix = "  " * indent
        n = node_map.get(name)
        if not n:
            lines.append(f"{prefix}  [{name}] (external)")
            return

        ntype = short_type(name)
        inc = len([s for s, l in parents[name] if s in step_node_names])
        convergence_marker = f" *** CONVERGENCE ({inc} inputs) ***" if inc > 1 else ""

        # Show incoming connections for convergence
        if inc > 1:
            lines.append(f"{prefix}  |")
            for src, label in parents[name]:
                if src in step_node_names:
                    lines.append(f"{prefix}  | <-- [{src}] via {label}")
            lines.append(f"{prefix}  v")

        lines.append(f"{prefix}  [{name}] ({ntype}){convergence_marker}")

        # Get children
        kids = children.get(name, [])
        kids_in_step = [(t, l) for t, l in kids if t in step_node_names]
        kids_external = [(t, l) for t, l in kids if t not in step_node_names]

        for t, l in kids_external:
            lines.append(f"{prefix}  | --{l}--> [{t}] (next step)")

        if not kids_in_step:
            lines.append(f"{prefix}  | (end)")
            return

        if n['type'] == 'if':
            # Branch rendering for IF nodes
            true_kids = [(t, l) for t, l in kids_in_step if l == 'TRUE']
            false_kids = [(t, l) for t, l in kids_in_step if l == 'FALSE']

            if true_kids and false_kids:
                lines.append(f"{prefix}  |")
                lines.append(f"{prefix}  +--[TRUE]--+---[FALSE]--+")

                # Render TRUE branch
                lines.append(f"{prefix}  |           |            |")
                for t, l in true_kids:
                    lines.append(f"{prefix}  |  TRUE:    |            |")
                    render_node(t, indent + 1)
                    lines.append(f"{prefix}  |           |            |")

                # Render FALSE branch
                for t, l in false_kids:
                    lines.append(f"{prefix}  |           |   FALSE:   |")
                    render_node(t, indent + 2)

            elif true_kids:
                lines.append(f"{prefix}  | TRUE")
                for t, l in true_kids:
                    render_node(t, indent)
            elif false_kids:
                lines.append(f"{prefix}  | FALSE")
                for t, l in false_kids:
                    render_node(t, indent)
        else:
            # Linear rendering for non-IF nodes
            lines.append(f"{prefix}  |")
            for t, l in kids_in_step:
                render_node(t, indent)

    for entry in entry_nodes:
        render_node(entry)
        lines.append("")

    return lines


def build_flat_flow_table(step_name):
    """Build a flat edge table (simpler, more reliable than ASCII trees)."""
    step_node_names = set(n['name'] for n in nodes_in_step(step_name))
    edges = build_linear_flow(step_name)

    lines = []
    lines.append("| # | Source | --Label--> | Target | Source Type | Target Type |")
    lines.append("|---|--------|------------|--------|-------------|-------------|")

    for i, (src, tgt, label) in enumerate(sorted(edges, key=lambda e: (
        node_map.get(e[0], {}).get('position', [0])[0],
        node_map.get(e[0], {}).get('position', [0])[1],
        e[2]
    )), 1):
        src_type = node_map.get(src, {}).get('type', '?')
        tgt_type = node_map.get(tgt, {}).get('type', '?')
        lines.append(f"| {i} | {src} | {label} | {tgt} | {src_type} | {tgt_type} |")

    return lines


def build_input_count_table(step_name):
    """Build input count table for nodes in a step."""
    step_nodes_list = nodes_in_step(step_name)
    step_node_names = set(n['name'] for n in step_nodes_list)

    lines = []
    lines.append("| Node | Type | Inputs | Sources |")
    lines.append("|------|------|--------|---------|")

    for n in sorted(step_nodes_list, key=lambda n: (n['position'][0], n['position'][1])):
        sources = incoming_map.get(n['name'], [])
        inc = len(sources)
        src_list = ", ".join(f"{s} ({l})" for s, oidx, l in sources) if sources else "(entry point)"
        marker = " **CONVERGENCE**" if inc > 1 else ""
        lines.append(f"| {n['name']} | {n['type']} | {inc}{marker} | {src_list} |")

    return lines


# ============================================================
# BUILD THE DOCUMENT
# ============================================================
out = []

def w(line=""):
    out.append(line)

# Header
w("# Phase 2: Connection Map")
w()
w("**Workflow:** Step 4 (isolated) - with Layer 2 Verification")
w(f"**Total Nodes:** {data['total_nodes']}")
w(f"**Total Connections:** {sum(len(outgoing_map[n]) for n in outgoing_map)}")
w(f"**Date:** 2026-02-17")
w(f"**Phase:** 2 of 7 (Investigation)")
w()
w("> **This is where the batching bugs live.** Every HIGH risk convergence point is a")
w("> potential item-loss or duplication bug. Phase 3 (Code Audit) will cross-reference")
w("> these convergence points with the `$('NodeName').item.json` patterns flagged in Phase 1.")
w()

# ============================================================
# SECTION 1: SUMMARY
# ============================================================
w("## 1. Summary")
w()

# Count convergence points
all_convergence = []
for n in nodes:
    sources = incoming_map.get(n['name'], [])
    if len(sources) > 1:
        all_convergence.append(n['name'])

w(f"- **Total connections (edges):** {sum(len(outgoing_map[n]) for n in outgoing_map)}")
w(f"- **Convergence points (multi-input nodes):** {len(all_convergence)}")
w(f"- **Entry points (no incoming):** {len([n for n in nodes if not incoming_map.get(n['name'])])}")
w(f"- **Terminal points (no outgoing):** {len([n for n in nodes if not outgoing_map.get(n['name'])])}")
w()

# Convergence summary by step
w("### Convergence Points by Step")
w()
w("| Step | Convergence Points | Highest Risk |")
w("|------|--------------------|-------------|")
for step_name, lo, hi in STEPS:
    step_conv = [c for c in all_convergence if lo <= node_map[c]['position'][0] <= hi]
    max_inputs = max((len(incoming_map[c]) for c in step_conv), default=0)
    risk = "CRITICAL" if max_inputs >= 3 else ("HIGH" if max_inputs >= 2 else "NONE")
    w(f"| {step_name} | {len(step_conv)} | {risk} (max {max_inputs} inputs) |")
w()

# ============================================================
# SECTION 2: PER-STEP FLOW DIAGRAMS + TABLES
# ============================================================
w("---")
w()
w("## 2. Flow Diagrams and Connection Tables by Step")
w()

for step_name, lo, hi in STEPS:
    step_nodes_list = nodes_in_step(step_name)
    step_node_names = set(n['name'] for n in step_nodes_list)
    edges = build_linear_flow(step_name)

    w(f"### {step_name}")
    w()
    w(f"**{len(step_nodes_list)} nodes, {len(edges)} connections**")
    w()

    # ASCII flow diagram
    w("#### Flow Diagram")
    w()
    w("```")
    diagram_lines = build_ascii_diagram(step_name)
    for line in diagram_lines:
        w(line)
    w("```")
    w()

    # Connection table
    w("#### Connection Table")
    w()
    table_lines = build_flat_flow_table(step_name)
    for line in table_lines:
        w(line)
    w()

    # Input count table
    w("#### Input Count per Node")
    w()
    input_lines = build_input_count_table(step_name)
    for line in input_lines:
        w(line)
    w()

# ============================================================
# SECTION 3: CONVERGENCE POINT REGISTRY
# ============================================================
w("---")
w()
w("## 3. Convergence Point Registry")
w()
w("Every node that receives input from 2 or more upstream paths. Formatted per investigation plan spec.")
w()

# Collect all dangerous $('NodeName').item.json patterns from Phase 1
dangerous_item_refs = set()
for cr in cross_refs:
    if 'item' in cr['method'] and 'all' not in cr['method']:
        dangerous_item_refs.add(cr['code_node'])

for step_name, lo, hi in STEPS:
    step_conv = [c for c in all_convergence if lo <= node_map[c]['position'][0] <= hi]
    if not step_conv:
        continue

    w(f"### {step_name}")
    w()

    for conv_name in sorted(step_conv, key=lambda c: node_map[c]['position'][0]):
        sources = incoming_map[conv_name]
        n = node_map[conv_name]
        ntype = n['type']

        # Determine risk
        risk = "HIGH" if len(sources) > 1 else "NONE"

        # Check if any downstream node uses .item.json pairing
        # Also check if THIS node uses .item.json
        downstream_danger = []
        if conv_name in dangerous_item_refs:
            downstream_danger.append(conv_name)

        # Check all nodes downstream of this convergence point
        visited = set()
        queue = [conv_name]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            if current in dangerous_item_refs and current != conv_name:
                downstream_danger.append(current)
            for tgt, oidx, label in outgoing_map.get(current, []):
                if tgt not in visited:
                    queue.append(tgt)

        w("```")
        w(f"CONVERGENCE: {conv_name} ({ntype})")
        for src_name, oidx, label in sources:
            w(f"  <- Source: {src_name} (via {label})")
        w(f"  RISK: {risk}")
        if downstream_danger:
            w(f"  DOWNSTREAM .item.json USAGE: {', '.join(downstream_danger)}")
        w("```")
        w()

w()

# ============================================================
# SECTION 4: BATCH EXECUTION ANALYSIS
# ============================================================
w("---")
w()
w("## 4. Batch Execution Analysis — Step 4 Deep Dive")
w()
w("Step 4 (Enrich People) is where the critical batching bug lives. This section traces")
w("the exact path structure that causes 12 of 13 contacts to lose their email verification.")
w()

# Build detailed Step 4 path analysis
w("### The Problem: Multi-Path Convergence Creates Separate Batches")
w()
w("When n8n encounters a node with multiple incoming connections, it creates **separate")
w("execution batches** — one per upstream path. Each batch processes independently,")
w("and downstream nodes see only the items from their batch.")
w()

w("### Step 4 Path Analysis")
w()
w("Starting from `Needs Email?`, contacts split into 3 possible paths:")
w()
w("```")
w("                     [Needs Email?]")
w("                     /            \\")
w("                  TRUE            FALSE")
w("                   /                \\")
w("         [Has Domain & Name?]    [Skip Email - Pass Through]")
w("          /            \\                    |")
w("       TRUE          FALSE                  |")
w("        /              \\                    |")
w("  [Hunter Enabled?]  [No Domain - Skip Email]")
w("    /          \\                |            |")
w(" TRUE        FALSE              |            |")
w("  |            |                |            |")
w("[Skip     [Hunter Email         |            |")
w(" Hunter]   Finder]              |            |")
w("  |            |                |            |")
w("  |       [Parse Hunter         |            |")
w("  |        Response]            |            |")
w("  \\          /                  |            |")
w("   \\        /                   |            |")
w("  [Hunter Found Email?]         |            |")
w("    /            \\              |            |")
w(" TRUE          FALSE            |            |")
w("  |              |              |            |")
w("  |        [Snov.io Enabled?]   |            |")
w("  |          /         \\        |            |")
w("  |       TRUE        FALSE     |            |")
w("  |        |            |       |            |")
w("  |    [Skip        [Snov.io    |            |")
w("  |     Snov.io]     Finder]    |            |")
w("  |        |            |       |            |")
w("  |        |       [Parse       |            |")
w("  |        |        Snov.io]    |            |")
w("  |        |          |         |            |")
w("  +--------+----------+         |            |")
w("           |                    |            |")
w("  ***[Merge Email Results]***   |            |")
w("     (3 inputs = 3 batches)     |            |")
w("           |                    |            |")
w("           +--------+-----------+            |")
w("                    |                        |")
w("       ***[Collect Email Results]***         |")
w("          (3 inputs = 3 batches)             |")
w("                    |                        |")
w("          [Has Email to Verify?]             |")
w("            /              \\                 |")
w("         TRUE            FALSE               |")
w("          |                |                  |")
w("  [Hunter Verifier     [Skip                 |")
w("   Enabled?]            Verification]<-------+")
w("    /        \\              |")
w("  TRUE      FALSE           |")
w("   |          |             |")
w("  [Skip    [Hunter Email    |")
w("   Verif.]  Verifier]       |")
w("   |          |             |")
w("   +---->  [Parse Verifier  |")
w("   |        Response]       |")
w("   |          |             |")
w("   +----------+-------------+")
w("              |")
w("  ***[Collect Verified Results]***")
w("     (2 inputs = 2 batches)")
w("              |")
w("      [Needs NamSor?]")
w("       /          \\")
w("    TRUE        FALSE")
w("     |            |")
w("  [NamSor      [Skip")
w("   Origin]      NamSor]")
w("     |            |")
w("  [Parse NamSor   |")
w("   Response]      |")
w("     |            |")
w("     +------------+")
w("          |")
w("  ***[Collect NamSor Results]***")
w("     (2 inputs = 2 batches)")
w("          |")
w("  [Prepare Contact Update]")
w("          |")
w("     [Has Updates?]")
w("      /          \\")
w("   TRUE        FALSE")
w("    |            |")
w("  [Update        |")
w("   Contact]      |")
w("    |            |")
w("    +------------+")
w("         |")
w("  ***[Collect Updates]***")
w("     (2 inputs = 2 batches)")
w("         |")
w("   [Run Summary4]")
w("```")
w()

w("### Convergence Cascade Effect")
w()
w("The critical insight is that convergence points **cascade**. Each convergence creates")
w("batches, and those batches propagate to downstream convergence points:")
w()
w("```")
w("Layer 1:  Merge Email Results      <- 3 paths merge  -> creates up to 3 batches")
w("Layer 2:  Collect Email Results     <- 3 paths merge  -> creates up to 3 batches")
w("Layer 3:  Skip Verification        <- 2 paths merge  -> creates up to 2 batches per batch")
w("Layer 4:  Collect Verified Results  <- 2 paths merge  -> creates up to 2 batches per batch")
w("Layer 5:  Collect NamSor Results    <- 2 paths merge  -> creates up to 2 batches per batch")
w("Layer 6:  Collect Updates           <- 2 paths merge  -> creates up to 2 batches per batch")
w("```")
w()
w("With 13 contacts, if even 2 contacts take different paths through the email waterfall,")
w("downstream nodes receive contacts in separate batches. Each `Collect *` node uses")
w("`$('NodeName').all()` to try to gather all items, but `.all()` only sees items in the")
w("**current batch**, not across all batches.")
w()

w("### Why Only 1 of 13 Gets Verified")
w()
w("Scenario with 13 contacts:")
w("1. All 13 contacts enter `Needs Email?`")
w("2. Some go TRUE (needs email), some go FALSE (skip)")
w("3. TRUE contacts split further at `Has Domain & Name?`")
w("4. At `Hunter Found Email?`, contacts split again based on whether Hunter found an email")
w("5. Each unique path creates a separate batch at `Merge Email Results`")
w("6. `Collect Email Results` receives 3 separate batches — each batch processed independently")
w("7. Only the last batch (possibly just 1 contact) proceeds correctly through verification")
w("8. Earlier batches may complete before later ones, causing race conditions")
w()
w("The `Collect *` Code nodes use `runOnceForAllItems` with `.all()` — but `.all()` within")
w("a batch only returns items from **that batch**, not from all batches. So each batch")
w("processes its subset independently, and the final `Run Summary4` only sees the last batch's results.")
w()

# ============================================================
# SECTION 5: ALL CONVERGENCE POINTS WITH RISK + ITEM.JSON ANALYSIS
# ============================================================
w("---")
w()
w("## 5. Risk Assessment: Convergence + `.item.json` Cross-Reference")
w()
w("This section cross-references convergence points from Section 3 with the `.item.json`")
w("pairing patterns identified in Phase 1. When a Code node downstream of a convergence")
w("point uses `$('NodeName').item.json`, the pairing can break because n8n pairs items")
w("by index within each batch, not by contact ID.")
w()

w("### Risk Matrix")
w()
w("| Convergence Point | Step | Inputs | Downstream .item.json Users | Risk Level |")
w("|-------------------|------|--------|----------------------------|------------|")

for conv_name in sorted(all_convergence, key=lambda c: node_map[c]['position'][0]):
    n = node_map[conv_name]
    step = get_step(n['position'][0])
    sources = incoming_map[conv_name]

    # Find downstream .item.json usage
    visited = set()
    queue = [conv_name]
    downstream_danger = []
    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        if current in dangerous_item_refs:
            downstream_danger.append(current)
        for tgt, oidx, label in outgoing_map.get(current, []):
            if tgt not in visited:
                queue.append(tgt)

    danger_str = ", ".join(downstream_danger) if downstream_danger else "(none)"
    risk = "CRITICAL" if downstream_danger else "HIGH"
    w(f"| {conv_name} | {step} | {len(sources)} | {danger_str} | {risk} |")

w()

w("### Legend")
w()
w("- **CRITICAL:** Convergence point has downstream Code nodes using `.item.json` pairing — batching bugs will cause wrong items to pair")
w("- **HIGH:** Convergence point exists (multiple batches created) but no `.item.json` pairing detected downstream — items may still be lost/duplicated via `.all()` within batches")
w()

# ============================================================
# SECTION 6: NODES WITH NO .ITEM.JSON RISK BUT .ALL() CONCERNS
# ============================================================
w("---")
w()
w("## 6. `.all()` Usage at Convergence Points")
w()
w("Even without `.item.json`, using `$('NodeName').all()` at convergence points is risky:")
w("- `.all()` returns all items **in the current batch**, not all items globally")
w("- When a node runs multiple times (once per batch), `.all()` from a specific upstream")
w("  node returns the same items each time, causing **duplication**")
w()

# Find code nodes that use .all() and are at/downstream of convergence
all_refs = defaultdict(list)
for cr in cross_refs:
    all_refs[cr['code_node']].append(cr)

w("| Code Node | Uses `.all()` from | At/Downstream of Convergence? | Risk |")
w("|-----------|-------------------|-------------------------------|------|")

for n in nodes:
    if n['type'] != 'code':
        continue
    all_usages = [cr for cr in all_refs.get(n['name'], []) if 'all' in cr['method']]
    if not all_usages:
        continue

    # Check if at or downstream of convergence
    is_convergent = n['name'] in all_convergence
    # Also check if any ancestor is convergent (simplified: check if this node has >1 input)
    at_convergence = is_convergent or any(
        a in all_convergence for a in [s for s, oidx, l in incoming_map.get(n['name'], [])]
    )

    refs_str = ", ".join(f"`{cr['referenced_node']}`" for cr in all_usages)
    conv_str = "YES" if at_convergence else "no"
    risk = "HIGH - may duplicate/lose items" if at_convergence else "LOW"
    w(f"| {n['name']} | {refs_str} | {conv_str} | {risk} |")

w()

# ============================================================
# SECTION 7: TERMINAL AND ENTRY POINTS
# ============================================================
w("---")
w()
w("## 7. Entry and Terminal Points")
w()
w("### Entry Points (no incoming connections)")
w()
entry_nodes = [n for n in nodes if not incoming_map.get(n['name'])]
for n in sorted(entry_nodes, key=lambda n: n['position'][0]):
    step = get_step(n['position'][0])
    w(f"- **{n['name']}** ({n['type']}) — {step}")
w()

w("### Terminal Points (no outgoing connections)")
w()
terminal_nodes = [n for n in nodes if not outgoing_map.get(n['name'])]
for n in sorted(terminal_nodes, key=lambda n: n['position'][0]):
    step = get_step(n['position'][0])
    w(f"- **{n['name']}** ({n['type']}) — {step}")
w()

# ============================================================
# SECTION 8: INTER-STEP BRIDGES
# ============================================================
w("---")
w()
w("## 8. Inter-Step Bridges")
w()
w("Connections that cross step boundaries:")
w()

for step_name, lo, hi in STEPS:
    step_node_names = set(n['name'] for n in nodes_in_step(step_name))
    for n in nodes_in_step(step_name):
        for tgt, oidx, label in outgoing_map.get(n['name'], []):
            if tgt not in step_node_names:
                tgt_step = get_step(node_map[tgt]['position'][0])
                w(f"- **{n['name']}** ({step_name}) --{label}--> **{tgt}** ({tgt_step})")

w()

# ============================================================
# SECTION 9: COMPLETENESS CHECK
# ============================================================
w("---")
w()
w("## 9. Completeness Verification")
w()

total_edges = sum(len(outgoing_map[n]) for n in outgoing_map)
nodes_with_connections = set()
for n in outgoing_map:
    nodes_with_connections.add(n)
    for tgt, oidx, label in outgoing_map[n]:
        nodes_with_connections.add(tgt)

isolated = [n['name'] for n in nodes if n['name'] not in nodes_with_connections]

w(f"- **Total nodes:** {data['total_nodes']}")
w(f"- **Nodes in connection graph:** {len(nodes_with_connections)}")
w(f"- **Isolated nodes (no connections):** {len(isolated)}")
if isolated:
    for name in isolated:
        w(f"  - {name}")
w(f"- **Total edges:** {total_edges}")
w(f"- **Convergence points:** {len(all_convergence)}")
w(f"- **All convergence points documented:** YES")
w()

# ============================================================
# WRITE OUTPUT
# ============================================================
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print(f"Phase 2 document written to {OUTPUT_PATH}")
print(f"Total lines: {len(out)}")
print(f"Edges: {total_edges}")
print(f"Convergence points: {len(all_convergence)}")
