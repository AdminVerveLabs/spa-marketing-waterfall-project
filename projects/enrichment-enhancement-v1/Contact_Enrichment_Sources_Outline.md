# Contact Enrichment: 5 New Sources

## Where This Fits

These 5 sources extend **Step 3a (Find People)** in the waterfall. Currently Step 3a runs:

1. Solo Detection (name from business name)
2. Apollo People Search (by domain)
3. Website Scrape (/about, /team pages)

The new sources slot in **after** the existing waterfall, so we only burn API calls / scrape effort on companies where Apollo and website scraping came up empty. The flow becomes:

```
Solo Detection → Apollo → Website Scrape → Hunter.io → Google Business Profile → Facebook → Yelp → State Licensing
```

Each source writes to the same `contacts` table with `source` tracking where the data came from. Update the `source` CHECK constraint first:

```sql
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_source_check
  CHECK (source IN ('apollo', 'website', 'google', 'manual', 'other',
                    'hunter', 'google_reviews', 'facebook', 'yelp', 'licensing_board'));
```

---

## Source 1: Hunter.io

### What It Gives You
- Email addresses associated with a domain
- Email pattern for the domain (e.g., `{first}@domain.com`)
- Individual people found at the domain (name + email + position)
- Confidence score per email
- Email verification status

### API Details
- **Endpoint:** `https://api.hunter.io/v2/domain-search`
- **Auth:** API key as query param `?api_key=YOUR_KEY`
- **Rate limit:** 10 requests/second (free), 15/sec (paid)
- **Pricing:** Free = 25 searches/mo. Starter = $49/mo for 500 searches. Growth = $149/mo for 5,000.
- **Docs:** https://hunter.io/api-documentation/v2

### n8n Implementation

**Input filter:** Only run for companies where `domain IS NOT NULL` AND no contact email has been found yet.

```
IF node: domain exists AND no contact with email → proceed
```

**HTTP Request node:**
```
GET https://api.hunter.io/v2/domain-search
Query params:
  domain: {{ $json.domain }}
  api_key: YOUR_HUNTER_API_KEY
  limit: 5
```

**Response parsing (Code node):**
```javascript
const data = $input.item.json;
const response = data.data || data;
const results = response.emails || [];
const pattern = response.pattern || null;
const companyId = data.company_id;
const domain = data.domain;

const contacts = [];

for (const person of results) {
  // Skip generic emails (info@, hello@, contact@)
  const email = person.value || '';
  if (/^(info|hello|contact|admin|support|office|mail|booking|appointments)@/i.test(email)) {
    continue;
  }

  contacts.push({
    json: {
      company_id: companyId,
      first_name: person.first_name || null,
      last_name: person.last_name || null,
      email_business: email,
      role: inferRole(person.position, person.seniority),
      is_owner: isLikelyOwner(person.position, person.seniority),
      source: 'hunter',
      confidence: person.confidence || null,
    }
  });
}

// If no people found but we have a pattern, store it for later use
if (contacts.length === 0 && pattern) {
  contacts.push({
    json: {
      company_id: companyId,
      email_pattern: pattern,  // e.g., "{first}@domain.com"
      source: 'hunter',
      note: 'pattern_only',
    }
  });
}

function inferRole(position, seniority) {
  if (!position) return 'unknown';
  const p = position.toLowerCase();
  if (p.includes('owner') || p.includes('founder') || p.includes('ceo') || p.includes('principal')) return 'owner';
  if (p.includes('manager') || p.includes('director')) return 'manager';
  if (p.includes('therapist') || p.includes('lmt') || p.includes('rmt')) return 'practitioner';
  return 'unknown';
}

function isLikelyOwner(position, seniority) {
  if (!position && !seniority) return false;
  const p = (position || '').toLowerCase();
  const s = (seniority || '').toLowerCase();
  return p.includes('owner') || p.includes('founder') || p.includes('ceo')
    || p.includes('principal') || s === 'senior';
}

return contacts.length > 0 ? contacts : [{ json: { company_id: companyId, no_results: true } }];
```

