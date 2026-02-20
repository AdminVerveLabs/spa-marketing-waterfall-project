#!/usr/bin/env python3
"""
Build Simplified Workflow — Parallelized Batch Enrichment Architecture (ADR-029).

Main workflow: Discovery → Batch Dispatcher → Lead Scoring (22 nodes)
Sub-workflow: Webhook → Respond → Enrich Companies → Find Contacts → Enrich Contacts → Mark Fully Enriched (6 nodes)

The main workflow discovers companies and dispatches batches of 25 to the sub-workflow.
Each sub-workflow execution enriches its batch independently and marks companies as fully_enriched.
The main workflow polls for completion then runs lead scoring.

Output: workflows/generated/simplified-workflow.json (main workflow)
        workflows/generated/sub-workflow.json (batch enrichment sub-workflow)
"""

import json
import os
import sys
from datetime import datetime

# Paths
BASE_DIR = r'C:\Users\zackm\OneDrive\Documents\GitHub\spa-marketing_waterfall_project'
WORKFLOW_BACKUP = os.path.join(BASE_DIR, 'workflows', 'backups', 'pre-simplification-2026-02-20.json')
OUTPUT_FILE = os.path.join(BASE_DIR, 'workflows', 'generated', 'simplified-workflow.json')
SUB_WORKFLOW_FILE = os.path.join(BASE_DIR, 'workflows', 'generated', 'sub-workflow.json')
BACKUP_FILE = os.path.join(BASE_DIR, 'workflows', 'backups', f'pre-batch-architecture-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json')

# Read jsCode from external files
def read_js(filename):
    path = os.path.join(BASE_DIR, 'scripts', 'nodes', filename)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

# ═══════════════════════════════════════════════════════════════════
# NODES TO KEEP IN MAIN WORKFLOW (by name)
# ═══════════════════════════════════════════════════════════════════

KEEP_NODES = {
    # Step 1: Discovery (19 nodes — removed Collapse to Single2 and Run Summary)
    'Webhook',
    'Metro Config',
    'Split Search Queries',
    'Google Places - Text Search',
    'Normalize Google Results',
    'Start Apify Run',
    'Extract Run ID',
    'Wait 30s',
    'Check Run Status',
    'Parse Status',
    'Run Succeeded?',
    'Fetch Apify Results',
    'Normalize Yelp Results',
    'Merge All Sources',
    'Deduplicate Records',
    'Prepare for Supabase',
    'Fuzzy Match?',
    'Insert to Supabase',
    'Insert Flagged (Needs Review)',
    # Step 5: Lead Scoring (2 nodes)
    'Calculate Lead Scores',
    'Run Summary5',
}

# ═══════════════════════════════════════════════════════════════════
# MAIN BUILD LOGIC
# ═══════════════════════════════════════════════════════════════════

def build_main_workflow():
    """Build the main workflow with Batch Dispatcher replacing Collapse + enrichment chain."""
    print("=== Building Main Workflow ===")

    # 1. Read the deployed workflow
    print(f"Reading deployed workflow from backup...")
    with open(WORKFLOW_BACKUP, 'r', encoding='utf-8') as f:
        workflow_data = json.load(f)

    all_nodes = workflow_data['nodes']
    all_connections = workflow_data['connections']
    print(f"  Current workflow: {len(all_nodes)} nodes")

    # 2. Save backup
    print(f"Saving backup to {BACKUP_FILE}...")
    os.makedirs(os.path.dirname(BACKUP_FILE), exist_ok=True)
    with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
        json.dump(workflow_data, f, indent=2)
    print(f"  Backup saved ({os.path.getsize(BACKUP_FILE)} bytes)")

    # 3. Build node lookup
    node_by_name = {n['name']: n for n in all_nodes}

    # 4. Filter nodes to keep
    kept_nodes = []
    for name in KEEP_NODES:
        if name in node_by_name:
            kept_nodes.append(node_by_name[name])
        else:
            print(f"  WARNING: Node '{name}' not found in workflow!")

    print(f"  Kept {len(kept_nodes)} discovery/scoring nodes")

    # 5. Modify Metro Config — clear _batch_dispatcher_fired flag
    metro_js = read_js('metro-config.js')
    for n in kept_nodes:
        if n['name'] == 'Metro Config':
            n['parameters']['jsCode'] = metro_js
            break

    # 6. Add Batch Dispatcher node (replaces Collapse to Single2 + Run Summary + enrichment chain)
    batch_dispatcher_node = {
        'id': 'a2-batch-dispatcher-0001',
        'name': 'Batch Dispatcher',
        'type': 'n8n-nodes-base.code',
        'typeVersion': 2,
        'position': [-7600, 192],  # After Insert to Supabase / Insert Flagged
        'parameters': {
            'jsCode': read_js('batch-dispatcher.js'),
            'mode': 'runOnceForAllItems'
        }
    }
    kept_nodes.append(batch_dispatcher_node)

    # 7. Reposition Calculate Lead Scores and Run Summary5
    for n in kept_nodes:
        if n['name'] == 'Calculate Lead Scores':
            n['position'] = [-7100, 192]
        elif n['name'] == 'Run Summary5':
            n['position'] = [-6600, 192]

    print(f"  Total nodes in main workflow: {len(kept_nodes)}")

    # 8. Build connections
    kept_names = {n['name'] for n in kept_nodes}
    connections = {}

    # Copy existing connections that are between kept nodes
    for src_name, conn_data in all_connections.items():
        if src_name not in kept_names:
            continue
        new_conn = {}
        for conn_type, outputs in conn_data.items():
            new_outputs = []
            for output_index_conns in outputs:
                filtered = [c for c in output_index_conns if c['node'] in kept_names]
                new_outputs.append(filtered)
            new_conn[conn_type] = new_outputs
        if any(any(output) for output in new_conn.get('main', [])):
            connections[src_name] = new_conn

    # Override: Insert to Supabase → Batch Dispatcher (was → Collapse to Single2)
    connections['Insert to Supabase'] = {
        'main': [[{'node': 'Batch Dispatcher', 'type': 'main', 'index': 0}]]
    }

    # Override: Insert Flagged → Batch Dispatcher (was → Collapse to Single2)
    connections['Insert Flagged (Needs Review)'] = {
        'main': [[{'node': 'Batch Dispatcher', 'type': 'main', 'index': 0}]]
    }

    # Batch Dispatcher → Calculate Lead Scores → Run Summary5
    connections['Batch Dispatcher'] = {
        'main': [[{'node': 'Calculate Lead Scores', 'type': 'main', 'index': 0}]]
    }
    connections['Calculate Lead Scores'] = {
        'main': [[{'node': 'Run Summary5', 'type': 'main', 'index': 0}]]
    }

    # 9. Verify all connection targets exist
    for src, conn_data in connections.items():
        for outputs in conn_data.get('main', []):
            for conn in outputs:
                if conn['node'] not in kept_names:
                    print(f"  ERROR: Connection from '{src}' to '{conn['node']}' — target not in workflow!")

    # 10. Save output
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    output = {
        'name': 'Spa Marketing Waterfall — Parallelized Pipeline',
        'nodes': kept_nodes,
        'connections': connections,
        'settings': workflow_data.get('settings', {}),
    }
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)

    print(f"\nMain workflow saved to {OUTPUT_FILE}")
    print(f"  Nodes: {len(kept_nodes)}")
    print(f"  Connections: {sum(1 for c in connections.values() for outs in c.get('main', []) for _ in outs)}")
    print(f"  File size: {os.path.getsize(OUTPUT_FILE)} bytes")

    return output


