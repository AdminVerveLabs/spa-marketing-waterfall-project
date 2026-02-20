"""Fix BUG-F019 v2: Clear ALL stale companyEmailsSet keys at start of each execution.

The v1 fix only cleared _phone_verified keys. This v2 clears the entire
companyEmailsSet to prevent any stale static data from blocking company
operations (email verification, phone verification, email routing).

Within a single execution, the keys are rebuilt from scratch as contacts
are processed, so clearing at the start is always safe.
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

for node in workflow["nodes"]:
    if node["name"] == "Enrich Contacts":
        code = node["parameters"]["jsCode"]
        break
else:
    print("ERROR: Enrich Contacts not found")
    sys.exit(1)

print(f"Current jsCode: {len(code)} chars")

# Replace the v1 fix (clear only _phone_verified) with v2 (clear everything)
old_fix = """const companyEmailsSet = staticData._companyEmailsSet;

// BUG-F019 FIX: Clear stale _phone_verified keys from previous executions
// $getWorkflowStaticData('global') persists across executions, not just batches.
// Without this, company phone verification is permanently blocked after first run.
for (const key of Object.keys(companyEmailsSet)) {
  if (key.endsWith('_phone_verified')) {
    delete companyEmailsSet[key];
  }
}"""

new_fix = """const companyEmailsSet = staticData._companyEmailsSet;

// BUG-F019 FIX: Clear ALL stale keys from previous executions.
// $getWorkflowStaticData('global') persists across executions, not just batches.
// Without this, company phone/email dedup guards from previous runs permanently
// block verification for companies that were already processed.
// Within a single execution, keys are rebuilt as contacts are processed.
for (const key of Object.keys(companyEmailsSet)) {
  delete companyEmailsSet[key];
}"""

if old_fix in code:
    code = code.replace(old_fix, new_fix, 1)
    print("Applied v2 fix: clear ALL stale keys")
else:
    print("ERROR: v1 fix not found in code")
    sys.exit(1)

# Verify
assert "delete companyEmailsSet[key]" in code
assert "_company_phone_debug" not in code
print(f"Fixed jsCode: {len(code)} chars")

# Deploy
node["parameters"]["jsCode"] = code
allowed_settings = {"executionOrder", "timezone", "errorWorkflow",
                    "executionTimeout", "saveDataErrorExecution",
                    "saveDataSuccessExecution", "saveExecutionProgress",
                    "saveManualExecutions"}
clean_settings = {k: v for k, v in workflow.get("settings", {}).items() if k in allowed_settings}

print("Deploying v2 fix...")
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
    print(f"\nSUCCESS: v2 fix deployed (ID: {result.get('id')}, nodes: {len(result.get('nodes', []))})")

    # Save the fixed code
    TOOL_RESULTS_DIR = os.path.join(
        os.path.expanduser("~"),
        ".claude", "projects",
        "C--Users-zackm-OneDrive-Documents-GitHub-spa-marketing-waterfall-project",
        "d581db17-bbb2-4228-950a-aa23efc4a0c9",
        "tool-results"
    )
    with open(os.path.join(TOOL_RESULTS_DIR, "enrich_contacts_fixed.js"), "w", encoding="utf-8") as f:
        f.write(code)
    print("Saved fixed code")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"ERROR {e.code}: {body[:500]}")
    sys.exit(1)
