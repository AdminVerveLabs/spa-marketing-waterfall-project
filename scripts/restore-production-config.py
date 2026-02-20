"""Restore production config: batch_size=100 in Step 4 Config.

Array index notation silently fails in n8n_update_partial_workflow,
so we use the REST API to do a full parameter replacement.
"""

import json
import os
import sys
import re
import urllib.request
import urllib.error

WORKFLOW_ID = "yxvQst30sWlNIeZq"

settings_file = os.path.join(
    os.path.expanduser("~"),
    "OneDrive", "Documents", "GitHub",
    "spa-marketing_waterfall_project",
    ".claude", "settings.local.json"
)

with open(settings_file, "r", encoding="utf-8") as f:
    settings_content = f.read()

key_match = re.search(r"N8N_API_KEY:\s*''([^']+)''", settings_content)
url_match = re.search(r"N8N_API_URL:\s*''([^']+)''", settings_content)
N8N_API_KEY = key_match.group(1)
N8N_API_URL = url_match.group(1)

print(f"Fetching workflow {WORKFLOW_ID}...")
req = urllib.request.Request(
    f"{N8N_API_URL}/workflows/{WORKFLOW_ID}",
    headers={"X-N8N-API-KEY": N8N_API_KEY, "Accept": "application/json"}
)
with urllib.request.urlopen(req) as resp:
    workflow = json.loads(resp.read().decode())

# Find and update Step 4 Config
for node in workflow["nodes"]:
    if node["name"] == "Step 4 Config":
        assignments = node["parameters"]["assignments"]["assignments"]
        for a in assignments:
            if a["name"] == "batch_size":
                old_val = a["value"]
                a["value"] = "100"
                print(f"  batch_size: {old_val} -> 100")
            # Print all assignments for verification
        print(f"  All assignments: {json.dumps([(a['name'], a['value']) for a in assignments])}")
        break
else:
    print("ERROR: Step 4 Config not found")
    sys.exit(1)

# Deploy
allowed_settings = {"executionOrder", "timezone", "errorWorkflow",
                    "executionTimeout", "saveDataErrorExecution",
                    "saveDataSuccessExecution", "saveExecutionProgress",
                    "saveManualExecutions"}
clean_settings = {k: v for k, v in workflow.get("settings", {}).items() if k in allowed_settings}

print("Deploying production config...")
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
    print(f"\nSUCCESS: Production config restored (ID: {result.get('id')}, nodes: {len(result.get('nodes', []))})")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"ERROR {e.code}: {body[:500]}")
    sys.exit(1)
