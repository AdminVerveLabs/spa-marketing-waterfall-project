# Spa Marketing Waterfall — Step 4 Handoff Doc
## For Claude Code / Next Developer

---

## 1. Project Overview

**What:** Automated lead discovery and enrichment pipeline for massage therapy clinics across US metro areas.

**Who:** Zack, building for VerveLabs.

**Stack:** Hetzner VPS → Coolify → self-hosted n8n → Supabase (Postgres). APIs: Google Places, Apify (Yelp), Apollo.io, Hunter.io, NamSor, Snov.io (future).

**Pipeline Steps:**
1. **Step 1:** Business discovery (Google Places + Apify/Yelp) → companies table
2. **Step 2:** Company enrichment (website analysis, booking platform detection, social media extraction) → companies table
3. **Step 3a:** Find people (Apollo search/enrich, solo detection, website scrape, about page) → contacts table
4. **Step 4:** Enrich people (Hunter email finder, Snov.io fallback, Hunter email verifier, NamSor cultural affinity) → contacts table
5. **Step 5:** Scoring (future)

**Steps 1-3a are working.** Step 4 has a critical n8n batching bug (see Section 6).

---

## 2. Current Supabase Schema

### Companies Table
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,                    -- E.164 format, primary dedup key
  domain TEXT,                   -- Secondary dedup key
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  google_place_id TEXT,
  category TEXT,
  estimated_size TEXT CHECK (estimated_size IN ('solo', 'small', 'medium', NULL)),
  has_website BOOLEAN DEFAULT FALSE,
  has_online_booking BOOLEAN DEFAULT FALSE,
  booking_platform TEXT,
  has_paid_ads BOOLEAN DEFAULT FALSE,
  on_groupon BOOLEAN DEFAULT FALSE,
  on_yelp BOOLEAN DEFAULT FALSE,
  google_review_count INTEGER DEFAULT 0,
  google_rating DECIMAL(2,1),
  source_urls JSONB DEFAULT '[]'::jsonb,
  enrichment_status TEXT DEFAULT 'discovered'
    CHECK (enrichment_status IN ('discovered', 'partially_enriched', 'fully_enriched', 'needs_review')),
  lead_score INTEGER DEFAULT 0,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Unique indexes: phone, domain, google_place_id
```

### Contacts Table
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'unknown' CHECK (role IN ('owner', 'practitioner', 'manager', 'unknown')),
  is_owner BOOLEAN DEFAULT FALSE,
  email_business TEXT,
  email_personal TEXT,
  phone_direct TEXT,
  linkedin_url TEXT,
  location TEXT,
  cultural_affinity TEXT,
  source TEXT CHECK (source IN ('apollo', 'website', 'google', 'manual', 'other', 'solo_detection')),
  -- Added by Layer 2:
  email_status TEXT DEFAULT 'unverified'
    CHECK (email_status IN ('unverified', 'verified', 'invalid', 'risky', 'accept_all')),
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Social Profiles Table
```sql
CREATE TABLE social_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'x', 'linkedin', 'youtube')),
  profile_url TEXT NOT NULL,
  follower_count INTEGER,
  post_count INTEGER,
  last_post_date DATE,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, platform)
);
```

---

## 3. Step 4 Logic (What It Should Do)

### Flow
```
Fetch contacts needing enrichment (batch)
  → Merge with company data (domain, phone, city)
  → For each contact:
      1. EMAIL WATERFALL (if missing email_business):
         a. Has domain + first_name? → Hunter Email Finder (1 credit)
         b. Hunter found? → Done. Hunter missed? → Snov.io fallback
         c. No domain or no name? → Skip email finder
      2. EMAIL VERIFICATION (if contact has any email):
         a. Hunter Email Verifier (1 credit) → returns status
         b. Map: valid→verified, invalid→invalid, accept_all→accept_all, 
            disposable→invalid, webmail→verified, unknown→risky
         c. If invalid: null out the email in DB
      3. NAMSOR (if missing cultural_affinity and has first_name):
         a. NamSor Origin API → country/region of origin
      4. PREPARE UPDATE:
         a. Build PATCH payload with only changed fields
         b. Validate phone (E.164 normalization)
         c. Include email_status + email_verified_at
      5. UPDATE: PATCH to Supabase
