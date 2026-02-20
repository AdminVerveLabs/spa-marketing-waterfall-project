# API Reference

## Hunter.io

### Email Finder
- **Endpoint:** `GET https://api.hunter.io/v2/email-finder`
- **Params:** `domain`, `first_name`, `last_name`, `api_key`
- **Cost:** 1 credit (0.5 if no result found)
- **Response:** `{ data: { email, score, linkedin_url, phone_number, position } }`
- **Score threshold:** Only accept score >= 50
- **Rate limit:** 15/sec, 500/min

### Email Verifier
- **Endpoint:** `GET https://api.hunter.io/v2/email-verifier`
- **Params:** `email`, `api_key`
- **Cost:** 1 credit per call
- **Response:** `{ data: { status, score, smtp_check, mx_records, regexp, gibberish, disposable, webmail, accept_all, block } }`
- **Status values:** valid, invalid, accept_all, webmail, disposable, unknown
- **Status mapping to our schema:**
  - `valid` → `verified`
  - `invalid` → `invalid` (also null out email_business)
  - `accept_all` → `accept_all`
  - `disposable` → `invalid`
  - `webmail` → `verified` (gmail/yahoo valid for solo practitioners)
  - `unknown` → `risky`

## Apollo.io

### People Search
- **Endpoint:** `POST https://api.apollo.io/v1/mixed_people/search`
- **Auth:** `x-api-key` header or `api_key` in body
- **Body:** `{ organization_name, person_titles, page, per_page }`
- **Response:** `{ people: [{ first_name, last_name, email, organization, phone_numbers, linkedin_url, ... }] }`

### People Enrichment
- **Endpoint:** `POST https://api.apollo.io/v1/people/match`
- **Body:** `{ first_name, last_name, organization_name, domain }`
- **Response:** `{ person: { email, phone_numbers, linkedin_url, ... } }`
- **Note:** Phone comes as object `{ sanitized_number: "..." }`, not plain string

## NamSor

### Origin API
- **Endpoint:** `GET https://v2.namsor.com/NamSorAPIv2/api2/json/origin/{firstName}/{lastName}`
- **Auth:** `X-API-KEY` header
- **Response:** `{ countryOrigin, countryOriginAlt, regionOrigin, subRegionOrigin, probabilityCalibrated }`
- **Output format:** "Region / SubRegion / Country" e.g. "Europe / Northern Europe / GB"
- **Low confidence:** Append "(low confidence)" if probabilityCalibrated < 0.3
- **Cost:** 10 credits per name
- **Batching:** 5 concurrent, 500ms interval

## Snov.io (Future)

### Email Finder
- **Endpoint:** `POST https://api.snov.io/v1/get-emails-from-names`
- **Auth:** `access_token` in body
- **Body:** `{ firstName, lastName, domain }`
- **Response:** `{ emails: [{ email, emailStatus }] }`
- **Note:** Not yet configured. `skip_snovio` is `"true"` in config.

## Google Places API
- Used in Step 1 for business discovery
- Accessed via Apify actor or direct API calls
- Currently limited to ~5 results per query for testing

## Apify (Yelp Scraper)
- Used in Step 1 alongside Google Places
- Currently limited to ~5 results for testing
