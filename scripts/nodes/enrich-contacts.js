// Enrich Contacts — Modified to include inline Supabase fetch/merge
// Mode: runOnceForAllItems
// Input: { metro, company_ids } from upstream Find Contacts, OR main workflow trigger
// Output: enrichment results → Mark Fully Enriched (sub-workflow) or Run Summary4 (legacy)
//
// Previously depended on: Step 4 Config, Fetch Contacts, Fetch Companies1,
// Filter & Merge Contacts, Collapse to Single. Now handles all of that inline.

const inputData = $input.first().json;
// n8n Webhook v2 wraps POST body under .body; unwrap defensively
const payload = inputData.body || inputData;
const metro = payload.metro || payload.metro_name;
const companyIds = payload.company_ids || null;
if (!metro) {
  throw new Error('Enrich Contacts: missing metro in input. Expected metro or metro_name field.');
}
const supabaseUrl = $env.SUPABASE_URL;
const supabaseKey = $env.SUPABASE_SERVICE_KEY;
const sbHeaders = { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey };

// ═══ CONFIG (previously in Step 4 Config Set node) ═══
const config = {
  skip_hunter: 'false',
  skip_snovio: 'true',
  skip_hunter_verifier: 'false',
  skip_namsor: 'false',
  skip_phone_verifier: 'false',
  batch_size: '1000',
  batch_offset: '0'
};

// ═══ INLINE FETCH: Contacts needing enrichment ═══
// Batch mode: filter contacts to those belonging to batch companies
// Legacy mode: fetch all contacts globally (metro filtering happens downstream)
let contactsUrl;
if (companyIds && companyIds.length > 0) {
  contactsUrl = `${supabaseUrl}/rest/v1/contacts?company_id=in.(${companyIds.join(',')})&select=id,company_id,first_name,last_name,role,is_owner,email_business,email_personal,phone_direct,linkedin_url,cultural_affinity,source,email_status,phone_status,phone_line_type,phone_carrier&or=(email_status.is.null,email_status.eq.unverified,and(phone_direct.not.is.null,phone_status.is.null))&order=created_at.asc`;
} else {
  contactsUrl = `${supabaseUrl}/rest/v1/contacts?select=id,company_id,first_name,last_name,role,is_owner,email_business,email_personal,phone_direct,linkedin_url,cultural_affinity,source,email_status,phone_status,phone_line_type,phone_carrier&or=(email_status.is.null,email_status.eq.unverified,and(phone_direct.not.is.null,phone_status.is.null))&order=created_at.asc&limit=${config.batch_size}&offset=${config.batch_offset}`;
}

const rawContacts = await this.helpers.httpRequest({
  method: 'GET',
  url: contactsUrl,
  headers: sbHeaders,
  json: true
});

// ═══ INLINE FETCH: Companies for this metro/batch ═══
let companiesUrl;
if (companyIds && companyIds.length > 0) {
  companiesUrl = `${supabaseUrl}/rest/v1/companies?id=in.(${companyIds.join(',')})&select=id,name,phone,domain,email,email_status,phone_status,phone_line_type,city,state`;
} else {
  companiesUrl = `${supabaseUrl}/rest/v1/companies?select=id,name,phone,domain,email,email_status,phone_status,phone_line_type,city,state&enrichment_status=in.(partially_enriched,fully_enriched)&discovery_metro=eq.${encodeURIComponent(metro)}`;
}

const rawCompanies = await this.helpers.httpRequest({
  method: 'GET',
  url: companiesUrl,
  headers: sbHeaders,
  json: true
});

// ═══ INLINE: Filter & Merge Contacts ═══
// Deduplicate contacts by id
const seenIds = new Set();
let uniqueContacts = [];
if (Array.isArray(rawContacts)) {
  for (const c of rawContacts) {
    if (c.id && !seenIds.has(c.id)) {
      seenIds.add(c.id);
      uniqueContacts.push(c);
    }
  }
}

// Build company lookup map (metro-scoped)
const companyMap = {};
if (Array.isArray(rawCompanies)) {
  for (const co of rawCompanies) {
    if (co.id) companyMap[co.id] = co;
  }
}

// Filter contacts that need enrichment
const needsEnrichment = uniqueContacts.filter(c => {
  const missingEmail = !c.email_business;
  const missingCulturalAffinity = !c.cultural_affinity;
  const missingPhone = !c.phone_direct;
  const missingLinkedin = !c.linkedin_url;
  const verifiedStatuses = ['verified', 'invalid', 'risky', 'accept_all'];
  const emailNeedsVerification = c.email_business && !verifiedStatuses.includes(c.email_status);
  const phoneNeedsVerification = c.phone_direct && !c.phone_status;
  return missingEmail || missingCulturalAffinity || missingPhone || missingLinkedin || emailNeedsVerification || phoneNeedsVerification;
});