```

### Config Toggles (in Step 4 Config node)
- `batch_size`: "50" (string)
- `batch_offset`: "0"
- `skip_hunter`: "true"/"false" — Hunter Email Finder
- `skip_snovio`: "true"/"false" — Snov.io fallback
- `skip_hunter_verifier`: "true"/"false" — Hunter Email Verifier
- `skip_namsor`: "false" — NamSor (currently enabled)

### Supabase Access Pattern
All Supabase calls use HTTP Request nodes (not the n8n connector):
- Headers: `apikey` + `Authorization: Bearer` using `$env.SUPABASE_SERVICE_KEY`
- Upserts: `Prefer: resolution=merge-duplicates`
- Updates: PATCH with `Prefer: return=minimal`
- URL base: `$env.SUPABASE_URL`

---

## 4. Layer 1 Validation (Step 3a — WORKING)

Runs in "Validate & Clean Contact" code nodes (5 copies, one per contact path) before inserting to Supabase.

### Email Validation
- Lowercase, trim, regex format check
- Reject: noreply@, test@, example@, placeholder domains, disposable services (mailinator, guerrillamail, etc.), numeric-only local parts
- Reject role-based: info@, contact@, booking@, frontdesk@, hello@, support@, admin@, reservations@, appointments@, reception@, sales@, team@, office@, general@, enquiries@, help@

### Phone Validation
- Handle Apollo object format `{sanitized_number: "..."}` 
- Strip to digits, normalize E.164 (+1 + 10 digits for US/CA)
- Reject: <10 digits, invalid area codes (0xx, 1xx)
- Flag international (>11 digits) with `+` prefix

### Name Validation
- Strip Apollo obfuscation (* suffixes)
- Reject: single-char, numeric, junk names
- Reject credentials stored as names: Lmt, Cmt, Rmt, Bctmb, Mmp, Nctmb, etc.
- Title-case normalize

### LinkedIn Validation
- Must contain `linkedin.com/in/` for personal profiles
- Normalize http → https

### Audit Trail
- `_validation_flags` array logs every cleaning action per contact

---

## 5. Layer 2 Verification (Step 4 — CODE IS CORRECT, WIRING IS BROKEN)

### Hunter Email Verifier
- **Endpoint:** `GET https://api.hunter.io/v2/email-verifier?email={email}&api_key={key}`
- **Cost:** 1 credit per call
- **Response:** `{ data: { status, score, smtp_check, mx_records, ... } }`
- **Status mapping:**
  - `valid` → `verified`
  - `invalid` → `invalid` (also null out email_business)
  - `accept_all` → `accept_all`
  - `disposable` → `invalid`
  - `webmail` → `verified` (gmail/yahoo are fine for solo practitioners)
  - `unknown` → `risky`

### Hunter Email Finder
- **Endpoint:** `GET https://api.hunter.io/v2/email-finder?domain={domain}&first_name={first}&last_name={last}&api_key={key}`
- **Cost:** 1 credit per call (0.5 if no result found per Hunter docs, but budget 1)
- **Score threshold:** Only accept emails with score >= 50

### NamSor Origin
- **Endpoint:** `GET https://v2.namsor.com/NamSorAPIv2/api2/json/origin/{firstName}/{lastName}`
- **Header:** `X-API-KEY: {key}`
- **Response:** `{ countryOrigin, regionOrigin, subRegionOrigin, probabilityCalibrated }`
- **Output format:** "Region / SubRegion / Country" e.g. "Europe / Northern Europe / GB"
- **Low confidence:** Append "(low confidence)" if probabilityCalibrated < 0.3