**Write to Supabase:** Upsert best contact found. If company already has a contact without email, update the existing contact with the email rather than creating a duplicate.

### Cost Estimate
- ~700 companies with domains across current metros
- At Starter tier ($49/mo for 500): covers one full batch per month
- Per-lookup: ~$0.10

### Expected Yield
- Hunter typically finds emails for 30-40% of small business domains
- Expect ~200-280 new emails from 700 domain lookups
- Much higher hit rate for businesses with real domains vs. Wix/Square sites

---

## Source 2: Google Business Profile (Review Mining)

### What It Gives You
- Owner name (from "owner response" on reviews)
- Sometimes owner photo/name from the business profile itself
- The Google Places API `reviews` field includes `author_name` for review responses

### API Details
- **Endpoint:** Google Places API — Place Details
- **You already have this** — you're using Google Places for Step 1 discovery and have the `google_place_id` stored
- **Specific field:** Request `reviews` field to get owner responses
- **Pricing:** Place Details = $17 per 1,000 calls. You're already paying for this.
- **Docs:** https://developers.google.com/maps/documentation/places/web-service/details

### n8n Implementation

**Input filter:** Companies with `google_place_id IS NOT NULL` AND no contact name found yet.

**HTTP Request node:**
```
GET https://maps.googleapis.com/maps/api/place/details/json
Query params:
  place_id: {{ $json.google_place_id }}
  fields: name,reviews
  key: YOUR_GOOGLE_API_KEY
```

**Response parsing (Code node):**
```javascript
const data = $input.item.json;
const result = data.result || {};
const reviews = result.reviews || [];
const companyId = data.company_id;

// Look for owner responses in reviews
// When a business owner responds to a review, Google shows their name
const ownerResponses = reviews
  .filter(r => r.owner_response)  // Not all APIs expose this directly
  .map(r => r.owner_response);

// Alternative approach: The Place Details "editorial_summary" or
// business profile sometimes contains the owner name
// But the most reliable method is through the New Places API

// For the legacy API, we look at the review author_name
// If the business responded, the owner_response text sometimes starts with
// "Thank you... - [Name]" or is attributed to the business account

// Parse owner name from review responses
let ownerName = null;

// Method: Check if any review has an owner_response
// The Google Places API v1 (New) exposes this better:
// GET https://places.googleapis.com/v1/places/{placeId}
// Headers: X-Goog-Api-Key, X-Goog-FieldMask: reviews
// Each review has an `authorAttribution.displayName` and
// ownerResponses with `text`

// For now, store what we find and flag for the contact
if (ownerName) {
  const parts = ownerName.trim().split(' ');
  return [{
    json: {
      company_id: companyId,
      first_name: parts[0] || null,
      last_name: parts.slice(1).join(' ') || null,
      role: 'owner',
      is_owner: true,
      source: 'google_reviews',
    }
  }];
}

return [{ json: { company_id: companyId, no_results: true } }];
```

### Important Caveat
The **legacy** Places API (`maps.googleapis.com/maps/api/place/details`) returns reviews but does NOT directly attribute owner responses with a separate name field. The owner response text is embedded in each review object.

The **new** Places API (`places.googleapis.com/v1/places/{id}`) has better structured review data. Consider migrating to the new API if you haven't already. The field mask `reviews` returns `reviews[].authorAttribution.displayName` which can help identify the business owner if they respond to reviews.

### Practical Approach
Rather than complex parsing, a simpler high-confidence method:

1. Fetch Place Details with `reviews` field
2. Check if any reviews have owner responses
3. If yes, use the **Google Business Profile name** (not individual review author) — this is usually the owner's name for small businesses
4. Cross-reference against the company name — if the business profile name differs from the company name, it's likely a person's name (the owner)

### Cost Estimate
- ~350 companies with google_place_id and no contact name
- At $17/1,000 calls = ~$6
- Very cheap since you're already making these API calls