// Metro filter: only keep contacts whose company is in the metro-scoped companyMap
const metroFiltered = needsEnrichment.filter(c => companyMap[c.company_id]);
const crossMetroSkipped = needsEnrichment.length - metroFiltered.length;

console.log(`Contacts: ${uniqueContacts.length} unique, ${needsEnrichment.length} need enrichment, ${crossMetroSkipped} skipped (other metro), ${metroFiltered.length} in current metro`);

if (metroFiltered.length === 0) {
  return [{ json: { _empty: true, _count: 0, _message: 'All contacts are already enriched or belong to other metros' } }];
}

// Merge company data into each contact
const contacts = metroFiltered.map(c => {
  const company = companyMap[c.company_id];
  return {
    json: {
      ...c,
      _company_name: company.name || null,
      _company_domain: company.domain || null,
      _company_phone: company.phone || null,
      _company_email: company.email || null,
      _company_email_status: company.email_status || null,
      _company_phone_status: company.phone_status || null,
      _company_phone_line_type: company.phone_line_type || null,
      _company_city: company.city || null,
      _company_state: company.state || null
    }
  };
});

// ═══ ENRICHMENT PIPELINE (unchanged from original Enrich Contacts node) ═══

const results = [];

// Helper: delay between API calls for rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Dedup guard: track companies that already had email set/verified this execution
// Batch mode: use local object (parallel sub-workflow executions don't share state safely)
// Legacy mode: use static data with BUG-F019 cleanup
let companyEmailsSet;
if (companyIds && companyIds.length > 0) {
  // Batch mode: local dedup — each sub-workflow execution is independent
  companyEmailsSet = {};
} else {
  // Legacy mode: static data dedup (ADR-015)
  const staticData = $getWorkflowStaticData('global');
  if (!staticData._companyEmailsSet) staticData._companyEmailsSet = {};
  companyEmailsSet = staticData._companyEmailsSet;
  // BUG-F019 FIX: Clear ALL stale keys from previous executions.
  for (const key of Object.keys(companyEmailsSet)) {
    delete companyEmailsSet[key];
  }
}

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
  else if (cleaned.length > 11 && cleaned.length <= 15) {
    if (cleaned.startsWith('1')) return null;
    return '+' + cleaned;
  }
  else if (cleaned.length > 15) { return null; }
  const areaCode = cleaned.substring(1, 4);
  if (areaCode.startsWith('0') || areaCode.startsWith('1')) return null;
  return '+' + cleaned;
}

// Role-based email detection
const rolePatterns = [
  /^info@/i, /^contact@/i, /^hello@/i, /^support@/i, /^sales@/i,
  /^office@/i, /^billing@/i, /^reception@/i, /^frontdesk@/i, /^front\.desk@/i,
  /^appointments@/i, /^booking@/i, /^bookings@/i, /^schedule@/i, /^scheduling@/i,
  /^inquiries@/i, /^inquiry@/i, /^general@/i, /^team@/i, /^staff@/i
];

function isRoleBased(email) {
  if (!email) return false;
  return rolePatterns.some(p => p.test(email));
}

const freeWebmailDomains = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'live.com', 'msn.com',
  'protonmail.com', 'proton.me', 'zoho.com', 'yandex.com',
  'mail.com', 'gmx.com', 'fastmail.com', 'tutanota.com'
];

function isFreeWebmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  return freeWebmailDomains.includes(domain);
}