### Prepare Contact Update — Phone Validation
```javascript
function validatePhone(phone) {
  if (!phone) return null;
  if (typeof phone === 'object' && phone !== null) {
    phone = phone.sanitized_number || phone.raw_number || phone.number || '';
  }
  let cleaned = phone.toString().trim();
  cleaned = cleaned.replace(/[^\d]/g, '');
  if (!cleaned || cleaned.length === 0) return null;
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // already has country code
  } else if (cleaned.length === 10) {
    cleaned = '1' + cleaned;
  } else if (cleaned.length < 10) {
    return null;
  } else if (cleaned.length > 11) {
    return '+' + cleaned; // possibly international
  }
  const areaCode = cleaned.substring(1, 4);
  if (areaCode.startsWith('0') || areaCode.startsWith('1')) return null;
  return '+' + cleaned;
}
```

### Prepare Contact Update — Invalid Email Handling
If Hunter Verifier returns `invalid` or `disposable`:
- Set `email_business = null` in the PATCH payload
- Still set `email_status = 'invalid'` so we know it was checked
- Log the removal

### Filter Logic (which contacts need enrichment)
```javascript
const verifiedStatuses = ['verified', 'invalid', 'risky', 'accept_all'];
const emailNeedsVerification = c.email_business && !verifiedStatuses.includes(c.email_status);
// Also: missingEmail, missingPhone, missingLinkedin, missingCulturalAffinity
```

---

## 6. The n8n Bug (WHY Step 4 Needs Rebuilding)

### Problem
When multiple n8n paths converge on a single node (e.g., 3 branches feeding into one IF node), n8n creates separate "execution batches" per upstream path. Downstream nodes only pair with items from the LAST executing batch, causing:
- Item data loss (12 of 13 contacts lost their data)
- Incorrect item pairing (all items paired with Jenny Rice instead of their own data)
- Duplicate processing when trying to fix with Merge nodes

### What We Tried
1. **Direct convergence:** 3 paths → 1 IF node. Only last batch's items paired correctly.
2. **Merge (Append) nodes:** Added before every convergence point. Items duplicated across batches instead of consolidating.
3. **Code nodes with `$('NodeName').all()`:** Same duplication issue — `.all()` picks up items from ALL execution batches including duplicates.
4. **"Wait for All Inputs" on merge:** Option doesn't exist in this n8n version.