### Expected Yield
- Moderate. Maybe 20-30% of small businesses have owner-responded reviews
- Higher for solo practitioners who manage their own profiles
- Expect ~70-100 owner names from 350 lookups

---

## Source 3: Facebook Business Pages

### What It Gives You
- Page admin name (sometimes visible on small business pages)
- Contact email from the "About" section
- Phone number from page info
- Sometimes the owner is listed in the "People" section or page transparency

### API vs. Scraping
The **Facebook Graph API** requires the business to grant you access via OAuth — not practical for lead gen. Meta's Terms of Service also prohibit scraping for commercial contact harvesting.

**Realistic approach: Lightweight public page fetch**

Facebook business pages have publicly visible "About" sections. Without logging in, you can often access:
- `https://www.facebook.com/{page_id}/about` — shows contact info, address, sometimes owner
- Page transparency section shows who manages the page (name + location)

### n8n Implementation

**Input filter:** Companies with `facebook_url IS NOT NULL` (from social_profiles table) AND no contact found yet.

**HTTP Request node:**
```
GET {{ $json.facebook_url }}/about
Headers:
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36
```

**Response parsing (Code node):**
```javascript
const html = $input.item.json.data || '';
const companyId = $input.item.json.company_id;

// Extract email from page
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const emails = [...new Set(html.match(emailRegex) || [])];

// Filter out generic/facebook emails
const usableEmails = emails.filter(e =>
  !e.includes('facebook.com') &&
  !e.includes('sentry.io') &&
  !/^(info|hello|contact|admin|support|noreply)@/i.test(e)
);

// Extract phone
const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const phones = html.match(phoneRegex) || [];

// Look for "Page transparency" section or "People" mentions
// This is fragile and depends on Facebook's HTML structure
// May need to be updated if FB changes their layout

const result = {
  company_id: companyId,
  source: 'facebook',
};

if (usableEmails.length > 0) {
  result.email_business = usableEmails[0];
}
if (phones.length > 0) {
  result.phone_direct = phones[0];
}

const hasData = result.email_business || result.phone_direct;
result.no_results = !hasData;

return [{ json: result }];
```

### Risks & Limitations
- **Rate limiting:** Facebook aggressively rate-limits non-authenticated scraping. Use 2-3 second delays between requests.
- **HTML structure changes:** Facebook's page structure changes frequently. Regex-based parsing will break periodically.
- **Blocked requests:** Facebook may return login walls for unauthenticated requests. Monitor success rate.
- **Page transparency:** The "Page transparency" section (which shows admin names) is loaded dynamically via JavaScript — a simple HTTP fetch won't get it. Would need a headless browser, which is heavier to run in n8n.

### Practical Recommendation
Focus on **email extraction only** from Facebook pages. It's the most reliably accessible data from a public page fetch. Owner names from Facebook are technically available but require JS rendering which makes this significantly more complex.

If the simple HTTP fetch gets blocked, consider using a **headless browser n8n node** (puppeteer or playwright) for this specific source. Alternatively, add a manual enrichment flag: "has_facebook_page_no_contact" so your team can manually check the page transparency section for high-value leads.

### Cost Estimate
- Free (no API costs)
- ~450 companies with facebook_url
- Main cost is time/compute for scraping

### Expected Yield
- Emails: 10-20% of pages will have a visible email in the About section
- Phone: Often matches company phone (not additive)
- Owner name: Low yield without JS rendering
- Expect ~45-90 new emails from 450 page scrapes

---

## Source 4: Yelp Business Owner

### What It Gives You
- Business owner's first name (displayed on claimed business pages)
- Sometimes owner's last initial
- Owner photo
- "Message the business" capability indicator

### How It Works
When a business owner claims their Yelp listing, their first name (and sometimes last initial) appears on the business page in the "About the Business" section, typically showing:

> **About the Business**
> [Photo] **Kristen M.** - Business Owner
> "Welcome to our spa..."

