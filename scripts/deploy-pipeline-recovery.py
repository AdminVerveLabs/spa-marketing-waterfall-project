#!/usr/bin/env python3
"""
Deploy updated Code node jsCode to the n8n sub-workflow.

Reads 3 .js source files, fetches the current sub-workflow via n8n REST API,
updates the jsCode in the 3 Code nodes, and PUTs the full workflow back.

Sub-workflow ID: fGm4IP0rWxgHptN8
Nodes updated:
  - "Enrich Companies"  <- enrich-companies.js
  - "Find Contacts"     <- find-contacts.js
  - "Enrich Contacts"   <- enrich-contacts.js
"""

import json
import os
import sys
import urllib.request
import urllib.error

# --- Configuration ---
WORKFLOW_ID = "fGm4IP0rWxgHptN8"
API_BASE = "http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/api/v1"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Node name -> source file mapping
NODE_SOURCE_MAP = {
    "Enrich Companies": os.path.join(SCRIPT_DIR, "nodes", "enrich-companies.js"),
    "Find Contacts":    os.path.join(SCRIPT_DIR, "nodes", "find-contacts.js"),
    "Enrich Contacts":  os.path.join(SCRIPT_DIR, "nodes", "enrich-contacts.js"),
}

def get_api_key():
    key = os.environ.get("N8N_API_KEY")
    if not key:
        print("ERROR: N8N_API_KEY environment variable is not set.")
        sys.exit(1)
    return key

def api_request(method, path, api_key, data=None):
    """Make an HTTP request to the n8n API."""
    url = f"{API_BASE}{path}"
    headers = {
        "Accept": "application/json",
        "X-N8N-API-KEY": api_key,
    }
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code} {method} {url}")
        print(f"Response: {error_body[:2000]}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}")
        sys.exit(1)

def read_js_file(filepath):
    """Read a .js file and return its contents as a string."""
    if not os.path.isfile(filepath):
        print(f"ERROR: Source file not found: {filepath}")
        sys.exit(1)
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def main():
    api_key = get_api_key()

    # 1. Read all .js source files
    print("=== Reading source files ===")
    js_sources = {}
    for node_name, filepath in NODE_SOURCE_MAP.items():
        js_sources[node_name] = read_js_file(filepath)
        line_count = js_sources[node_name].count("\n") + 1
        print(f"  {node_name}: {os.path.basename(filepath)} ({line_count} lines)")

    # 2. Fetch current workflow
    print(f"\n=== Fetching workflow {WORKFLOW_ID} ===")
    workflow = api_request("GET", f"/workflows/{WORKFLOW_ID}", api_key)
    print(f"  Name: {workflow.get('name', 'unknown')}")
    print(f"  Active: {workflow.get('active', 'unknown')}")
    print(f"  Nodes: {len(workflow.get('nodes', []))}")

    # 3. Update the 3 Code nodes
    print("\n=== Updating Code nodes ===")
    nodes = workflow.get("nodes", [])
    updated_count = 0

    for node in nodes:
        if node["name"] in NODE_SOURCE_MAP:
            old_code_len = len(node.get("parameters", {}).get("jsCode", ""))
            new_code = js_sources[node["name"]]

            # Set jsCode
            if "parameters" not in node:
                node["parameters"] = {}
            node["parameters"]["jsCode"] = new_code

            # Ensure mode is runOnceForAllItems
            node["parameters"]["mode"] = "runOnceForAllItems"

            new_code_len = len(new_code)
            print(f"  {node['name']}: updated ({old_code_len} -> {new_code_len} chars, mode=runOnceForAllItems)")
            updated_count += 1

    if updated_count != 3:
        found_names = [n["name"] for n in nodes]
        print(f"\nERROR: Expected to update 3 nodes, but only found {updated_count}.")
        print(f"  Nodes in workflow: {found_names}")
        sys.exit(1)

    # 4. PUT the updated workflow back
    print(f"\n=== Deploying updated workflow ===")
    # n8n PUT /workflows/{id} expects the full workflow object
    # Remove fields that shouldn't be in the PUT body
    put_payload = {
        "name": workflow["name"],
        "nodes": workflow["nodes"],
        "connections": workflow["connections"],
        "settings": workflow.get("settings", {}),
        "staticData": workflow.get("staticData"),
    }
    # Include pinData if present
    if "pinData" in workflow:
        put_payload["pinData"] = workflow["pinData"]

    result = api_request("PUT", f"/workflows/{WORKFLOW_ID}", api_key, data=put_payload)
    print(f"  Success! Workflow updated.")
    print(f"  Updated at: {result.get('updatedAt', 'unknown')}")
    print(f"  Active: {result.get('active', 'unknown')}")

    # 5. Reactivate if it was active (PUT can deactivate)
    if workflow.get("active") and not result.get("active"):
        print("\n=== Re-activating workflow ===")
        activate_result = api_request("POST", f"/workflows/{WORKFLOW_ID}/activate", api_key)
        print(f"  Active: {activate_result.get('active', 'unknown')}")

    # 6. Verify by re-fetching
    print(f"\n=== Verification ===")
    verify = api_request("GET", f"/workflows/{WORKFLOW_ID}", api_key)
    for node in verify.get("nodes", []):
        if node["name"] in NODE_SOURCE_MAP:
            actual_len = len(node.get("parameters", {}).get("jsCode", ""))
            expected_len = len(js_sources[node["name"]])
            mode = node.get("parameters", {}).get("mode", "unknown")
            match = "OK" if actual_len == expected_len else "MISMATCH"
            print(f"  {node['name']}: {actual_len} chars, mode={mode} [{match}]")

    print("\n=== Deploy complete ===")

if __name__ == "__main__":
    main()
