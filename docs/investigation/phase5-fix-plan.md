# Phase 5: Fix Plan

**Date:** 2026-02-17
**Phase:** 5 of 7 (Investigation)

## 1. Scope Decision

**Scope: Fix Step 4 only.** Steps 1-3a are working and producing correct data. Step 2's theoretical `.item.json` risks (ISSUE-004/012) have no observed symptoms. Fixing Step 4 is the critical path — it's the only step reported as broken.

Non-Step-4 issues (ISSUE-005, 006, 010, 011, 013, 014) are logged for future work but **not addressed in this workflow generation**. They require schema migrations and cross-step changes that add risk without fixing the immediate problem.

---

## 2. Fix Groups

### Fix Group A: Eliminate Step 4 Multi-Path Convergence (CRITICAL)

**Addresses:** ISSUE-001, ISSUE-002, ISSUE-003, ISSUE-007, ISSUE-008

**Strategy:** Replace the entire Step 4 branching pipeline (from `Needs Email?` through `Run Summary4` — 31 nodes) with a **linear pipeline** of 3 nodes:

1. **Enrich Contacts** (Code, runOnceForAllItems) — Single Code node that loops through all contacts, calls Hunter/Snov.io/Verifier/NamSor APIs via `$http.request()`, and returns fully enriched contacts with update payloads.

2. **Update Contacts in Supabase** (HTTP Request) — Batch PATCH to update all contacts.

3. **Run Summary4** (Code, runOnceForAllItems) — Collect stats from enriched contacts.

**Why this works:**
- Zero convergence = zero batching bugs
- Single Code node processes each contact sequentially in a loop
- All API calls happen inside the loop with proper await
- Config toggles (skip_hunter etc.) are simple if-checks inside the loop
- Rate limiting is handled with delays between API calls

**Nodes removed (31):**
- `Needs Email?`, `Has Domain & Name?`, `Hunter Enabled?`, `Hunter Email Finder`, `Parse Hunter Response`, `Skip Hunter`, `Hunter Found Email?`, `Snov.io Enabled?`, `Snov.io Email Finder`, `Parse Snov.io Response`, `Skip Snov.io`, `Merge Email Results`, `Collect Email Results`, `Skip Email - Pass Through`, `No Domain - Skip Email`, `Has Email to Verify?`, `Hunter Verifier Enabled?`, `Hunter Email Verifier`, `Parse Verifier Response`, `Skip Verification`, `Collect Verified Results`, `Needs NamSor?`, `NamSor Origin`, `Parse NamSor Response`, `Skip NamSor`, `Collect NamSor Results`, `Prepare Contact Update`, `Has Updates?`, `Update Contact in Supabase`, `Collect Updates`, `Run Summary4`

**Nodes added (3):**
- `Enrich Contacts` (Code)
- `Update Contacts in Supabase` (HTTP Request) — reuses URL/headers pattern from removed node
- `Run Summary4` (Code) — rewritten to work from new data structure

**Nodes kept unchanged (8):**
- `Bridge to 4`, `Step 4 Config`, `Fetch Contacts`, `Collapse to Single`, `Fetch Companies1`, `Filter & Merge Contacts`, `Batch Empty?3`, `No Records - Done3`

**Connection changes:**
- `Batch Empty?3` FALSE → `Enrich Contacts` (was → `Needs Email?`)
- `Enrich Contacts` → `Update Contacts in Supabase` (new)
- `Update Contacts in Supabase` → `Run Summary4` (new)
- All other Step 4 connections removed

---

## 3. Implementation Order

1. Back up current workflow JSON to `workflows/backups/`
2. Keep all nodes from `Bridge to 4` through `Batch Empty?3` + `No Records - Done3` unchanged
3. Remove all 31 nodes from `Needs Email?` through old `Run Summary4`
4. Remove all connections from those 31 nodes
5. Add new `Enrich Contacts` Code node
6. Add new `Update Contacts in Supabase` HTTP Request node
7. Add new `Run Summary4` Code node
8. Wire connections: `Batch Empty?3` FALSE → `Enrich Contacts` → `Update Contacts in Supabase` → `Run Summary4`
9. Validate JSON structure

---

## 4. New Node Specifications

### 4.1 Enrich Contacts (Code Node)

- **Type:** n8n-nodes-base.code
- **Mode:** runOnceForAllItems
- **Position:** [18432, 240] (where `Needs Email?` was)