This is publicly visible on every claimed Yelp business page.

### n8n Implementation

**Input filter:** Companies with `on_yelp = true` or with a Yelp URL in `source_urls` AND no contact name found yet. You need the Yelp business page URL.

**Step 1 — Get Yelp URL (if not stored):**

If you stored the Yelp URL during Step 1 discovery in `source_urls`, extract it. If not, use the Yelp Fusion API to find it:

```
GET https://api.yelp.com/v3/businesses/search
Headers:
  Authorization: Bearer YOUR_YELP_API_KEY
Query params:
  term: {{ $json.company_name }}
  location: {{ $json.city }}, {{ $json.state }}
  limit: 1
```

The response includes `url` which is the Yelp business page URL.

**Step 2 — Fetch the Yelp page:**

```
GET {{ yelp_url }}
Headers:
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...
```

**Step 3 — Parse owner name (Code node):**

```javascript
const html = $input.item.json.data || '';
const companyId = $input.item.json.company_id;

// Yelp "About the Business" section contains owner info
// Pattern: "Business Owner" or "Business Manager" near a name

// Method 1: Look for structured data / JSON-LD
const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
let ownerName = null;

// Method 2: Regex for the "About the Business" section
// Yelp typically formats it as:
// <p class="...">FirstName L.</p>
// <p class="...">Business Owner</p>

// Look for "Business Owner" and grab the name nearby
const ownerPattern = /([A-Z][a-z]+(?:\s[A-Z]\.?)?)\s*(?:<[^>]*>)?\s*(?:Business Owner|Owner)/i;
const match = html.match(ownerPattern);

if (match && match[1]) {
  ownerName = match[1].trim();
}

// Alternative: look for "Meet the Business Owner" section
const meetPattern = /Meet the (?:Business )?Owner[\s\S]*?([A-Z][a-z]+(?:\s[A-Z][a-z]*)?)/i;
const meetMatch = html.match(meetPattern);

if (!ownerName && meetMatch && meetMatch[1]) {
  ownerName = meetMatch[1].trim();
}

if (ownerName) {
  const parts = ownerName.split(' ');
  return [{
    json: {
      company_id: companyId,
      first_name: parts[0],
      last_name: parts.length > 1 ? parts[1].replace('.', '') : null,
      role: 'owner',
      is_owner: true,
      source: 'yelp',
    }
  }];
}

return [{ json: { company_id: companyId, no_results: true } }];
```

### Risks & Limitations
- **Partial names:** Yelp often shows only first name + last initial ("Kristen M."). You get a first name for personalization but not a full name for email pattern matching.
- **Rate limiting:** Yelp will block if you scrape too aggressively. Use 3-5 second delays.
- **Not all listings are claimed:** Unclaimed listings won't have owner info. Maybe 50-60% of small businesses have claimed their Yelp page.
- **HTML structure fragile:** Same concern as Facebook — regex parsing breaks when Yelp updates their layout.

### Combining with Hunter.io
Even a first name + last initial is powerful when combined with Hunter.io's email pattern. If Hunter tells you the pattern is `{first}@domain.com` and Yelp gives you "Kristen", you can construct `kristen@domain.com` with reasonable confidence.

### Cost Estimate
- Yelp Fusion API: Free tier = 5,000 calls/day (more than enough)
- Page scraping: Free (compute only)
- Main cost is development time

### Expected Yield
- ~50-60% of businesses have claimed Yelp listings with owner info
- First names only (usually), last initial sometimes
- Expect ~150-200 first names from companies on Yelp
- Combined with Hunter.io patterns, this could generate ~50-80 constructed emails

---

## Source 5: State Licensing Boards

### What It Gives You
- Practitioner full legal name
- License type (LMT, CMT, RMT, etc.)
- License status (active/expired)
- Business address on file (for matching)
- Sometimes: city, phone

### Feasibility by State

