# Enrichment Pipeline Catalogue

## How it works

For each metro, the pipeline runs in 3 phases across 2 workflows:

1. **Discovery** (main workflow): Google Places + Yelp/Apify find businesses
2. **Company Enrichment** (sub-workflow, per batch of 25): Scrape websites, extract emails/social/booking info, fetch Google Details
3. **Contact Finding** (sub-workflow): Find owner/operator names via 7 sources
4. **Contact Enrichment** (sub-workflow): Verify emails, phones, cultural affinity

---

## Phase 1: Discovery (Main Workflow)

### Google Places Text Search
- 12 search queries per metro (e.g., "massage therapy", "day spa", "sports massage")
- `maxResultCount: 20` per query = up to 240 raw results
- Uses lat/long + radius for geo-targeting
- Cost: ~$0.20/metro

### Yelp via Apify Scraper
- Same 12 queries, each triggers a separate Apify actor run
- `searchLimit: 20` per query (reduced from 100, ADR-043)
- Async: polls for completion every 20s
- Cost: ~$0.30/metro (estimated post-reduction)

### Deduplication
- Merges Google + Yelp results
- Deduplicates by business name similarity + phone match
- Inserts unique companies to Supabase

---

## Phase 2: Company Enrichment (`enrich-companies.js`, 545 lines)

Runs per batch of 25 companies. For each company:

### 2a. Domain Backfill (Google Places)
- **When:** Company has no domain but `has_website=true`
- **How:** Searches Google Places by name+city, matches by word overlap + phone
- **Extracts:** domain, google_place_id, google_rating, review_count

### 2b. Website Scraping
- **When:** Company has a domain (not on blocked list of 25 platform domains)
- **How:** Fetches homepage HTML, parses with regex
- **Extracts:**
  - **Emails:** All emails from page, scored by domain match + mailto presence. Best email saved to company record.
  - **Booking platform:** Checks domain + HTML for 23 platforms (Jane, Acuity, Mindbody, Vagaro, Fresha, etc.) + generic "book now" patterns
  - **Paid ads:** Scans for Google Ads, GA4, Facebook Pixel, LinkedIn Insight, TikTok Pixel (14 signatures)
  - **Team size estimate:** Counts team page headers/links. Solo (0-1), small (2-5), medium (6+)
  - **Social links:** Facebook, Instagram, TikTok, LinkedIn, X, YouTube URLs

### 2c. Google Places Details
- **When:** Company has `google_place_id`
- **How:** Fetches place details (opening hours, business status, photos, price level)
- **Extracts:** opening_hours, business_status, photo_count, price_level, types

### 2d. Social Profiles Insert
- **When:** Website scraping found social links
- **How:** Inserts to `social_profiles` table with merge-duplicates

---

## Phase 3: Contact Finding (`find-contacts.js`, 968 lines)

Runs per batch. For each company, tries sources in waterfall order (stops when a contact is found):

### Source 1: Solo Practitioner Detection
- **When:** Always runs first
- **How:** 7 regex patterns match owner names in company name (e.g., "John's Massage", "Massage by Jane Smith", "Sarah Jones, LMT")
- **Extracts:** first_name, last_name
- **Status:** ENABLED, primary source for solo practitioners
- **Yield:** ~16% of companies (varies by metro)

### Source 2: Apollo People Search + Enrich
- **When:** Not a solo practitioner, company has domain
- **How:** Searches Apollo for people at company domain with title filters (owner, founder, CEO, manager, therapist). Scores by relevance. Optionally enriches best match for email/phone.
- **Extracts:** first_name, last_name, email, phone, LinkedIn, role
- **Status:** ENABLED
- **Yield:** ~8-16% of searched companies
- **Rate limiting:** 3 per batch, 2s delay

### Source 3: Website About-Page Scraping
- **When:** Apollo found nobody, company has domain
- **How:** Scrapes 6 paths (/about, /about-us, /about-me, /our-team, /team, /our-story). 5 regex patterns match owner/founder patterns.
- **Extracts:** first_name, last_name
- **Status:** ENABLED
- **Yield:** ~4-10% of searched companies

