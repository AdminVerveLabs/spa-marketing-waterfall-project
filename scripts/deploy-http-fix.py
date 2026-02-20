"""
Deploy the $http -> this.helpers.httpRequest fix to the Enrich Contacts node
and update Step 4 Config skip toggles to all-true for testing.
"""
import json
import urllib.request
import sys
import os

API_URL = "http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/api/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMGY2ZWExMC1hYWMyLTRkZDctYTdiYy1kZjExODQ1MzFhMDYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcxMzg2Mjk1LCJleHAiOjE3NzM5NjQ4MDB9.2uC2lGG4T-KiH47DqvN5KMSoK9-MIZpFlSA-iK53E4c"
WORKFLOW_ID = "yxvQst30sWlNIeZq"

FIXED_ENRICH_CODE = r'''// Enrich Contacts — Single Code node replacing the entire Step 4 branching pipeline
// Mode: runOnceForAllItems
// Uses this.helpers.httpRequest() for inline HTTP calls (NOT $http which is unavailable)

const config = $('Step 4 Config').first().json;
const contacts = $input.all().filter(item => !item.json._empty);

const results = [];

// Helper: delay between API calls for rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Phone validation (from Prepare Contact Update)
function validatePhone(phone) {
  if (!phone) return null;
  if (typeof phone === 'object' && phone !== null) {
    phone = phone.sanitized_number || phone.raw_number || phone.number || '';
  }
  let cleaned = phone.toString().trim().replace(/[^\d]/g, '');
  if (!cleaned || cleaned.length === 0) return null;
  if (cleaned.length === 11 && cleaned.startsWith('1')) { /* ok */ }
  else if (cleaned.length === 10) { cleaned = '1' + cleaned; }
  else if (cleaned.length < 10) { return null; }
  else if (cleaned.length > 11) { return '+' + cleaned; }
  const areaCode = cleaned.substring(1, 4);
  if (areaCode.startsWith('0') || areaCode.startsWith('1')) return null;
  return '+' + cleaned;
}

for (const item of contacts) {
  const contact = { ...item.json };

  // Initialize enrichment fields
  contact._hunter_email = null;
  contact._hunter_score = 0;
  contact._hunter_linkedin = null;
  contact._hunter_phone = null;
  contact._snovio_email = null;
  contact._email_source = null;
  contact._best_email = contact.email_business || null;
  contact._best_phone = contact.phone_direct || contact._company_phone || null;
  contact._best_linkedin = contact.linkedin_url || null;
  contact._email_status = null;
  contact._email_verified_at = null;
  contact._verifier_score = null;
  contact._cultural_affinity = contact.cultural_affinity || null;
  contact._namsor_country = null;
  contact._namsor_region = null;
  contact._namsor_probability = null;

  const needsEmail = !contact.email_business;
  const hasDomainAndName = contact._company_domain && contact.first_name;
  const verifiedStatuses = ['verified', 'invalid', 'risky', 'accept_all'];
  const emailNeedsVerification = contact.email_business && !verifiedStatuses.includes(contact.email_status);

  // ═══════════════════════════════════════
  // EMAIL WATERFALL
  // ═══════════════════════════════════════

  if (needsEmail && hasDomainAndName) {
    // --- HUNTER EMAIL FINDER ---
    if (config.skip_hunter !== 'true') {
      try {
        const hunterUrl = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(contact._company_domain)}&first_name=${encodeURIComponent(contact.first_name)}&last_name=${encodeURIComponent(contact.last_name || '')}&api_key=${$env.HUNTER_API_KEY}`;
        const hunterResp = await this.helpers.httpRequest({ method: 'GET', url: hunterUrl, headers: { 'Accept': 'application/json' }, json: true });
        const hData = hunterResp.data || hunterResp;
        if (hData && hData.email && (hData.score === undefined || hData.score >= 50)) {
          contact._hunter_email = hData.email;
          contact._hunter_score = hData.score || 0;
          contact._hunter_linkedin = hData.linkedin_url || null;
          contact._hunter_phone = hData.phone_number || null;
          contact._email_source = 'hunter';
        }
        await delay(200);
      } catch(e) {
        console.log(`Hunter error for ${contact.first_name}: ${e.message}`);
      }
    }

    // --- SNOV.IO EMAIL FINDER (fallback) ---
    if (!contact._hunter_email && config.skip_snovio !== 'true') {
      try {
        const snovResp = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.snov.io/v1/get-emails-from-names',
          headers: { 'Content-Type': 'application/json' },
          body: {
            firstName: contact.first_name,
            lastName: contact.last_name || '',
            domain: contact._company_domain
          },
          json: true
        });
        const emails = snovResp.emails || snovResp.data?.emails || [];
        if (Array.isArray(emails) && emails.length > 0) {
          const valid = emails.find(e => e.emailStatus === 'valid' || e.status === 'valid') || emails[0];
          contact._snovio_email = valid.email || valid.value || null;
          if (contact._snovio_email) contact._email_source = 'snovio';
        }
        await delay(500);
      } catch(e) {
        console.log(`Snov.io error for ${contact.first_name}: ${e.message}`);
      }
    }

    contact._best_email = contact._hunter_email || contact._snovio_email || null;
    contact._best_phone = contact.phone_direct || contact._hunter_phone || contact._company_phone || null;
    contact._best_linkedin = contact.linkedin_url || contact._hunter_linkedin || null;
  } else if (contact.email_business) {
    contact._best_email = contact.email_business;
    contact._email_source = 'existing';
  }

  // ═══════════════════════════════════════
  // EMAIL VERIFICATION
  // ═══════════════════════════════════════

  if (contact._best_email && config.skip_hunter_verifier !== 'true') {
    const shouldVerify = !contact.email_business || emailNeedsVerification || contact._email_source === 'hunter' || contact._email_source === 'snovio';
    if (shouldVerify) {
      try {
        const verifyUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(contact._best_email)}&api_key=${$env.HUNTER_API_KEY}`;
        const verifyResp = await this.helpers.httpRequest({ method: 'GET', url: verifyUrl, headers: { 'Accept': 'application/json' }, json: true });
        const vBody = verifyResp.data || verifyResp;
        if (vBody && vBody.status) {
          switch (vBody.status) {
            case 'valid': contact._email_status = 'verified'; break;
            case 'invalid': contact._email_status = 'invalid'; break;
            case 'accept_all': contact._email_status = 'accept_all'; break;
            case 'disposable': contact._email_status = 'invalid'; break;
            case 'webmail': contact._email_status = 'verified'; break;
            default: contact._email_status = 'risky'; break;
          }
          contact._email_verified_at = new Date().toISOString();
          contact._verifier_score = vBody.score || null;
        }
        await delay(700);
      } catch(e) {
        console.log(`Verifier error for ${contact._best_email}: ${e.message}`);
        contact._email_status = 'unverified';
      }
    }
  } else if (contact._best_email) {
    contact._email_status = 'unverified';
  }

  // ═══════════════════════════════════════
  // NAMSOR CULTURAL AFFINITY
  // ═══════════════════════════════════════

  if (!contact.cultural_affinity && contact.first_name && (contact.last_name || '').length > 0 && config.skip_namsor !== 'true') {
    try {
      const namsorUrl = `https://v2.namsor.com/NamSorAPIv2/api2/json/origin/${encodeURIComponent(contact.first_name)}/${encodeURIComponent(contact.last_name || 'Unknown')}`;
      const namsorResp = await this.helpers.httpRequest({ method: 'GET', url: namsorUrl, headers: { 'X-API-KEY': $env.NAMSOR_API_KEY, 'Accept': 'application/json' }, json: true });
      if (namsorResp && namsorResp.countryOrigin) {
        const parts = [];
        if (namsorResp.regionOrigin) parts.push(namsorResp.regionOrigin);
        if (namsorResp.subRegionOrigin && namsorResp.subRegionOrigin !== namsorResp.regionOrigin) parts.push(namsorResp.subRegionOrigin);
        if (namsorResp.countryOrigin) parts.push(namsorResp.countryOrigin);
        contact._cultural_affinity = parts.join(' / ');
        if (namsorResp.probabilityCalibrated && namsorResp.probabilityCalibrated < 0.3) {
          contact._cultural_affinity += ' (low confidence)';
        }
        contact._namsor_country = namsorResp.countryOrigin;
        contact._namsor_region = namsorResp.regionOrigin;
        contact._namsor_probability = namsorResp.probabilityCalibrated;
      }
      await delay(100);
    } catch(e) {
      console.log(`NamSor error for ${contact.first_name}: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════
  // BUILD UPDATE PAYLOAD
  // ═══════════════════════════════════════

  const update = {};
  if (contact._best_email && !contact.email_business) {
    update.email_business = contact._best_email;
  }
  if (contact._email_status && contact._email_status !== 'unverified') {
    update.email_status = contact._email_status;
    update.email_verified_at = contact._email_verified_at;
    if (contact._email_status === 'invalid') {
      update.email_business = null;
    }
  } else if (contact._best_email || contact.email_business) {
    update.email_status = 'unverified';
  }
  const newPhone = validatePhone(contact._best_phone);
  if (newPhone && !contact.phone_direct) update.phone_direct = newPhone;
  if (contact._best_linkedin && !contact.linkedin_url) update.linkedin_url = contact._best_linkedin;
  if (contact._cultural_affinity && !contact.cultural_affinity) update.cultural_affinity = contact._cultural_affinity;

  contact._update_payload = Object.keys(update).length > 0 ? update : null;
  contact._has_updates = Object.keys(update).length > 0;

  // ═══════════════════════════════════════
  // SUPABASE UPDATE (inline)
  // ═══════════════════════════════════════

  if (contact._has_updates) {
    try {
      await this.helpers.httpRequest({
        method: 'PATCH',
        url: `${$env.SUPABASE_URL}/rest/v1/contacts?id=eq.${contact.id}`,
        headers: {
          'apikey': $env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${$env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: update,
        json: true
      });
      console.log(`Updated ${contact.first_name} ${contact.last_name || ''}: ${JSON.stringify(update)}`);
    } catch(e) {
      console.log(`Supabase update error for ${contact.id}: ${e.message}`);
      contact._update_error = e.message;
    }
    await delay(50);
  }

  results.push({
    json: {
      _contact_id: contact.id,
      _company_id: contact.company_id,
      _first_name: contact.first_name,
      _last_name: contact.last_name,
      _company_name: contact._company_name,
      _update_payload: contact._update_payload,
      _has_updates: contact._has_updates,
      _email_source: contact._email_source,
      _email_status: contact._email_status,
      _verifier_score: contact._verifier_score,
      _namsor_country: contact._namsor_country,
      _namsor_probability: contact._namsor_probability,
      _update_error: contact._update_error || null
    }
  });
}

if (results.length === 0) {
  return [{ json: { _empty: true, _count: 0 } }];
}

return results;'''


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

    # 2. Update Enrich Contacts node code
    for node in nodes:
        if node.get("name") == "Enrich Contacts":
            old_code = node["parameters"]["jsCode"]
            node["parameters"]["jsCode"] = FIXED_ENRICH_CODE
            changes.append(f"Updated Enrich Contacts code ({len(old_code)} -> {len(FIXED_ENRICH_CODE)} chars)")
            # Verify no $http.request() calls remain (ignore comments)
            code_lines = [l for l in FIXED_ENRICH_CODE.split('\n') if not l.strip().startswith('//')]
            code_only = '\n'.join(code_lines)
            if "$http.request" in code_only or "await $http" in code_only:
                print("ERROR: $http.request() still in fixed code!")
                sys.exit(1)
            break
    else:
        print("ERROR: Enrich Contacts node not found!")
        sys.exit(1)

    # 3. Update Step 4 Config skip toggles to all-true for testing
    for node in nodes:
        if node.get("name") == "Step 4 Config":
            assignments = node["parameters"]["assignments"]["assignments"]
            for a in assignments:
                if a["name"] == "skip_hunter":
                    old = a["value"]
                    a["value"] = "true"
                    changes.append(f"Step 4 Config: skip_hunter '{old}' -> 'true'")
                elif a["name"] == "skip_snovio":
                    old = a["value"]
                    a["value"] = "true"
                    changes.append(f"Step 4 Config: skip_snovio '{old}' -> 'true'")
                elif a["name"] == "skip_hunter_verifier":
                    old = a["value"]
                    a["value"] = "true"
                    changes.append(f"Step 4 Config: skip_hunter_verifier '{old}' -> 'true'")
                elif a["name"] == "skip_namsor":
                    old = a["value"]
                    a["value"] = "true"
                    changes.append(f"Step 4 Config: skip_namsor '{old}' -> 'true'")
            break

    # 4. PUT updated workflow
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
        "settings": clean_settings
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