| State | Board | Public Search | Format | Ease |
|-------|-------|---------------|--------|------|
| **Texas** | TDLR (TX Dept of Licensing & Regulation) | Yes — https://www.tdlr.texas.gov/LicenseSearch/ | Web form, returns HTML | Medium |
| **Idaho** | IBOL (Idaho Bureau of Occupational Licenses) | Yes — https://elitepublic.ibol.idaho.gov/ | Web form, returns HTML | Medium |
| **Arizona** | AZ Board of Massage Therapy | Yes — https://bmt.az.gov/licensees/verify-license | Web form, returns HTML | Medium |
| **Tennessee** | TN Health Related Boards | Yes — https://apps.health.tn.gov/Licensure/ | Web form, returns HTML | Medium |
| **California** | CAMTC (CA Massage Therapy Council) | Yes — https://www.camtc.org/verify-massage-professional/ | Web form, returns HTML | Medium |

All 5 states have publicly searchable databases. **None have open APIs.** They all require:
1. Form submission (POST request with search params)
2. HTML parsing of results

### n8n Implementation

**The challenge:** These are all web forms that return HTML, not JSON APIs. You'll need to:
1. POST to the search form with the business city or name
2. Parse the HTML response for practitioner names
3. Match against your company records

**Approach per state — example with Texas (TDLR):**

```
POST https://www.tdlr.texas.gov/LicenseSearch/SearchResults.aspx
Form data:
  licenseType: Massage Therapist
  city: Austin
  (other required form fields — inspect the page to find them)
```

**Code node for matching:**
```javascript
// After fetching license search results for a city
const html = $input.item.json.data || '';
const companies = $input.item.json.companies; // Pre-loaded for this city

// Parse names + addresses from HTML results
// Structure varies by state — example pattern:
const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

const licensees = [];
for (const row of rows) {
  const nameMatch = row.match(/([A-Z][a-z]+),\s*([A-Z][a-z]+)/);
  const cityMatch = row.match(/(Austin|Round Rock|Cedar Park|Georgetown)/i);

  if (nameMatch) {
    licensees.push({
      last_name: nameMatch[1],
      first_name: nameMatch[2],
      city: cityMatch ? cityMatch[1] : null,
    });
  }
}

// Match licensees to companies
// For solo practitioners: fuzzy match licensee name against company name
// For businesses with addresses: match on city + proximity
const matches = [];
for (const company of companies) {
  // Solo match: "Jane Smith Massage" → licensee "Smith, Jane"
  for (const lic of licensees) {
    const nameInBiz = company.company_name.toLowerCase();
    if (nameInBiz.includes(lic.first_name.toLowerCase()) &&
        nameInBiz.includes(lic.last_name.toLowerCase())) {
      matches.push({
        company_id: company.id,
        first_name: lic.first_name,
        last_name: lic.last_name,
        role: 'owner',
        is_owner: true,
        source: 'licensing_board',
      });
      break;
    }
  }
}

return matches.map(m => ({ json: m }));
```

### Risks & Limitations
- **No APIs — fragile scraping.** Every state has a different form structure. Each one is a separate implementation.
- **Matching is hard.** Licensing databases list people, your database lists businesses. Matching "Jane A. Smith, LMT" to "Healing Touch Massage LLC" requires address matching or the name appearing in the business name.
- **Volume.** These databases can return hundreds of licensees per city. You're searching a haystack for your specific companies.
- **Form anti-bot protections.** Some states use CAPTCHAs or session tokens. TDLR in particular has ASP.NET ViewState which complicates automated submissions.
- **Data freshness.** License addresses may be home addresses, not business addresses.

