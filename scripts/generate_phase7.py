#!/usr/bin/env python3
"""Phase 7: Generate fixed workflow JSON.

Reads the current workflow, removes 31 Step 4 branching nodes,
adds 2 new nodes (Enrich Contacts + Run Summary4), and wires new connections.
"""

import json
import sys
import os
import uuid
import copy

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, "..", "workflows", "current",
    "Step 4 (isolated) - with Layer 2 Verification.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "workflows", "generated",
    "spa-waterfall-fixed.json")

with open(INPUT_PATH, 'r', encoding='utf-8') as f:
    wf = json.load(f)

print(f"Original workflow: {len(wf['nodes'])} nodes")

# ============================================================
# STEP 1: Identify nodes to remove (31 Step 4 branching nodes)
# ============================================================

NODES_TO_REMOVE = {
    "Needs Email?",
    "Has Domain & Name?",
    "Hunter Enabled?",
    "Hunter Email Finder",
    "Parse Hunter Response",
    "Skip Hunter",
    "Hunter Found Email?",
    "Snov.io Enabled?",
    "Snov.io Email Finder",
    "Parse Snov.io Response",
    "Skip Snov.io",
    "Merge Email Results",
    "Collect Email Results",
    "Skip Email - Pass Through",
    "No Domain - Skip Email",
    "Has Email to Verify?",
    "Hunter Verifier Enabled?",
    "Hunter Email Verifier",
    "Parse Verifier Response",
    "Skip Verification",
    "Collect Verified Results",
    "Needs NamSor?",
    "NamSor Origin",
    "Parse NamSor Response",
    "Skip NamSor",
    "Collect NamSor Results",
    "Prepare Contact Update",
    "Has Updates?",
    "Update Contact in Supabase",
    "Collect Updates",
    "Run Summary4",
}

# Verify all exist
existing_names = {n['name'] for n in wf['nodes']}
missing = NODES_TO_REMOVE - existing_names
if missing:
    print(f"WARNING: Nodes not found: {missing}")
    sys.exit(1)

print(f"Removing {len(NODES_TO_REMOVE)} nodes")

# ============================================================
# STEP 2: Remove nodes
# ============================================================

wf['nodes'] = [n for n in wf['nodes'] if n['name'] not in NODES_TO_REMOVE]

# ============================================================
# STEP 3: Remove connections involving removed nodes
# ============================================================

# Remove outgoing connections from removed nodes
for name in list(wf['connections'].keys()):
    if name in NODES_TO_REMOVE:
        del wf['connections'][name]

# Remove incoming connections to removed nodes (in remaining nodes' outputs)
for name in list(wf['connections'].keys()):
    outputs = wf['connections'][name].get('main', [])
    for i, output_list in enumerate(outputs):
        if output_list:
            wf['connections'][name]['main'][i] = [
                conn for conn in output_list
                if conn.get('node') not in NODES_TO_REMOVE
            ]

# ============================================================
# STEP 4: Add new nodes
# ============================================================