### What Works Fine
- Steps 1-3a (linear paths, no multi-path convergence issues)
- Run Summary nodes reading stats with `$('NodeName').all()` (read-only, doesn't matter if duplicated)
- The actual API calls and code logic are correct — only the n8n routing/batching fails

### Recommendation
Rebuild Step 4 as a standalone Node.js script that n8n calls via Execute Command. The waterfall logic is sequential with simple if/else branching — no need for visual workflow routing. n8n handles scheduling, the script handles logic.

---

## 7. Current Data State (Austin Test Data)

```
Companies: 58 discovered, 50+ enriched
Contacts: 47 total
  - 17 have email_business (all unverified except Jenny Rice = verified)
  - 41 have phone_direct
  - 22 have linkedin_url  
  - 31 have cultural_affinity
  - By source: 27 apollo, 18 solo_detection, 2 website

Contacts needing email finder (have name + domain, no email): 16
Contacts with no name at all (solo_detection): 13
```

### Hunter.io Credits
- Account has 50 total credits
- 1.5 used (1 verifier for Jenny Rice, 0.5 finder)
- ~48.5 remaining

---

## 8. Must-Fix Items

### 8.1 Contact Deduplication
**Problem:** No unique constraint on contacts. Re-running a metro creates duplicate contact rows.
**Fix:** 
```sql
-- Option A: DB constraint
ALTER TABLE contacts ADD CONSTRAINT unique_contact 
  UNIQUE NULLS NOT DISTINCT (company_id, first_name, last_name);

-- Option B: Check-before-insert in code
-- Query existing contacts for company_id before inserting
```

### 8.2 Company Email Column
**Problem:** No `email` column on companies table. Role-based emails (info@, contact@) are being rejected by Layer 1 validation, but for solo practitioners these ARE the business inbox.
**Fix:**
```sql
ALTER TABLE companies ADD COLUMN email TEXT;
```
**Logic change in Layer 1:** Instead of nulling role-based emails, move them to company.email. If role-based is the ONLY email and no personal email exists, keep it on the contact too.
**Data model:**
- `companies.email` = general business address (info@, contact@, or massageclinic@gmail.com)
- `contacts.email_business` = person's individual work email (jane@massageclinic.com)
- `contacts.email_personal` = personal email (jane.smith@gmail.com)

### 8.3 Booking Platform Domains  
**Problem:** Some companies have booking platform URLs stored as domain (e.g., `nonamecs4b.setmore.com`). Hunter Finder can't find emails for these.
**Fix in Step 2:** Detect and exclude booking platform URLs from domain field. Known platforms: setmore.com, acuity-scheduling.com, mindbodyonline.com, vagaro.com, square.site, schedulicity.com, booksy.com, fresha.com

### 8.4 Layer 1 Role-Based Email Handling
**Current:** Blanket rejection of role-based emails (info@, contact@, booking@, etc.)
**Needed:** Context-aware handling:
- If contact has BOTH a personal email AND a role-based email → move role-based to company.email, keep personal on contact
- If role-based is the ONLY email → keep it (it's better than nothing for outreach)
- Gmail/Yahoo/Outlook addresses → always keep (these are personal)

---

## 9. Environment Variables

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
HUNTER_API_KEY=xxx...272e
NAMSOR_API_KEY=xxx
SNOVIO_ACCESS_TOKEN=xxx (future)
APOLLO_API_KEY=xxx
```

---

## 10. Key n8n Patterns (for remaining n8n work in Steps 1-3a)

- **runOnceForEachItem:** Uses `$input.item.json` for current item, `$('NodeName').item.json` for paired upstream data. Returns `{json:...}` not `[{json:...}]`.
- **runOnceForAllItems:** Uses `$input.all()` or `$input.first().json`. Returns arrays.
- **IF nodes:** Always use `typeValidation: "loose"`.
- **HTTP nodes:** Use `onError: "continueRegularOutput"` to prevent single failures from breaking batches.
- **HTTP fullResponse:** Data is in `.data` not `.body`.
- **Supabase:** Use HTTP Request nodes (not n8n connector). Service key auth. `Prefer: resolution=merge-duplicates` for upserts.
- **User-Agent:** Website fetching requires Chrome UA string or most sites return empty.

---

## 11. Recommended Rebuild Approach for Step 4

### Option A: Node.js Script (Recommended)
```
n8n trigger → Execute Command: node /path/to/step4-enrich.js --batch-size 50
```
The script:
1. Fetches contacts + companies from Supabase (direct HTTP or pg client)
2. Filters to those needing enrichment
3. For each contact sequentially:
   - Email finder waterfall (Hunter → Snov.io)
   - Email verification (Hunter Verifier)
   - NamSor cultural affinity
   - Build update payload
   - PATCH to Supabase
4. Outputs summary JSON

Benefits: No batching issues, proper error handling, testable with `--dry-run`, debuggable with console.log.

### Option B: Stay in n8n (Not Recommended)
Would require avoiding all multi-path convergence — process contacts one at a time using n8n's Loop node, which is very slow for large batches.

---

## 12. Production Scaling Notes

- **Search diversity for 1000+ businesses:** Need multiple search terms per metro (service types, neighborhoods, modalities like "deep tissue," "prenatal massage," etc.)
- **API credit budgets per metro (~1000 businesses):**
  - Apollo: ~1000 searches + ~500 enrichments
  - Hunter Finder: ~300-500 calls
  - Hunter Verifier: ~500-700 calls  
  - NamSor: ~700 calls
- **Re-runs are safe:** Company dedup via unique indexes on phone/domain/google_place_id. Contact dedup needs the fix in 8.1.
- **Apify/Google Places:** Currently restricted to ~5 results for testing. Production: 20+ per query.