### Honest Assessment
This source is **high effort, moderate reward.** It works well for solo practitioners (where the person's name IS the business) but poorly for businesses with generic names. The per-state implementation cost is significant, and the scraping will break when states update their websites.

**Recommendation:** Implement for **Texas only** first as a proof of concept (largest metro in your dataset, TDLR has the most straightforward search). If the match rate justifies it, add Idaho and Arizona. Skip Tennessee and California initially — their form structures are more complex.

If the form submissions prove too fragile, an alternative is to download bulk license data where available. Texas TDLR publishes downloadable license files periodically — check if a CSV/Excel export is available, which would be far more reliable than scraping.

### Cost Estimate
- Free (public data)
- Development time: 4-6 hours per state
- Maintenance: Ongoing — forms change

### Expected Yield
- Solo practitioners only: ~15-25% match rate against your company list
- For Texas (~220 Austin companies, ~80 solo): maybe 20-30 matched names
- Diminishing returns for other states

---

## Implementation Priority & Order

| Priority | Source | Effort | Expected New Contacts | Cost |
|----------|--------|--------|----------------------|------|
| **1** | **Hunter.io** | Low (clean API, 2-3 hrs) | ~200-280 emails | $49/mo |
| **2** | **Yelp Business Owner** | Medium (scraping, 4-5 hrs) | ~150-200 first names | Free |
| **3** | **Google Business Profile** | Low (API you already use, 2-3 hrs) | ~70-100 owner names | ~$6 |
| **4** | **Facebook Pages** | Medium-High (fragile scraping, 5-6 hrs) | ~45-90 emails | Free |
| **5** | **State Licensing** | High (per-state, 4-6 hrs each) | ~20-30 per state | Free |

### Recommended Batch 1: Hunter.io + Yelp + Google Reviews
- Combined: ~8-10 hours of implementation
- Expected yield: ~420-580 new data points (names + emails)
- Could push contact name coverage from 9% to 25-35%

### Recommended Batch 2: Facebook + Texas Licensing
- Combined: ~10-12 hours
- Expected yield: ~65-120 additional data points
- Incremental improvement, worth it if Batch 1 proves the model

---

## Waterfall Logic in n8n

The key principle: **don't waste API calls on companies that already have contact data.**

```
┌─────────────────────────────────────────────────────┐
│ For each company missing contact name/email:        │
│                                                     │
│  1. Hunter.io (if domain exists)                    │
│     └─ Found email? → Write contact, STOP          │
│                                                     │
│  2. Google Reviews (if google_place_id exists)      │
│     └─ Found owner name? → Write contact, CONTINUE │
│        (keep going — name without email still needs │
│         enrichment)                                 │
│                                                     │
│  3. Yelp Owner (if on_yelp = true)                  │
│     └─ Found name? → Write/update contact, CONTINUE│
│                                                     │
│  4. Facebook Page (if facebook_url exists)           │
│     └─ Found email? → Update contact, STOP         │
│                                                     │
│  5. State Licensing (if estimated_size = 'solo')    │
│     └─ Found name? → Write/update contact           │
│                                                     │
│  After all sources:                                 │
│  - If we have a name + Hunter pattern but no email: │
│    → Construct email from pattern + first name      │
│    → Mark as 'constructed' (lower confidence)       │
│                                                     │
│  - Run NamSor on any new names for cultural_affinity│
└─────────────────────────────────────────────────────┘
```

### n8n Structure

One workflow, or extend the existing Step 3a workflow with new branches after the current Apollo/Website nodes:

```
[Companies missing contacts]
    │
    ├── [Batch: Hunter.io] ──→ [Parse] ──→ [Upsert contacts]
    │
    ├── [Still missing name? → Batch: Google Reviews] ──→ [Parse] ──→ [Upsert]
    │
    ├── [Still missing name? → Batch: Yelp Scrape] ──→ [Parse] ──→ [Upsert]
    │
    ├── [Still missing email? → Batch: Facebook Scrape] ──→ [Parse] ──→ [Upsert]
    │
    ├── [Solo + still missing? → Batch: State Licensing] ──→ [Parse] ──→ [Upsert]
    │
    └── [Construct emails from pattern + name combos] ──→ [Upsert]
```

Each batch node should have `onError: continueRegularOutput` so a single failure doesn't break the entire run. Add 2-5 second delays between scraping requests (Yelp, Facebook) to avoid rate limiting.