# The Enrich Contacts jsCode
ENRICH_CONTACTS_CODE = r'''// Enrich Contacts — Single Code node replacing the entire Step 4 branching pipeline
// Mode: runOnceForAllItems
// Eliminates all convergence by processing each contact sequentially

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
  // Check if email needs verification
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
        const hunterResp = await $http.request({ method: 'GET', url: hunterUrl, headers: { 'Accept': 'application/json' } });
        const hData = (hunterResp.body && hunterResp.body.data) ? hunterResp.body.data : (hunterResp.data || hunterResp);
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
        const snovResp = await $http.request({
          method: 'POST',
          url: 'https://api.snov.io/v1/get-emails-from-names',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: contact.first_name,
            lastName: contact.last_name || '',
            domain: contact._company_domain
          })
        });
        const snovBody = snovResp.body || snovResp;
        const emails = snovBody.emails || snovBody.data?.emails || [];
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
    // Only verify if email is new or needs verification
    const shouldVerify = !contact.email_business || emailNeedsVerification || contact._email_source === 'hunter' || contact._email_source === 'snovio';
    if (shouldVerify) {
      try {
        const verifyUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(contact._best_email)}&api_key=${$env.HUNTER_API_KEY}`;
        const verifyResp = await $http.request({ method: 'GET', url: verifyUrl, headers: { 'Accept': 'application/json' } });
        const vBody = (verifyResp.body && verifyResp.body.data) ? verifyResp.body.data : (verifyResp.data || verifyResp);
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
      const namsorResp = await $http.request({ method: 'GET', url: namsorUrl, headers: { 'X-API-KEY': $env.NAMSOR_API_KEY, 'Accept': 'application/json' } });
      const nBody = namsorResp.body || namsorResp;
      if (nBody && nBody.countryOrigin) {
        const parts = [];
        if (nBody.regionOrigin) parts.push(nBody.regionOrigin);
        if (nBody.subRegionOrigin && nBody.subRegionOrigin !== nBody.regionOrigin) parts.push(nBody.subRegionOrigin);
        if (nBody.countryOrigin) parts.push(nBody.countryOrigin);
        contact._cultural_affinity = parts.join(' / ');
        if (nBody.probabilityCalibrated && nBody.probabilityCalibrated < 0.3) {
          contact._cultural_affinity += ' (low confidence)';
        }
        contact._namsor_country = nBody.countryOrigin;
        contact._namsor_region = nBody.regionOrigin;
        contact._namsor_probability = nBody.probabilityCalibrated;
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
      await $http.request({
        method: 'PATCH',
        url: `${$env.SUPABASE_URL}/rest/v1/contacts?id=eq.${contact.id}`,
        headers: {
          'apikey': $env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${$env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(update)
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

# Run Summary4 code
RUN_SUMMARY4_CODE = r'''const config = $('Step 4 Config').first().json;
const items = $input.all();

let totalProcessed = 0;
let emailsFound = 0;
let emailsFromHunter = 0;
let emailsFromSnovio = 0;
let emailsExisting = 0;
let phonesEnriched = 0;
let linkedinEnriched = 0;
let namsorProcessed = 0;
let namsorSuccess = 0;
let contactsUpdated = 0;
let contactsSkipped = 0;

let emailsVerified = 0;
let emailsInvalid = 0;
let emailsRisky = 0;
let emailsAcceptAll = 0;
let emailsUnverified = 0;
let verificationTotal = 0;
let updateErrors = 0;

for (const item of items) {
  const d = item.json;
  if (d._empty) continue;
  totalProcessed++;

  if (d._has_updates) contactsUpdated++;
  else contactsSkipped++;

  if (d._email_source === 'hunter') emailsFromHunter++;
  else if (d._email_source === 'snovio') emailsFromSnovio++;
  else if (d._email_source === 'existing') emailsExisting++;

  if (d._update_payload && d._update_payload.email_business) emailsFound++;
  if (d._update_payload && d._update_payload.phone_direct) phonesEnriched++;
  if (d._update_payload && d._update_payload.linkedin_url) linkedinEnriched++;
  if (d._namsor_country) namsorProcessed++;
  if (d._namsor_country && d._update_payload && d._update_payload.cultural_affinity) namsorSuccess++;

  if (d._email_status) {
    verificationTotal++;
    switch (d._email_status) {
      case 'verified': emailsVerified++; break;
      case 'invalid': emailsInvalid++; break;
      case 'risky': emailsRisky++; break;
      case 'accept_all': emailsAcceptAll++; break;
      case 'unverified': emailsUnverified++; break;
    }
  }

  if (d._update_error) updateErrors++;
}

const summary = {
  run_completed_at: new Date().toISOString(),
  config: {
    batch_size: config.batch_size,
    hunter_finder_enabled: config.skip_hunter !== 'true',
    hunter_verifier_enabled: config.skip_hunter_verifier !== 'true',
    snovio_enabled: config.skip_snovio !== 'true',
    namsor_enabled: config.skip_namsor !== 'true'
  },
  contacts_processed: totalProcessed,
  contacts_updated: contactsUpdated,
  contacts_no_changes: contactsSkipped,
  update_errors: updateErrors,
  email_enrichment: {
    new_emails_found: emailsFound,
    from_hunter: emailsFromHunter,
    from_snovio: emailsFromSnovio,
    already_had_email: emailsExisting
  },
  email_verification: {
    total_checked: verificationTotal,
    verified: emailsVerified,
    invalid_removed: emailsInvalid,
    risky: emailsRisky,
    accept_all: emailsAcceptAll,
    not_verified: emailsUnverified
  },
  phone_enrichment: { phones_added: phonesEnriched },
  linkedin_enrichment: { linkedin_added: linkedinEnriched },
  namsor_enrichment: { names_sent: namsorProcessed, cultural_affinity_set: namsorSuccess },
  message: `Processed ${totalProcessed} contacts. Updated ${contactsUpdated} (${emailsFound} emails, ${phonesEnriched} phones, ${linkedinEnriched} LinkedIn, ${namsorSuccess} cultural affinity). Verification: ${emailsVerified} valid, ${emailsInvalid} invalid removed, ${emailsRisky} risky, ${emailsAcceptAll} accept_all, ${emailsUnverified} not checked. ${contactsSkipped} had no new data. ${updateErrors} update errors.`
};