def build_sub_workflow():
    """Build the batch enrichment sub-workflow."""
    print("\n=== Building Sub-Workflow ===")

    nodes = [
        {
            'id': 'sw-webhook-0001',
            'name': 'Webhook',
            'type': 'n8n-nodes-base.webhook',
            'typeVersion': 2,
            'position': [0, 192],
            'webhookId': 'batch-enrichment-v1',
            'parameters': {
                'httpMethod': 'POST',
                'path': 'batch-enrichment-v1',
                'responseMode': 'responseNode',
                'options': {}
            }
        },
        {
            'id': 'sw-respond-0001',
            'name': 'Respond to Webhook',
            'type': 'n8n-nodes-base.respondToWebhook',
            'typeVersion': 1.1,
            'position': [500, 192],
            'parameters': {
                'respondWith': 'json',
                'responseBody': '={{ JSON.stringify({ status: "accepted", company_count: $json.body.company_ids.length }) }}',
                'options': {}
            }
        },
        {
            'id': 'sw-enrich-companies-0001',
            'name': 'Enrich Companies',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [1000, 192],
            'parameters': {
                'jsCode': read_js('enrich-companies.js'),
                'mode': 'runOnceForAllItems'
            }
        },
        {
            'id': 'sw-find-contacts-0001',
            'name': 'Find Contacts',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [1500, 192],
            'parameters': {
                'jsCode': read_js('find-contacts.js'),
                'mode': 'runOnceForAllItems'
            }
        },
        {
            'id': 'sw-enrich-contacts-0001',
            'name': 'Enrich Contacts',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [2000, 192],
            'parameters': {
                'jsCode': read_js('enrich-contacts.js'),
                'mode': 'runOnceForAllItems'
            }
        },
        {
            'id': 'sw-mark-enriched-0001',
            'name': 'Mark Fully Enriched',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [2500, 192],
            'parameters': {
                'jsCode': read_js('mark-fully-enriched.js'),
                'mode': 'runOnceForAllItems'
            }
        },
    ]

    connections = {
        'Webhook': {
            'main': [[{'node': 'Respond to Webhook', 'type': 'main', 'index': 0}]]
        },
        'Respond to Webhook': {
            'main': [[{'node': 'Enrich Companies', 'type': 'main', 'index': 0}]]
        },
        'Enrich Companies': {
            'main': [[{'node': 'Find Contacts', 'type': 'main', 'index': 0}]]
        },
        'Find Contacts': {
            'main': [[{'node': 'Enrich Contacts', 'type': 'main', 'index': 0}]]
        },
        'Enrich Contacts': {
            'main': [[{'node': 'Mark Fully Enriched', 'type': 'main', 'index': 0}]]
        },
    }

    output = {
        'name': 'Batch Enrichment — Sub-Workflow',
        'nodes': nodes,
        'connections': connections,
        'settings': {
            'executionOrder': 'v1'
        },
    }

    os.makedirs(os.path.dirname(SUB_WORKFLOW_FILE), exist_ok=True)
    with open(SUB_WORKFLOW_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)

    print(f"Sub-workflow saved to {SUB_WORKFLOW_FILE}")
    print(f"  Nodes: {len(nodes)}")
    print(f"  File size: {os.path.getsize(SUB_WORKFLOW_FILE)} bytes")

    return output


if __name__ == '__main__':
    main_wf = build_main_workflow()
    sub_wf = build_sub_workflow()
    print("\nDone. Deploy both workflows via n8n MCP or REST API.")
