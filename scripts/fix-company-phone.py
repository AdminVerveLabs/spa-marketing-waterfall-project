"""Fix BUG-F019: Company phone verification blocked by stale static data.

Root cause: $getWorkflowStaticData('global') persists across executions.
The _phone_verified keys set during exec #129 permanently block company
phone verification in all subsequent executions.

Fix: Clear _phone_verified keys from companyEmailsSet at the start of
each Enrich Contacts run, and also remove the diagnostic code.
"""

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

key_match = re.search(r"N8N_API_KEY:\s*''([^']+)''", settings_content)
url_match = re.search(r"N8N_API_URL:\s*''([^']+)''", settings_content)
N8N_API_KEY = key_match.group(1)
N8N_API_URL = url_match.group(1)

# Step 1: Get current workflow
print(f"Fetching workflow {WORKFLOW_ID}...")
req = urllib.request.Request(
    f"{N8N_API_URL}/workflows/{WORKFLOW_ID}",
    headers={"X-N8N-API-KEY": N8N_API_KEY, "Accept": "application/json"}
)
with urllib.request.urlopen(req) as resp:
    workflow = json.loads(resp.read().decode())

print(f"Fetched workflow ({len(workflow['nodes'])} nodes)")

# Step 2: Find Enrich Contacts and get its code
for node in workflow["nodes"]:
    if node["name"] == "Enrich Contacts":
        code = node["parameters"]["jsCode"]
        break
else:
    print("ERROR: Enrich Contacts not found")
    sys.exit(1)

print(f"Current jsCode: {len(code)} chars")

# Step 3: Apply fix — clear stale phone_verified keys at start of execution
# Find the line where companyEmailsSet is initialized and add cleanup
old_init = """const companyEmailsSet = staticData._companyEmailsSet;"""
new_init = """const companyEmailsSet = staticData._companyEmailsSet;

// BUG-F019 FIX: Clear stale _phone_verified keys from previous executions
// $getWorkflowStaticData('global') persists across executions, not just batches.
// Without this, company phone verification is permanently blocked after first run.
for (const key of Object.keys(companyEmailsSet)) {
  if (key.endsWith('_phone_verified')) {
    delete companyEmailsSet[key];
  }
}"""

if old_init in code:
    code = code.replace(old_init, new_init, 1)
    print("Applied fix: clear stale _phone_verified keys at start")
else:
    print("ERROR: Could not find companyEmailsSet initialization")
    sys.exit(1)

# Step 4: Remove diagnostic code
# Remove the diagnostic block
diag_start = "  // DIAGNOSTIC: capture condition values before company phone verification"
diag_end = "  };\n\n  // COMPANY PHONE VERIFICATION (Telnyx)"
if diag_start in code and diag_end in code:
    start_idx = code.index(diag_start)
    end_idx = code.index(diag_end) + len("  };\n\n")
    code = code[:start_idx] + code[end_idx:]
    print("Removed diagnostic block")
else:
    print("WARNING: Diagnostic block not found (may already be removed)")

# Remove diagnostic from results output
diag_output = "      _company_phone_debug: contact._company_phone_debug || null,\n"
if diag_output in code:
    code = code.replace(diag_output, "", 1)
    print("Removed diagnostic from results output")
else:
    print("WARNING: Diagnostic output line not found")

# Step 5: Verify fix
assert "delete companyEmailsSet[key]" in code, "Fix not applied!"
assert "_company_phone_debug" not in code, "Diagnostic not fully removed!"
assert "// COMPANY PHONE VERIFICATION (Telnyx)" in code, "Company phone block missing!"
print(f"\nFixed jsCode: {len(code)} chars")

# Step 6: Deploy
node["parameters"]["jsCode"] = code

allowed_settings = {"executionOrder", "timezone", "errorWorkflow",
                    "executionTimeout", "saveDataErrorExecution",
                    "saveDataSuccessExecution", "saveExecutionProgress",
                    "saveManualExecutions"}
raw_settings = workflow.get("settings", {})
clean_settings = {k: v for k, v in raw_settings.items() if k in allowed_settings}

print(f"Deploying fix to n8n...")
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
    print(f"\nSUCCESS: Fix deployed")
    print(f"  ID: {result.get('id')}")
    print(f"  Nodes: {len(result.get('nodes', []))}")

    # Save the fixed code for local snapshot
    TOOL_RESULTS_DIR = os.path.join(
        os.path.expanduser("~"),
        ".claude", "projects",
        "C--Users-zackm-OneDrive-Documents-GitHub-spa-marketing-waterfall-project",
        "d581db17-bbb2-4228-950a-aa23efc4a0c9",
        "tool-results"
    )
    with open(os.path.join(TOOL_RESULTS_DIR, "enrich_contacts_fixed.js"), "w", encoding="utf-8") as f:
        f.write(code)
    print(f"  Saved fixed code to enrich_contacts_fixed.js")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"ERROR {e.code}: {body[:500]}")
    sys.exit(1)
