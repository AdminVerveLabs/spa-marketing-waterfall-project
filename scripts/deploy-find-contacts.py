#!/usr/bin/env python3
"""
Deploy updated Find Contacts jsCode to the n8n sub-workflow.

Reads find-contacts.js, fetches the current sub-workflow via n8n REST API,
updates the jsCode in the Find Contacts Code node, and PUTs the full workflow back.

Sub-workflow ID: fGm4IP0rWxgHptN8
Node updated: "Find Contacts" <- find-contacts.js
"""

import json
import os
import sys
import urllib.request
import urllib.error

WORKFLOW_ID = "fGm4IP0rWxgHptN8"
API_BASE = "http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/api/v1"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_FILE = os.path.join(SCRIPT_DIR, "nodes", "find-contacts.js")

def get_api_key():
    key = os.environ.get("N8N_API_KEY")
    if not key:
        print("ERROR: N8N_API_KEY environment variable is not set.")
        sys.exit(1)
    return key

def api_request(method, path, api_key, data=None):
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

def main():
    api_key = get_api_key()

    # 1. Read source file
    print("=== Reading source file ===")
    if not os.path.isfile(SOURCE_FILE):
        print(f"ERROR: Source file not found: {SOURCE_FILE}")
        sys.exit(1)
    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        new_code = f.read()
    line_count = new_code.count("\n") + 1
    print(f"  Find Contacts: find-contacts.js ({line_count} lines, {len(new_code)} chars)")

    # 2. Fetch current workflow
    print(f"\n=== Fetching workflow {WORKFLOW_ID} ===")
    workflow = api_request("GET", f"/workflows/{WORKFLOW_ID}", api_key)
    print(f"  Name: {workflow.get('name', 'unknown')}")
    print(f"  Active: {workflow.get('active', 'unknown')}")
    print(f"  Nodes: {len(workflow.get('nodes', []))}")

    # 3. Update Find Contacts Code node
    print("\n=== Updating Find Contacts node ===")
    nodes = workflow.get("nodes", [])
    updated = False

    for node in nodes:
        if node["name"] == "Find Contacts":
            old_code_len = len(node.get("parameters", {}).get("jsCode", ""))
            if "parameters" not in node:
                node["parameters"] = {}
            node["parameters"]["jsCode"] = new_code
            node["parameters"]["mode"] = "runOnceForAllItems"
            print(f"  Find Contacts: updated ({old_code_len} -> {len(new_code)} chars)")
            updated = True
            break

    if not updated:
        found_names = [n["name"] for n in nodes]
        print(f"\nERROR: Find Contacts node not found. Nodes: {found_names}")
        sys.exit(1)

    # 4. PUT the updated workflow back
    print(f"\n=== Deploying updated workflow ===")
    # Only include settings fields the API accepts
    raw_settings = workflow.get("settings", {})
    clean_settings = {}
    allowed_keys = {"executionOrder", "timezone", "saveDataErrorExecution",
                    "saveDataSuccessExecution", "saveExecutionProgress",
                    "saveManualExecutions", "executionTimeout", "errorWorkflow"}
    for k, v in raw_settings.items():
        if k in allowed_keys:
            clean_settings[k] = v

    put_payload = {
        "name": workflow["name"],
        "nodes": workflow["nodes"],
        "connections": workflow["connections"],
        "settings": clean_settings,
    }

    result = api_request("PUT", f"/workflows/{WORKFLOW_ID}", api_key, data=put_payload)
    print(f"  Success! Workflow updated.")
    print(f"  Updated at: {result.get('updatedAt', 'unknown')}")
    print(f"  Active: {result.get('active', 'unknown')}")

    # 5. Reactivate if needed
    if workflow.get("active") and not result.get("active"):
        print("\n=== Re-activating workflow ===")
        activate_result = api_request("POST", f"/workflows/{WORKFLOW_ID}/activate", api_key)
        print(f"  Active: {activate_result.get('active', 'unknown')}")

    # 6. Verify
    print(f"\n=== Verification ===")
    verify = api_request("GET", f"/workflows/{WORKFLOW_ID}", api_key)
    for node in verify.get("nodes", []):
        if node["name"] == "Find Contacts":
            actual_len = len(node.get("parameters", {}).get("jsCode", ""))
            mode = node.get("parameters", {}).get("mode", "unknown")
            match_str = "OK" if actual_len == len(new_code) else "MISMATCH"
            print(f"  Find Contacts: {actual_len} chars, mode={mode} [{match_str}]")

    print("\n=== Deploy complete ===")

if __name__ == "__main__":
    main()