**Logic (pseudocode):**
```
for each contact in $input.all():
  config = $('Step 4 Config').first().json

  // === EMAIL WATERFALL ===
  if contact needs email AND has domain AND has first_name:
    if !config.skip_hunter:
      result = await $http.request(Hunter Email Finder)
      parse hunter response → contact._hunter_email, _hunter_score, etc.

    if no email found yet AND !config.skip_snovio:
      result = await $http.request(Snov.io Email Finder)
      parse snovio response → contact._snovio_email

    contact._best_email = _hunter_email || _snovio_email
  else if contact already has email:
    contact._best_email = contact.email_business
  else:
    contact._best_email = null  // no domain/name → can't find email

  // === EMAIL VERIFICATION ===
  if contact._best_email AND !config.skip_hunter_verifier:
    result = await $http.request(Hunter Email Verifier)
    parse verifier response → contact._email_status, etc.

  // === NAMSOR ===
  if contact needs cultural_affinity AND has first+last name AND !config.skip_namsor:
    result = await $http.request(NamSor Origin)
    parse namsor response → contact._cultural_affinity, etc.

  // === BUILD UPDATE PAYLOAD ===
  build contact._update_payload from enrichment results

  add to results[]

return results
```

### 4.2 Update Contacts in Supabase (HTTP Request)

- **Type:** n8n-nodes-base.httpRequest
- **Method:** PATCH
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/contacts?id=eq.{{ $json._contact_id }}`
- **Headers:** Same as current `Update Contact in Supabase`
- **Body:** `={{ JSON.stringify($json._update_payload) }}`
- **Batching:** `{ "batch": { "batchSize": 10, "batchInterval": 500 } }`
- **onError:** continueRegularOutput
- **Position:** [18880, 240]
- **Note:** Only contacts with `_has_updates = true` should reach this node. Add an IF node before it or filter in the preceding Code node.

Actually — simpler: add an IF node `Has Updates?` between Enrich and Update, same as current. This keeps the pattern clean and avoids unnecessary API calls.

**Revised node chain:**
```
Batch Empty?3 → (FALSE) → Enrich Contacts → Has Updates? → (TRUE) → Update Contacts in Supabase → Run Summary4
                                                          → (FALSE) → Run Summary4
