"""Deploy diagnostic Enrich Contacts code to n8n via API."""

import json
import os
import sys

TOOL_RESULTS_DIR = os.path.join(
    os.path.expanduser("~"),
    ".claude", "projects",
    "C--Users-zackm-OneDrive-Documents-GitHub-spa-marketing-waterfall-project",
    "d581db17-bbb2-4228-950a-aa23efc4a0c9",
    "tool-results"
)

# Read the diagnostic code
code_file = os.path.join(TOOL_RESULTS_DIR, "enrich_contacts_diagnostic.js")
with open(code_file, "r", encoding="utf-8") as f:
    code = f.read()

# Build the MCP operation payload
operation = {
    "type": "updateNode",
    "nodeName": "Enrich Contacts",
    "updates": {
        "parameters.jsCode": code
    }
}

# Save as JSON for reference
output = os.path.join(TOOL_RESULTS_DIR, "deploy-operation.json")
with open(output, "w", encoding="utf-8") as f:
    json.dump(operation, f)

print(f"Operation payload saved ({len(json.dumps(operation))} chars)")
print(f"jsCode length: {len(code)} chars")
print("Ready for MCP deployment")
