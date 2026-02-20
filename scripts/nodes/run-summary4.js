// Run Summary4 — Modified to use embedded config instead of $('Step 4 Config')
// Mode: runOnceForAllItems
// Input: enrichment results from Enrich Contacts
// Output: summary → Calculate Lead Scores

// Embedded config (previously from Step 4 Config Set node)
const config = {
  skip_hunter: 'false',
  skip_snovio: 'true',
  skip_hunter_verifier: 'false',
  skip_namsor: 'false',
  skip_phone_verifier: 'false',
  batch_size: '1000',
  batch_offset: '0'
};

const items = $input.all();

let totalProcessed = 0;
let emailsFound = 0;
let emailsFromHunter = 0;
let emailsFromSnovio = 0;
let emailsExisting = 0;
let emailsPersonalPromoted = 0;
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

// Company email routing stats
let companyEmailsRouted = 0;
let companyEmailsVerified = 0;

// Phone verification stats
let phonesVerifiedValid = 0;
let phonesInvalidRemoved = 0;
let phonesVoipFlagged = 0;
let phonesDisconnectedRemoved = 0;
let companyPhonesVerified = 0;

for (const item of items) {
  const d = item.json;
  if (d._empty) continue;
  totalProcessed++;

  if (d._has_updates) contactsUpdated++;
  else contactsSkipped++;

  if (d._email_source === 'hunter') emailsFromHunter++;
  else if (d._email_source === 'snovio') emailsFromSnovio++;
  else if (d._email_source === 'existing') emailsExisting++;
  else if (d._email_source === 'personal_promoted') emailsPersonalPromoted++;

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

  if (d._company_email_routed) companyEmailsRouted++;
  if (d._company_email_verified) companyEmailsVerified++;
  if (d._update_error) updateErrors++;

  // Phone verification stats
  if (d._phone_status) {
    switch (d._phone_status) {
      case 'valid': phonesVerifiedValid++; break;
      case 'invalid': phonesInvalidRemoved++; break;
      case 'voip': phonesVoipFlagged++; break;
      case 'disconnected': phonesDisconnectedRemoved++; break;
    }
  }
  if (d._company_phone_verified) companyPhonesVerified++;
}

const summary = {
  run_completed_at: new Date().toISOString(),
  config: {
    batch_size: config.batch_size,
    hunter_finder_enabled: config.skip_hunter !== 'true',
    hunter_verifier_enabled: config.skip_hunter_verifier !== 'true',
    snovio_enabled: config.skip_snovio !== 'true',
    namsor_enabled: config.skip_namsor !== 'true',
    phone_verifier_enabled: config.skip_phone_verifier !== 'true'
  },
  contacts_processed: totalProcessed,
  contacts_updated: contactsUpdated,
  contacts_no_changes: contactsSkipped,
  update_errors: updateErrors,
  email_enrichment: {
    new_emails_found: emailsFound,
    from_hunter: emailsFromHunter,
    from_snovio: emailsFromSnovio,
    personal_promoted: emailsPersonalPromoted,
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
  company_email_routing: {
    role_based_routed_to_company: companyEmailsRouted,
    company_emails_verified: companyEmailsVerified
  },
  phone_verification: {
    verified_valid: phonesVerifiedValid,
    invalid_removed: phonesInvalidRemoved,
    voip_flagged: phonesVoipFlagged,
    disconnected_removed: phonesDisconnectedRemoved,
    company_phones_verified: companyPhonesVerified
  },
  phone_enrichment: { phones_added: phonesEnriched },
  linkedin_enrichment: { linkedin_added: linkedinEnriched },
  namsor_enrichment: { names_sent: namsorProcessed, cultural_affinity_set: namsorSuccess },
  message: `Processed ${totalProcessed} contacts. Updated ${contactsUpdated} (${emailsFound} emails, ${phonesEnriched} phones, ${linkedinEnriched} LinkedIn, ${namsorSuccess} cultural affinity). Email verification: ${emailsVerified} valid, ${emailsInvalid} invalid, ${emailsRisky} risky, ${emailsAcceptAll} accept_all. Phone verification: ${phonesVerifiedValid} valid, ${phonesInvalidRemoved} invalid removed, ${phonesVoipFlagged} voip, ${phonesDisconnectedRemoved} disconnected removed, ${companyPhonesVerified} company phones. Company emails: ${companyEmailsRouted} routed, ${companyEmailsVerified} verified. ${contactsSkipped} no changes. ${updateErrors} errors.`
};

console.log('=== STEP 4: ENRICH PEOPLE SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

return [{ json: summary }];