```

Wait — that reintroduces convergence at Run Summary4. Instead:

**Final node chain (zero convergence):**
```
Batch Empty?3 → (FALSE) → Enrich Contacts → Update Contacts in Supabase → Run Summary4
```

The `Enrich Contacts` Code node will filter out contacts with no updates and set `_update_payload = null`. The `Update Contacts in Supabase` HTTP node will be preceded by a filter inside the Code node — we return only contacts that have updates, with a `_has_updates` flag. We use a Split In Batches approach:

Actually the simplest clean approach: The `Enrich Contacts` Code node outputs ALL contacts with their enrichment data. Then we add a simple IF to filter, but feed BOTH outputs to Run Summary4 first — no, that's convergence again.

**Truly zero-convergence approach:**

```
Batch Empty?3 → (FALSE) → Enrich Contacts → Run Summary4
```

- `Enrich Contacts` does ALL the work: enrichment + Supabase updates (via `$http.request` inside the loop)
- `Run Summary4` just tallies the results

This is the cleanest. The Code node handles everything including the PATCH calls.

### 4.3 Run Summary4 (Code Node)

- **Type:** n8n-nodes-base.code
- **Mode:** runOnceForAllItems
- **Position:** [18880, 240]

Takes the enriched contacts output from `Enrich Contacts` and produces the same summary format as the current Run Summary4.

---

## 5. Enrich Contacts — Full Code Specification

```javascript
// Enrich Contacts — Single Code node replacing the entire Step 4 branching pipeline
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

  // ═══════════════════════════════════════
  // EMAIL WATERFALL
  // ═══════════════════════════════════════

  if (needsEmail && hasDomainAndName) {
    // --- HUNTER EMAIL FINDER ---
    if (config.skip_hunter !== 'true') {
      try {
        const hunterUrl = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(contact._company_domain)}&first_name=${encodeURIComponent(contact.first_name)}&last_name=${encodeURIComponent(contact.last_name || '')}&api_key=${$env.HUNTER_API_KEY}`;
        const hunterResp = await $http.request({ method: 'GET', url: hunterUrl, headers: { 'Accept': 'application/json' } });
        const hData = hunterResp.data || hunterResp;
        if (hData && hData.email && hData.score >= 50) {
          contact._hunter_email = hData.email;
          contact._hunter_score = hData.score || 0;
          contact._hunter_linkedin = hData.linkedin_url || null;
          contact._hunter_phone = hData.phone_number || null;
          contact._email_source = 'hunter';
        }
        await delay(200); // Rate limit
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
        const emails = snovResp.emails || snovResp.data?.emails || [];
        if (Array.isArray(emails) && emails.length > 0) {
          const valid = emails.find(e => e.emailStatus === 'valid' || e.status === 'valid') || emails[0];
          contact._snovio_email = valid.email || valid.value || null;
          if (contact._snovio_email) contact._email_source = 'snovio';
        }
        await delay(500); // Rate limit
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
    try {
      const verifyUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(contact._best_email)}&api_key=${$env.HUNTER_API_KEY}`;
      const verifyResp = await $http.request({ method: 'GET', url: verifyUrl, headers: { 'Accept': 'application/json' } });
      const vData = verifyResp.data || verifyResp;
      if (vData && vData.status) {
        switch (vData.status) {
          case 'valid': contact._email_status = 'verified'; break;
          case 'invalid': contact._email_status = 'invalid'; break;
          case 'accept_all': contact._email_status = 'accept_all'; break;
          case 'disposable': contact._email_status = 'invalid'; break;
          case 'webmail': contact._email_status = 'verified'; break;
          default: contact._email_status = 'risky'; break;
        }
        contact._email_verified_at = new Date().toISOString();
        contact._verifier_score = vData.score || null;
      }
      await delay(700); // Rate limit
    } catch(e) {
      console.log(`Verifier error for ${contact._best_email}: ${e.message}`);
      contact._email_status = 'unverified';
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
      await delay(100); // Rate limit
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
    } catch(e) {
      console.log(`Supabase update error for ${contact.id}: ${e.message}`);
      contact._update_error = e.message;
    }
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

return results;
```

---

## 6. Validation Strategy

### Test Plan

1. **Structural test (zero credits):** Set ALL skip toggles to `true`. Run workflow.
   - Expect: All contacts pass through with no API calls, all fields null, no updates.

2. **Hunter only test:** Set `skip_hunter=false`, all others `true`. Batch size 3.
   - Expect: Hunter API called for each contact with domain+name. Emails found where available.

3. **Full pipeline test:** All toggles `false`. Batch size 5.
   - Expect: Hunter → Snov.io fallback → Verifier → NamSor for each contact.

4. **Verification counts:** After full test, query:
   ```sql
   SELECT email_status, COUNT(*) FROM contacts
   WHERE email_status IS NOT NULL GROUP BY email_status;
   ```

### Expected Results (batch of 13 contacts)

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Contacts processed | 1 | 13 |
| Hunter API calls | 1 | up to 13 |
| Emails found | 0-1 | varies |
| Emails verified | 0-1 | all found emails |
| NamSor calls | 1 | up to 13 |
| Supabase updates | 1 | up to 13 |

---

## 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `$http.request()` not available in Code node | LOW | n8n v1.x supports this; verify with test |
| API rate limiting hit with sequential calls | MEDIUM | Delays between calls (200-700ms). Batch size config limits total calls per run |
| Code node timeout for large batches | MEDIUM | n8n default timeout is 300s. With delays, 13 contacts ≈ 30s. Keep batch_size ≤ 50 |
| Snov.io auth differs from current implementation | LOW | Verify Snov.io auth method — may need API key in body |
| Error in one contact kills entire batch | LOW | try/catch around each API call. Errors logged, processing continues |

---

## 8. Issues NOT Addressed (Future Work)

| Issue | Reason |
|-------|--------|
| ISSUE-004: Step 2 .item.json | Step 2 works; fix when it breaks |
| ISSUE-005: Contact dedup | Requires schema migration |
| ISSUE-006: Role-based emails | Requires validation code changes across 5 nodes |
| ISSUE-009: 5-path convergence (Step 3a) | Step 3a works; cosmetic issue |
| ISSUE-010: Booking domains | Requires domain blocklist logic |
| ISSUE-011: Company email column | Requires schema migration |
| ISSUE-013: 5x Validate copies | Cosmetic; addressed when fixing ISSUE-009 |
| ISSUE-014: CHECK constraint | Schema migration; no current breakage |
| ISSUE-015: Bridge nodes | Cosmetic |