console.log('=== STEP 4: ENRICH PEOPLE SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

return [{ json: summary }];'''


# New Enrich Contacts node
enrich_node = {
    "parameters": {
        "jsCode": ENRICH_CONTACTS_CODE,
        "mode": "runOnceForAllItems"
    },
    "id": str(uuid.uuid4()),
    "name": "Enrich Contacts",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [18432, 240],
    "notes": "Replaces the entire Step 4 branching pipeline (31 nodes) with a single sequential loop.\nFor each contact: Hunter Email Finder → Snov.io fallback → Hunter Email Verifier → NamSor Origin → Supabase PATCH.\nAll API calls happen inline via $http.request(). No convergence = no batching bugs.\nConfig toggles (skip_hunter, skip_snovio, etc.) are checked inside the loop."
}

# New Run Summary4 node
summary_node = {
    "parameters": {
        "jsCode": RUN_SUMMARY4_CODE
    },
    "id": str(uuid.uuid4()),
    "name": "Run Summary4",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [18880, 240],
    "notes": "Final summary: contacts enriched, emails found (Hunter/Snov.io), verification stats, NamSor stats, update counts."
}

wf['nodes'].append(enrich_node)
wf['nodes'].append(summary_node)

# ============================================================
# STEP 5: Wire new connections
# ============================================================

# Batch Empty?3 FALSE output → Enrich Contacts
# First, find current Batch Empty?3 connections
if "Batch Empty?3" in wf['connections']:
    main = wf['connections']['Batch Empty?3'].get('main', [])
    # output[0] = TRUE → No Records - Done3 (keep)
    # output[1] = FALSE → was Needs Email? → now Enrich Contacts
    if len(main) >= 2:
        main[1] = [{"node": "Enrich Contacts", "type": "main", "index": 0}]
    else:
        # Extend to 2 outputs
        while len(main) < 2:
            main.append([])
        main[1] = [{"node": "Enrich Contacts", "type": "main", "index": 0}]
    wf['connections']['Batch Empty?3']['main'] = main

# Enrich Contacts → Run Summary4
wf['connections']['Enrich Contacts'] = {
    "main": [
        [{"node": "Run Summary4", "type": "main", "index": 0}]
    ]
}

# Run Summary4 has no outgoing connections (terminal node)

# ============================================================
# STEP 6: Update workflow metadata
# ============================================================

wf['name'] = "Step 4 (isolated) - FIXED - Linear Enrichment"

# ============================================================
# STEP 7: Validate and write
# ============================================================

# Validation checks
node_names = [n['name'] for n in wf['nodes']]
assert len(node_names) == len(set(node_names)), "Duplicate node names found!"

# Check all connection targets exist
all_names = set(node_names)
for src, outputs in wf['connections'].items():
    if src not in all_names:
        print(f"WARNING: Connection source '{src}' not in nodes!")
    for out_list in outputs.get('main', []):
        if out_list:
            for conn in out_list:
                if conn['node'] not in all_names:
                    print(f"WARNING: Connection target '{conn['node']}' not in nodes!")

# Count
print(f"Fixed workflow: {len(wf['nodes'])} nodes")
print(f"Removed: {len(NODES_TO_REMOVE)} nodes")
print(f"Added: 2 nodes (Enrich Contacts, Run Summary4)")
print(f"Expected: {151 - 31 + 2} = {151 - 31 + 2} nodes")
assert len(wf['nodes']) == 151 - 31 + 2, f"Node count mismatch: {len(wf['nodes'])} != {151 - 31 + 2}"

# Write output
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

print(f"\nFixed workflow written to {OUTPUT_PATH}")
print(f"File size: {os.path.getsize(OUTPUT_PATH)} bytes")