### Source 4: No-Domain Name Extraction
- **When:** Company has no domain, no contact yet
- **How:** Extracts names from company name (6 patterns, similar to solo detection)
- **Extracts:** first_name, last_name
- **Status:** ENABLED
- **Yield:** Low (companies without domains are often chains)

### Source 5: Hunter Domain Search
- **When:** Company has domain, no contact found yet
- **How:** Queries Hunter.io domain search API. Filters generic emails, scores by title relevance.
- **Extracts:** first_name, last_name, email, LinkedIn, role
- **Status:** ENABLED (but currently out of credits)
- **Yield:** 0-88% depending on metro (dominant source for Toronto, 0% for small metros)

### Source 6: Google Reviews Owner Detection
- **When:** Company has google_place_id, no contact found yet
- **How:** Fetches place displayName, tries to extract person name from business name
- **Extracts:** first_name, last_name
- **Status:** DISABLED (was yielding 0% -- duplicates solo detection logic, and BUG-045: API v1 doesn't expose owner reply data)
- **Issue:** Only parses displayName, which solo detection already handles. Method 2 (owner replies) was removed because Places API v1 doesn't provide structured ownerResponse data.

### Source 7: Yelp Owner Scraping
- **When:** Company has Yelp URL in source_urls, no contact found yet
- **How:** Fetches Yelp business page HTML. 3 regex patterns: "Business Owner" label, "Meet the Business Owner" section, JSON-LD structured data (founder/employee).
- **Extracts:** first_name, last_name, yelp_is_claimed
- **Status:** ENABLED but non-functional
- **Issue:** Yelp returns 403 Forbidden on all HTTP requests (bot detection). The HTML never reaches the parser. Fixing requires headless browser (Puppeteer) or proxy rotation.

### Source 8: Facebook Page Email Extraction
- **When:** Company has Facebook URL in social_profiles, no email found
- **How:** Scrapes Facebook page HTML for email addresses
- **Extracts:** email_business
- **Status:** DISABLED (SKIP_FACEBOOK=true, not yet tested)

---

## Phase 4: Contact Enrichment (`enrich-contacts.js`, 613 lines)

Runs per batch. For each contact:

### Hunter Email Finder
- **When:** Contact has first_name + company has domain, no email yet
- **How:** Queries Hunter.io email finder API
- **Extracts:** email, LinkedIn, phone
- **Status:** ENABLED (but out of credits)

### Snov.io Email Finder (fallback)
- **When:** Hunter found nothing, contact has name + domain
- **Status:** DISABLED (no API key)

### Hunter Email Verifier
- **When:** Contact has email to verify
- **How:** Verifies email, maps status (valid/invalid/risky/accept_all)
- **Status:** ENABLED (but out of credits)

### Telnyx Phone Verification
- **When:** Contact or company has phone number
- **How:** Number lookup for carrier type (mobile/landline/voip) and validity
- **Status:** ENABLED but returning 403 (likely expired key or over-limit)

### NamSor Cultural Affinity
- **When:** Contact has first_name, missing cultural_affinity
- **How:** Predicts cultural origin from name
- **Extracts:** cultural_affinity string (region/country), confidence
- **Status:** ENABLED and working

### Company Email Routing
- **When:** Contact has role-based email (info@, contact@), company has no email
- **How:** Routes role-based email to company record, promotes personal email on contact
- **Status:** Always active (logic, not API)

---

## Current Issues Summary

| Issue | Impact | Fix |
|-------|--------|-----|
| Telnyx 403 | No phone verification | Check API key / account |
| Hunter out of credits | No email finding, no domain search, no verification | Renew credits |
| Google Reviews 0% yield | Wasted API calls | Disabled (ADR-043) |
| Yelp Owner 403 blocked | 0% yield on owner detection | Needs headless browser or proxy |
| Facebook disabled | Missing email source | Enable after testing |
| Snov.io disabled | Missing email fallback | Need API key |
| Apify over monthly limit | No Yelp discovery | Resets April 14 |
