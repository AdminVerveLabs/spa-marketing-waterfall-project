"""
Deploy deduplication fix:
1. Add email_status=is.null filter to Fetch Contacts URL
2. Modify Enrich Contacts to always set email_status (even for no-email contacts)
"""
import json
import urllib.request
import sys

API_URL = "http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/api/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMGY2ZWExMC1hYWMyLTRkZDctYTdiYy1kZjExODQ1MzFhMDYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcxMzg2Mjk1LCJleHAiOjE3NzM5NjQ4MDB9.2uC2lGG4T-KiH47DqvN5KMSoK9-MIZpFlSA-iK53E4c"
WORKFLOW_ID = "yxvQst30sWlNIeZq"


def main():
    # 1. Fetch current workflow
    print("Fetching workflow...")
    req = urllib.request.Request(
        f"{API_URL}/workflows/{WORKFLOW_ID}",
        headers={"X-N8N-API-KEY": API_KEY}
    )
    with urllib.request.urlopen(req) as resp:
        wf = json.loads(resp.read().decode())

    nodes = wf.get("nodes", [])
    changes = []

    # 2. Fix Fetch Contacts URL — add email_status=is.null filter
    for node in nodes:
        if node.get("name") == "Fetch Contacts":
            old_url = node["parameters"]["url"]
            # Add filter for unprocessed contacts only
            if "email_status=is.null" not in old_url:
                new_url = old_url.replace(
                    "&order=created_at.asc",
                    "&email_status=is.null&order=created_at.asc"
                )
                node["parameters"]["url"] = new_url
                changes.append(f"Fetch Contacts URL: added email_status=is.null filter")
                print(f"  Old URL: {old_url[:200]}")
                print(f"  New URL: {new_url[:200]}")
            else:
                print("  Fetch Contacts already has email_status filter")
            break

    # 3. Fix Enrich Contacts code — always set email_status in update payload
    for node in nodes:
        if node.get("name") == "Enrich Contacts":
            code = node["parameters"]["jsCode"]

            # Find the update payload section and ensure email_status is always set
            old_block = """  if (contact._email_status && contact._email_status !== 'unverified') {
    update.email_status = contact._email_status;
    update.email_verified_at = contact._email_verified_at;
    if (contact._email_status === 'invalid') {
      update.email_business = null;
    }
  } else if (contact._best_email || contact.email_business) {
    update.email_status = 'unverified';
  }"""

            new_block = """  if (contact._email_status && contact._email_status !== 'unverified') {
    update.email_status = contact._email_status;
    update.email_verified_at = contact._email_verified_at;
    if (contact._email_status === 'invalid') {
      update.email_business = null;
    }
  } else if (contact._best_email || contact.email_business) {
    update.email_status = 'unverified';
  } else {
    // Always set email_status to prevent duplicate processing from convergence batches
    update.email_status = 'no_email';
  }"""

            if old_block in code:
                code = code.replace(old_block, new_block)
                node["parameters"]["jsCode"] = code
                changes.append("Enrich Contacts: always set email_status (added 'no_email' fallback)")
            else:
                print("WARNING: Could not find the expected code block in Enrich Contacts")
                print("Looking for alternatives...")
                # Try to find a close match
                if "else if (contact._best_email || contact.email_business)" in code:
                    print("  Found the email check line — inserting 'no_email' fallback after it")
                    # Find the line and add the else clause
                    lines = code.split('\n')
                    new_lines = []
                    found = False
                    for i, line in enumerate(lines):
                        new_lines.append(line)
                        if "update.email_status = 'unverified';" in line and not found:
                            # Find the closing brace of this else-if
                            if i + 1 < len(lines) and lines[i + 1].strip() == '}':
                                pass  # The brace will be added on next iteration
                            found = True

                    if found:
                        # Insert after the closing } of the else-if
                        code_new = '\n'.join(new_lines)
                        code_new = code_new.replace(
                            "  } else if (contact._best_email || contact.email_business) {\n    update.email_status = 'unverified';\n  }",
                            "  } else if (contact._best_email || contact.email_business) {\n    update.email_status = 'unverified';\n  } else {\n    // Always set email_status to prevent duplicate processing from convergence batches\n    update.email_status = 'no_email';\n  }"
                        )
                        node["parameters"]["jsCode"] = code_new
                        changes.append("Enrich Contacts: always set email_status (added 'no_email' fallback, alt method)")
                    else:
                        print("  ERROR: Could not find insertion point")
                        sys.exit(1)
                else:
                    print("  ERROR: Cannot find email_status logic in code")
                    sys.exit(1)
            break

    # 4. PUT updated workflow
    if not changes:
        print("\nNo changes to deploy!")
        return

    print("\nChanges to deploy:")
    for c in changes:
        print(f"  - {c}")

    # Only include settings fields the API accepts
    raw_settings = wf.get("settings", {})
    clean_settings = {}
    allowed_settings = ["executionOrder", "saveManualExecutions", "callerPolicy", "errorWorkflow", "timezone"]
    for k in allowed_settings:
        if k in raw_settings:
            clean_settings[k] = raw_settings[k]

    update_payload = json.dumps({
        "name": wf.get("name", ""),
        "nodes": nodes,
        "connections": wf.get("connections", {}),
        "settings": clean_settings,
    }).encode()

    req = urllib.request.Request(
        f"{API_URL}/workflows/{WORKFLOW_ID}",
        data=update_payload,
        headers={
            "X-N8N-API-KEY": API_KEY,
            "Content-Type": "application/json"
        },
        method="PUT"
    )

    print("\nDeploying...")
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
            print(f"SUCCESS: Workflow updated (ID: {result.get('id')}, updated: {result.get('updatedAt')})")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"ERROR {e.code}: {error_body[:500]}")
        sys.exit(1)


if __name__ == "__main__":
    main()
