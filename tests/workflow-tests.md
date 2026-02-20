# Workflow Test Cases

## Pre-Run Checks
Before executing any workflow, verify:
- [ ] All `skip_*` toggles are correctly set in Config nodes
- [ ] Batch size is appropriate (5-10 for testing, 50 for production)
- [ ] Environment variables are set in n8n (check with a simple HTTP node to Supabase)

## Post-Run SQL Validation Queries

### Basic Integrity
```sql
-- Contact count and enrichment coverage
SELECT
  COUNT(*) AS total_contacts,
  COUNT(email_business) AS has_email,
  COUNT(phone_direct) AS has_phone,
  COUNT(linkedin_url) AS has_linkedin,
  COUNT(cultural_affinity) AS has_cultural_affinity
FROM contacts;

-- Email verification status breakdown
SELECT email_status, COUNT(*) AS total,
  COUNT(email_business) AS has_email,
  COUNT(email_verified_at) AS has_verified_at
FROM contacts GROUP BY email_status;

-- No duplicate contacts
SELECT company_id, first_name, last_name, COUNT(*) AS dupes
FROM contacts GROUP BY company_id, first_name, last_name
HAVING COUNT(*) > 1;

-- No bad phones
SELECT first_name, last_name, phone_direct
FROM contacts
WHERE phone_direct IS NOT NULL
  AND (LENGTH(phone_direct) < 12 OR LENGTH(phone_direct) > 12);

-- Source distribution
SELECT source, COUNT(*) FROM contacts GROUP BY source;
```

## Test Scenarios

### Scenario 1: Contacts with email — should verify
- **Setup:** Contact has email_business, email_status = 'unverified'
- **Config:** skip_hunter_verifier = 'false'
- **Expected:** email_status changes to verified/invalid/risky/accept_all, email_verified_at populated
- **Verify:** `SELECT * FROM contacts WHERE email_verified_at IS NOT NULL`

### Scenario 2: Contacts without email, with domain+name — should find
- **Setup:** Contact has first_name + company has domain, no email_business
- **Config:** skip_hunter = 'false'
- **Expected:** Hunter Finder attempts email lookup. If found, email_business populated.
- **Verify:** `SELECT * FROM contacts WHERE email_business IS NOT NULL AND source != 'apollo'`

### Scenario 3: Contacts without domain or name — should skip gracefully
- **Setup:** solo_detection contact, no first_name or company domain
- **Expected:** Passes through all email steps without error, gets NamSor if has name
- **Verify:** No errors in execution log

### Scenario 4: Invalid email found by verifier
- **Setup:** Contact with email that Hunter marks invalid
- **Expected:** email_business = NULL, email_status = 'invalid', email_verified_at populated
- **Verify:** `SELECT * FROM contacts WHERE email_status = 'invalid'`

### Scenario 5: All APIs disabled
- **Setup:** All skip_* = 'true'
- **Expected:** Workflow completes with no API calls, no changes to contacts
- **Verify:** Hunter dashboard shows no new credits used

### Scenario 6: Duplicate prevention on re-run
- **Setup:** Run same metro twice
- **Expected:** No duplicate contacts created
- **Verify:** Duplicate query returns 0 rows

## Credit Tracking
After each test run, check:
- Hunter.io dashboard: credits used
- NamSor dashboard: credits used
- Apollo dashboard: credits used
