"""Deploy diagnostic Enrich Contacts code to n8n via REST API.
Extracts API credentials from Claude Code settings.local.json."""

import json
import os
import sys
import re
import urllib.request
import urllib.error

WORKFLOW_ID = "yxvQst30sWlNIeZq"

# Extract n8n API credentials from Claude Code settings
settings_file = os.path.join(
    os.path.expanduser("~"),
    "OneDrive", "Documents", "GitHub",
    "spa-marketing_waterfall_project",
    ".claude", "settings.local.json"
)

with open(settings_file, "r", encoding="utf-8") as f:
    settings_content = f.read()

# Extract API key from the embedded Node.js command
key_match = re.search(r"N8N_API_KEY:\s*''([^']+)''", settings_content)
url_match = re.search(r"N8N_API_URL:\s*''([^']+)''", settings_content)

if not key_match or not url_match:
    print("ERROR: Could not extract n8n credentials from settings.local.json")
    sys.exit(1)

N8N_API_KEY = key_match.group(1)
N8N_API_URL = url_match.group(1)
print(f"API URL: {N8N_API_URL}")
print(f"API Key: {N8N_API_KEY[:20]}...")

# Read the diagnostic code
TOOL_RESULTS_DIR = os.path.join(
    os.path.expanduser("~"),
    ".claude", "projects",
    "C--Users-zackm-OneDrive-Documents-GitHub-spa-marketing-waterfall-project",
    "d581db17-bbb2-4228-950a-aa23efc4a0c9",
    "tool-results"
)
code_file = os.path.join(TOOL_RESULTS_DIR, "enrich_contacts_diagnostic.js")
with open(code_file, "r", encoding="utf-8") as f:
    code = f.read()

print(f"Loaded jsCode: {len(code)} chars")

# Verify code correctness
assert "!!contact._company_phone" in code, "Double-bang missing!"
assert "!contact._company_phone_status" in code, "Negation missing!"
assert "_company_phone_debug" in code, "Debug output missing!"
assert "\\!" not in code, "Backslash-escaped bangs found!"
print("Code verification passed")

# Step 1: Get current workflow
print(f"\nFetching workflow {WORKFLOW_ID}...")
req = urllib.request.Request(
    f"{N8N_API_URL}/workflows/{WORKFLOW_ID}",
    headers={
        "X-N8N-API-KEY": N8N_API_KEY,
        "Accept": "application/json"
    }
)
with urllib.request.urlopen(req) as resp:
    workflow = json.loads(resp.read().decode())

print(f"Fetched workflow: {workflow['name']} ({len(workflow['nodes'])} nodes)")

# Step 2: Find and update Enrich Contacts node
updated = False
for node in workflow["nodes"]:
    if node["name"] == "Enrich Contacts":
        old_code = node["parameters"]["jsCode"]
        node["parameters"]["jsCode"] = code
        updated = True
        print(f"Updated Enrich Contacts jsCode ({len(old_code)} -> {len(code)} chars)")
        break

if not updated:
    print("ERROR: Could not find Enrich Contacts node")
    sys.exit(1)

# Step 3: PUT the updated workflow back
# Strip settings to only allowed fields
allowed_settings = {"executionOrder", "timezone", "errorWorkflow",
                    "executionTimeout", "saveDataErrorExecution",
                    "saveDataSuccessExecution", "saveExecutionProgress",
                    "saveManualExecutions"}
raw_settings = workflow.get("settings", {})
clean_settings = {k: v for k, v in raw_settings.items() if k in allowed_settings}

print(f"\nDeploying to n8n...")
put_data = json.dumps({
    "name": workflow["name"],
    "nodes": workflow["nodes"],
    "connections": workflow["connections"],
    "settings": clean_settings
}).encode("utf-8")

req = urllib.request.Request(
    f"{N8N_API_URL}/workflows/{WORKFLOW_ID}",
    data=put_data,
    headers={
        "X-N8N-API-KEY": N8N_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
    },
    method="PUT"
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode())
    print(f"\nSUCCESS: Workflow updated")
    print(f"  ID: {result.get('id')}")
    print(f"  Nodes: {len(result.get('nodes', []))}")
    print(f"  Active: {result.get('active')}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"ERROR {e.code}: {body[:500]}")
    sys.exit(1)