// Helper: verify an email via Hunter Verifier API
async function verifyEmail(email) {
  try {
    const verifyUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${$env.HUNTER_API_KEY}`;
    const verifyResp = await this.helpers.httpRequest({ method: 'GET', url: verifyUrl, headers: { 'Accept': 'application/json' }, json: true });
    const vBody = verifyResp.data || verifyResp;
    if (vBody && vBody.status) {
      let status;
      switch (vBody.status) {
        case 'valid': status = 'verified'; break;
        case 'invalid': status = 'invalid'; break;
        case 'accept_all': status = 'accept_all'; break;
        case 'disposable': status = 'invalid'; break;
        case 'webmail': status = 'verified'; break;
        default: status = 'risky'; break;
      }
      return { status, score: vBody.score || null, verified_at: new Date().toISOString() };
    }
  } catch(e) {
    console.log(`Verifier error for ${email}: ${e.message}`);
  }
  return null;
}

// Helper: verify a phone number via Telnyx Number Lookup API
async function verifyPhone(phoneNumber) {
  try {
    const resp = await this.helpers.httpRequest({
      method: 'GET',
      url: `https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(phoneNumber)}?type=carrier`,
      headers: {
        'Authorization': `Bearer ${$env.TELNYX_API_KEY}`,
        'Accept': 'application/json'
      },
      json: true
    });
    const data = resp.data || resp;
    if (data && data.valid === false) {
      return { phone_status: 'invalid', phone_line_type: null, phone_carrier: null };
    }
    let lineType = null;
    const carrierType = (data.carrier && data.carrier.type) || null;
    if (carrierType) {
      const typeMap = { 'mobile': 'mobile', 'landline': 'landline', 'fixed line': 'landline', 'voip': 'voip', 'toll free': 'toll_free', 'toll_free': 'toll_free' };
      lineType = typeMap[carrierType.toLowerCase()] || null;
    }
    const carrierName = (data.carrier && data.carrier.name) || null;
    const phoneStatus = lineType === 'voip' ? 'voip' : 'valid';
    return {
      phone_status: phoneStatus,
      phone_line_type: lineType,
      phone_carrier: carrierName
    };
  } catch(e) {
    if (e.statusCode === 404 || e.statusCode === 422) {
      return { phone_status: 'invalid', phone_line_type: null, phone_carrier: null };
    }
    console.log(`Telnyx error for ${phoneNumber}: ${e.message} (status: ${e.statusCode || 'unknown'})`);
    return { phone_status: null, phone_line_type: null, phone_carrier: null, _error: `${e.statusCode || 'unknown'}: ${e.message}` };
  }
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
  contact._company_email_routed = false;
  contact._company_email_verified = false;
  contact._phone_status = null;
  contact._phone_line_type = null;
  contact._phone_carrier = null;
  contact._company_phone_verified = false;
  contact._phone_error = null;

  const needsEmail = !contact.email_business;
  const hasDomainAndName = contact._company_domain && contact.first_name;
  const verifiedStatuses = ['verified', 'invalid', 'risky', 'accept_all'];
  const emailNeedsVerification = contact.email_business && !verifiedStatuses.includes(contact.email_status);

  // EMAIL WATERFALL

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

  // COMPANY EMAIL ROUTING
  if (contact._best_email && isRoleBased(contact._best_email) && !isFreeWebmail(contact._best_email)) {
    const companyId = contact.company_id;
    const companyHasEmail = !!(contact._company_email);

    if (!companyHasEmail && !companyEmailsSet[companyId]) {
      contact._routed_company_email = contact._best_email;
      contact._company_email_routed = true;
      companyEmailsSet[companyId] = contact._best_email;
      console.log(`Routed role-based email ${contact._best_email} to company ${contact._company_name || companyId}`);
    }

    if (contact.email_personal) {
      contact._best_email = contact.email_personal;
      contact._email_source = 'personal_promoted';
      console.log(`Promoted personal email ${contact.email_personal} for ${contact.first_name} (role-based went to company)`);
    }
  }

  // EMAIL VERIFICATION (contact email)
  if (contact._best_email && config.skip_hunter_verifier !== 'true') {
    const shouldVerify = !contact.email_business || emailNeedsVerification || contact._email_source === 'hunter' || contact._email_source === 'snovio' || contact._email_source === 'personal_promoted';
    if (shouldVerify) {
      const vResult = await verifyEmail.call(this, contact._best_email);
      if (vResult) {
        contact._email_status = vResult.status;
        contact._email_verified_at = vResult.verified_at;
        contact._verifier_score = vResult.score;
      }
      await delay(700);
    }
  } else if (contact._best_email) {
    contact._email_status = 'unverified';
  }

  // COMPANY EMAIL VERIFICATION
  const companyEmailToVerify = contact._routed_company_email || contact._company_email;
  const companyEmailNeedsVerification = companyEmailToVerify && !contact._company_email_status;
  const companyId = contact.company_id;

  if (companyEmailNeedsVerification && config.skip_hunter_verifier !== 'true' && !companyEmailsSet[companyId + '_verified']) {
    const vResult = await verifyEmail.call(this, companyEmailToVerify);
    let companyPatch = {};

    if (contact._routed_company_email) {
      companyPatch.email = contact._routed_company_email;
    }

    if (vResult) {
      companyPatch.email_status = vResult.status;
      contact._company_email_verified = true;
      console.log(`Verified company email ${companyEmailToVerify}: ${vResult.status}`);
    }

    if (Object.keys(companyPatch).length > 0) {
      try {
        await this.helpers.httpRequest({
          method: 'PATCH',
          url: `${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`,
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: companyPatch,
          json: true
        });
        console.log(`PATCHed company ${contact._company_name || companyId}: ${JSON.stringify(companyPatch)}`);
      } catch(e) {
        console.log(`Company PATCH error for ${companyId}: ${e.message}`);
      }
    }

    companyEmailsSet[companyId + '_verified'] = true;
    await delay(700);
  } else if (contact._routed_company_email && !companyEmailsSet[companyId + '_verified']) {
    try {
      await this.helpers.httpRequest({
        method: 'PATCH',
        url: `${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`,
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: { email: contact._routed_company_email },
        json: true
      });
      console.log(`PATCHed company email (unverified) ${contact._company_name || companyId}: ${contact._routed_company_email}`);
    } catch(e) {
      console.log(`Company PATCH error for ${companyId}: ${e.message}`);
    }
    companyEmailsSet[companyId + '_verified'] = true;
    await delay(50);
  }

  // NAMSOR CULTURAL AFFINITY
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

  // PHONE VERIFICATION (Telnyx Number Lookup)
  if (contact._best_phone && !contact.phone_status && config.skip_phone_verifier !== 'true') {
    const phoneResult = await verifyPhone.call(this, contact._best_phone);
    if (phoneResult) {
      contact._phone_status = phoneResult.phone_status;
      contact._phone_line_type = phoneResult.phone_line_type;
      contact._phone_carrier = phoneResult.phone_carrier;
      if (phoneResult._error) {
        contact._phone_error = phoneResult._error;
      } else {
        console.log(`Phone verified ${contact._best_phone}: ${phoneResult.phone_status} (${phoneResult.phone_line_type || 'unknown type'}, ${phoneResult.phone_carrier || 'unknown carrier'})`);
      }
    }
    await delay(100);
  }

  // COMPANY PHONE VERIFICATION (Telnyx)
  if (contact._company_phone && !contact._company_phone_status && config.skip_phone_verifier !== 'true' && !companyEmailsSet[companyId + '_phone_verified']) {
    const compPhoneResult = await verifyPhone.call(this, contact._company_phone);
    if (compPhoneResult && !compPhoneResult._error) {
      try {
        await this.helpers.httpRequest({
          method: 'PATCH',
          url: `${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`,
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: {
            phone_status: compPhoneResult.phone_status,
            phone_line_type: compPhoneResult.phone_line_type
          },
          json: true
        });
        contact._company_phone_verified = true;
        console.log(`Company phone verified ${contact._company_phone}: ${compPhoneResult.phone_status} (${compPhoneResult.phone_line_type || 'unknown'})`);
      } catch(e) {
        console.log(`Company phone PATCH error for ${companyId}: ${e.message}`);
      }
    } else if (compPhoneResult && compPhoneResult._error) {
      contact._phone_error = contact._phone_error || compPhoneResult._error;
    }
    companyEmailsSet[companyId + '_phone_verified'] = true;
    await delay(100);
  }

  // BUILD UPDATE PAYLOAD
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

  // Phone verification fields
  if (contact._phone_status) {
    update.phone_status = contact._phone_status;
    update.phone_verified_at = new Date().toISOString();
    update.phone_line_type = contact._phone_line_type;
    update.phone_carrier = contact._phone_carrier;
    if (contact._phone_status === 'invalid' || contact._phone_status === 'disconnected') {
      update.phone_direct = null;
    }
  }

  contact._update_payload = Object.keys(update).length > 0 ? update : null;
  contact._has_updates = Object.keys(update).length > 0;

  // SUPABASE UPDATE (inline)
  if (contact._has_updates) {
    try {
      await this.helpers.httpRequest({
        method: 'PATCH',
        url: `${supabaseUrl}/rest/v1/contacts?id=eq.${contact.id}`,
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
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
      _company_email_routed: contact._company_email_routed,
      _company_email_verified: contact._company_email_verified,
      _routed_company_email: contact._routed_company_email || null,
      _phone_status: contact._phone_status,
      _phone_line_type: contact._phone_line_type,
      _phone_carrier: contact._phone_carrier,
      _company_phone_verified: contact._company_phone_verified,
      _phone_error: contact._phone_error,
      _update_error: contact._update_error || null
    }
  });
}

if (results.length === 0) {
  return [{ json: { _empty: true, _count: 0, metro, company_ids: companyIds } }];
}

// Inject metro + company_ids into the first result item so downstream nodes can access them
if (results.length > 0) {
  results[0].json.metro = metro;
  results[0].json.company_ids = companyIds;
}

return results;
