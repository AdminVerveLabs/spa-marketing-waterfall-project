"""
Dedup fix v2:
1. Revert 'no_email' status (causes CHECK constraint violation)
2. Revert email_status=is.null filter from Fetch Contacts
3. Add deduplication inside Filter & Merge Contacts using $getWorkflowStaticData()
   - On first batch, stores processed contact IDs in static data
   - On subsequent batches, filters out already-processed IDs
"""
import json
import urllib.request
import sys

API_URL = "http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/api/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMGY2ZWExMC1hYWMyLTRkZDctYTdiYy1kZjExODQ1MzFhMDYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcxMzg2Mjk1LCJleHAiOjE3NzM5NjQ4MDB9.2uC2lGG4T-KiH47DqvN5KMSoK9-MIZpFlSA-iK53E4c"
WORKFLOW_ID = "yxvQst30sWlNIeZq"

# New Filter & Merge Contacts code with deduplication via static data
FILTER_MERGE_CODE = r'''// Merge contacts with their company data and filter to those needing enrichment
// Includes deduplication across convergence batches using workflow static data
const contactItems = $('Fetch Contacts').all();
const companyItems = $('Fetch Companies1').all();

// Use static data to track processed contact IDs across batches in this execution
const staticData = $getWorkflowStaticData('global');
if (!staticData._enrichedContactIds) {
  staticData._enrichedContactIds = [];
}
const alreadyProcessed = new Set(staticData._enrichedContactIds);

// Parse contacts - deduplicate by id
let rawContacts = [];
for (const item of contactItems) {
  if (item.json && Array.isArray(item.json)) {
    rawContacts.push(...item.json);
  } else if (item.json && item.json.id) {
    rawContacts.push(item.json);
  }
}

// Deduplicate by contact id AND filter out already-processed contacts
const seenIds = new Set();
let contacts = [];
for (const c of rawContacts) {
  if (c.id && !seenIds.has(c.id) && !alreadyProcessed.has(c.id)) {
    seenIds.add(c.id);
    contacts.push(c);
  }
}

const skippedDuplicates = rawContacts.length - contacts.length - (rawContacts.length - [...new Set(rawContacts.map(c => c.id))].length);

// Mark these contacts as being processed (for subsequent batches)
for (const c of contacts) {
  staticData._enrichedContactIds.push(c.id);
}

// Parse companies into a lookup map
let companyMap = {};
for (const item of companyItems) {
  if (Array.isArray(item.json)) {
    for (const co of item.json) {
      if (co.id) companyMap[co.id] = co;
    }
  } else if (item.json && item.json.id) {
    companyMap[item.json.id] = item.json;
  }
}

// Filter contacts that need enrichment
const needsEnrichment = contacts.filter(c => {
  const missingEmail = !c.email_business;
  const missingCulturalAffinity = !c.cultural_affinity;
  const missingPhone = !c.phone_direct;
  const missingLinkedin = !c.linkedin_url;
  const verifiedStatuses = ['verified', 'invalid', 'risky', 'accept_all'];
  const emailNeedsVerification = c.email_business && !verifiedStatuses.includes(c.email_status);
  return missingEmail || missingCulturalAffinity || missingPhone || missingLinkedin || emailNeedsVerification;
});

console.log(`Contacts: ${rawContacts.length} raw, ${contacts.length} unique (${alreadyProcessed.size} already processed in earlier batch), ${needsEnrichment.length} need enrichment`);

if (needsEnrichment.length === 0) {
  return [{ json: { _empty: true, _count: 0, _message: `All contacts already processed or enriched (${alreadyProcessed.size} from earlier batches)` } }];
}

// Merge company data into each contact
const merged = needsEnrichment.map(c => {
  const company = companyMap[c.company_id] || {};
  return {
    json: {
      ...c,
      _company_name: company.name || null,
      _company_domain: company.domain || null,
      _company_phone: company.phone || null,
      _company_city: company.city || null,
      _company_state: company.state || null
    }
  };
});

return merged;'''


def main():
    print("Fetching workflow...")
    req = urllib.request.Request(
        f"{API_URL}/workflows/{WORKFLOW_ID}",
        headers={"X-N8N-API-KEY": API_KEY}
    )
    with urllib.request.urlopen(req) as resp:
        wf = json.loads(resp.read().decode())

    nodes = wf.get("nodes", [])
    changes = []

    # 1. Revert Fetch Contacts URL — remove email_status filter
    for node in nodes:
        if node.get("name") == "Fetch Contacts":
            url = node["parameters"]["url"]
            if "&email_status=is.null" in url:
                node["parameters"]["url"] = url.replace("&email_status=is.null", "")
                changes.append("Fetch Contacts: removed email_status=is.null filter")
            break

    # 2. Revert Enrich Contacts — remove 'no_email' fallback
    for node in nodes:
        if node.get("name") == "Enrich Contacts":
            code = node["parameters"]["jsCode"]
            bad_block = """  } else {
    // Always set email_status to prevent duplicate processing from convergence batches
    update.email_status = 'no_email';
  }"""
            if bad_block in code:
                code = code.replace(bad_block, "  }")
                node["parameters"]["jsCode"] = code
                changes.append("Enrich Contacts: removed 'no_email' fallback")
            break

    # 3. Update Filter & Merge Contacts with static data deduplication
    for node in nodes:
        if node.get("name") == "Filter & Merge Contacts":
            old_len = len(node["parameters"]["jsCode"])
            node["parameters"]["jsCode"] = FILTER_MERGE_CODE
            changes.append(f"Filter & Merge Contacts: added static data dedup ({old_len} -> {len(FILTER_MERGE_CODE)} chars)")
            break

    print("\nChanges to deploy:")
    for c in changes:
        print(f"  - {c}")

    # Clean settings
    raw_settings = wf.get("settings", {})
    clean_settings = {}
    for k in ["executionOrder", "saveManualExecutions", "callerPolicy", "errorWorkflow", "timezone"]:
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
