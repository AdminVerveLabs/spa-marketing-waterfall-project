"""Add diagnostic logging to Enrich Contacts jsCode for BUG-F019 investigation."""

import json
import sys
import os

TOOL_RESULTS_DIR = os.path.join(
    os.path.expanduser("~"),
    ".claude", "projects",
    "C--Users-zackm-OneDrive-Documents-GitHub-spa-marketing-waterfall-project",
    "d581db17-bbb2-4228-950a-aa23efc4a0c9",
    "tool-results"
)

workflow_file = os.path.join(TOOL_RESULTS_DIR, "mcp-n8n-n8n_get_workflow-1771516486751.txt")

with open(workflow_file, "r", encoding="utf-8") as f:
    data = json.load(f)

parsed = json.loads(data[0]["text"])
nodes = parsed["data"]["nodes"]

code = None
for node in nodes:
    if node.get("name") == "Enrich Contacts":
        code = node["parameters"]["jsCode"]
        break

if not code:
    print("ERROR: Could not find Enrich Contacts node")
    sys.exit(1)

# Diagnostic code to insert BEFORE the company phone verification block
diagnostic = """  // DIAGNOSTIC: capture condition values before company phone verification
  contact._company_phone_debug = {
    c1_value: contact._company_phone,
    c1_truthy: !!contact._company_phone,
    c2_value: contact._company_phone_status,
    c2_type: typeof contact._company_phone_status,
    c2_negated: !contact._company_phone_status,
    c3_value: config.skip_phone_verifier,
    c3_check: config.skip_phone_verifier !== 'true',
    c4_key: companyId + '_phone_verified',
    c4_value: companyEmailsSet[companyId + '_phone_verified'],
    c4_negated: !companyEmailsSet[companyId + '_phone_verified'],
    all_true: !!contact._company_phone && !contact._company_phone_status && config.skip_phone_verifier !== 'true' && !companyEmailsSet[companyId + '_phone_verified'],
    companyId: companyId,
    phone_dedup_keys: Object.keys(companyEmailsSet).filter(k => k.includes('phone'))
  };

"""

# Insertion point 1: Before company phone verification block
marker1 = "  // COMPANY PHONE VERIFICATION (Telnyx)"
if marker1 not in code:
    print("ERROR: Could not find company phone verification marker")
    sys.exit(1)

code = code.replace(marker1, diagnostic + marker1, 1)
print("Inserted diagnostic before company phone verification block")

# Insertion point 2: Add _company_phone_debug to results output
marker2 = "      _phone_error: contact._phone_error,"
insert2 = "      _phone_error: contact._phone_error,\n      _company_phone_debug: contact._company_phone_debug || null,"
if marker2 not in code:
    print("ERROR: Could not find _phone_error marker in results")
    sys.exit(1)

code = code.replace(marker2, insert2, 1)
print("Added _company_phone_debug to results output")

# Verify
assert "!!contact._company_phone" in code, "Double-bang missing"
assert "!contact._company_phone_status" in code, "Negation missing"
assert "_company_phone_debug: contact._company_phone_debug" in code, "Results output missing"

# Save
output_file = os.path.join(TOOL_RESULTS_DIR, "enrich_contacts_diagnostic.js")
with open(output_file, "w", encoding="utf-8") as f:
    f.write(code)

print(f"Saved modified code ({len(code)} chars) to {output_file}")

# Also verify a snippet
idx = code.find("c1_truthy")
print(f"Verification: {repr(code[idx:idx+45])}")
