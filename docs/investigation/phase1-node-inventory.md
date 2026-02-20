# Phase 1: Node Inventory

**Workflow:** Step 4 (isolated) - with Layer 2 Verification
**Total Nodes:** 151
**Date:** 2026-02-17
**Phase:** 1 of 7 (Investigation)

## 1. Summary Statistics

### Node Count by Type

| Type | Count |
|------|-------|
| code | 72 |
| httpRequest | 36 |
| if | 32 |
| set | 5 |
| wait | 3 |
| merge | 2 |
| manualTrigger | 1 |
| **TOTAL** | **151** |

### Node Count by Step

| Step | Nodes |
|------|-------|
| Step 1: Discovery | 20 |
| Step 2: Company Enrichment | 50 |
| Step 3b: Social Enrichment | 12 |
| Step 3a: Find People | 30 |
| Step 4: Enrich People | 39 |
| **TOTAL** | **151** |

### Convergence Points (Multi-Input Nodes)

**19 nodes** receive input from 2+ upstream paths:

- **Collect Email Results** (code) ← 3 sources: Merge Email Results (out[0]), Skip Email - Pass Through (out[0]), No Domain - Skip Email (out[0])
- **Collect NamSor Results** (code) ← 2 sources: Parse NamSor Response (out[0]), Skip NamSor (out[0])
- **Collect Updates** (code) ← 2 sources: Has Updates? (out[1]), Update Contact in Supabase (out[0])
- **Collect Verified Results** (code) ← 2 sources: Parse Verifier Response (out[0]), Skip Verification (out[0])
- **Hunter Found Email?** (if) ← 2 sources: Parse Hunter Response (out[0]), Skip Hunter (out[0])
- **Insert Contact to Supabase** (httpRequest) ← 5 sources: Validate & Clean Contact (out[0]), Validate & Clean Contact1 (out[0]), Validate & Clean Contact3 (out[0]), Validate & Clean Contact4 (out[0]), Validate & Clean Contact2 (out[0])
- **Merge All Sources** (merge) ← 2 sources: Normalize Google Results (out[0]), Normalize Yelp Results (out[0])
- **Merge Backfill** (merge) ← 2 sources: Needs Backfill? (out[1]), Extract & Patch Domain (out[0])
- **Merge Email Results** (code) ← 3 sources: Hunter Found Email? (out[0]), Parse Snov.io Response (out[0]), Skip Snov.io (out[0])
- **Merge Website Results** (code) ← 2 sources: Analyze Website HTML (out[0]), Skip - No Website (out[0])
- **Prepare Company Update** (code) ← 2 sources: Parse Google Details (out[0]), Skip Google Details (out[0])
- **Run Summary** (code) ← 2 sources: Insert to Supabase (out[0]), Insert Flagged (Needs Review) (out[0])
- **Run Summary1** (code) ← 7 sources: Insert Social Profiles (out[0]), Needs Social Discovery? (out[1]), Discovery Queries Exist? (out[1]), FB Matches Found? (out[1]), Insert FB Social Profiles (out[0]), IG Matches Found? (out[1]), Insert IG Social Profiles (out[0])
- **Run Summary2** (code) ← 2 sources: Should Enrich? (out[1]), Update Social Profile in Supabase (out[0])
- **Run Summary3** (code) ← 3 sources: About Found Name? (out[1]), No Domain Found Name? (out[1]), Insert Contact to Supabase (out[0])
- **Skip Verification** (code) ← 2 sources: Has Email to Verify? (out[1]), Hunter Verifier Enabled? (out[0])
- **Wait 30s** (wait) ← 2 sources: Extract Run ID (out[0]), Run Succeeded? (out[1])
- **Wait FB 30s** (wait) ← 2 sources: Extract FB Run ID (out[0]), FB Run Succeeded? (out[1])
- **Wait IG 30s** (wait) ← 2 sources: Extract IG Run ID (out[0]), IG Run Succeeded? (out[1])

### Duplicate Code Groups

- **Bridge to 3b** pattern: 3 copies — Bridge to 3b, Bridge to 3a, Bridge to 4
- **Validate & Clean Contact3** pattern: 5 copies — Validate & Clean Contact3, Validate & Clean Contact4, Validate & Clean Contact2, Validate & Clean Contact1, Validate & Clean Contact

---

## 2. Master Node Tables by Step

### Step 1: Discovery

**20 nodes** | X range: [-1200, 2513]

| # | Node Name | Type | v | Mode | Position | onError | Notes |
|---|-----------|------|---|------|----------|---------|-------|
| 1 | When clicking ‘Execute workflow’ | manualTrigger | 1 |  | [-1184,-16] |  |  |
| 2 | Metro Config | set | 3.4 |  | [-848,-16] |  | CONFIGURE: Change metro_name, lat/lng, radius, search querie... |
| 3 | Split Search Queries | code | 2 | runOnceForAllItems | [-624,-16] |  |  |
| 4 | Start Apify Run | httpRequest | 4.2 |  | [-400,80] | continueRegularOutput | Starts the Apify task. Returns run object with data.id for p... |
| 5 | Extract Run ID | code | 2 | runOnceForAllItems | [-176,80] |  |  |
| 6 | Wait 30s | wait | 1.1 |  | [48,80] |  |  |
| 7 | Check Run Status | httpRequest | 4.2 |  | [272,16] | continueRegularOutput |  |
| 8 | Parse Status | code | 2 | runOnceForAllItems | [496,16] |  |  |
| 9 | Run Succeeded? | if | 2 |  | [720,80] |  |  |
| 10 | Google Places - Text Search | httpRequest | 4.2 |  | [944,-160] |  | Google Places API (v1). Needs HTTP Header Auth credential: n... |
| 11 | Fetch Apify Results | httpRequest | 4.2 |  | [944,80] |  |  |
| 12 | Normalize Google Results | code | 2 | runOnceForAllItems | [1168,-160] |  |  |
| 13 | Normalize Yelp Results | code | 2 | runOnceForAllItems | [1168,80] |  | After testing, change $('Test Input (Remove After Testing)')... |
| 14 | Merge All Sources | merge | 3 |  | [1392,-16] |  |  |
| 15 | Deduplicate Records | code | 2 | runOnceForAllItems | [1616,-16] |  |  |
| 16 | Prepare for Supabase | code | 2 | runOnceForAllItems | [1840,-16] |  |  |
| 17 | Fuzzy Match? | if | 2 |  | [2064,-16] |  |  |
| 18 | Insert Flagged (Needs Review) | httpRequest | 4.2 |  | [2288,-112] |  | Fuzzy-matched records. Status = needs_review for manual dedu... |
| 19 | Insert to Supabase | httpRequest | 4.2 |  | [2288,80] | continueRegularOutput | Clean records. Uses service_role key (bypasses RLS). |
| 20 | Run Summary | code | 2 | runOnceForAllItems | [2512,-16] |  |  |

### Step 2: Company Enrichment

**50 nodes** | X range: [2714, 10129]

| # | Node Name | Type | v | Mode | Position | onError | Notes |
|---|-----------|------|---|------|----------|---------|-------|
| 1 | Enrichment Config | set | 3.4 |  | [2736,-16] |  | CONFIGURE: batch_size = how many companies to process per ru... |
| 2 | Fetch Batch from Supabase | httpRequest | 4.2 |  | [2960,-16] |  |  |
| 3 | Parse Batch | code | 2 | runOnceForAllItems | [3184,-16] |  |  |
| 4 | Batch Empty? | if | 2 |  | [3408,-16] |  |  |
| 5 | No Records - Done | code | 2 | runOnceForAllItems | [3632,-112] |  |  |
| 6 | Needs Backfill? | if | 2.3 |  | [3632,80] |  |  |
| 7 | Google Places Lookup | httpRequest | 4.3 |  | [3856,0] | continueRegularOutput |  |
| 8 | Extract & Patch Domain | code | 2 | runOnceForEachItem | [4080,16] |  |  |
| 9 | Merge Backfill | merge | 3.2 |  | [4304,80] |  |  |
| 10 | Has Website? | if | 2 |  | [4528,80] |  |  |
| 11 | Fetch Website HTML | httpRequest | 4.2 |  | [4752,-16] | continueRegularOutput | Fetches homepage HTML. On error (timeout, SSL, 403, etc.) co... |
| 12 | Analyze Website HTML | code | 2 | runOnceForEachItem | [4976,-16] |  | Detects booking platforms, paid ads scripts, social media li... |
| 13 | Skip - No Website | code | 2 | runOnceForEachItem | [4976,176] |  |  |
| 14 | Merge Website Results | code | 2 | runOnceForEachItem | [5200,80] |  |  |
| 15 | Has Google Place ID? | if | 2 |  | [5424,80] |  |  |
| 16 | Google Places Details | httpRequest | 4.2 |  | [5648,-16] | continueRegularOutput | Fetches ONLY incremental fields not captured in Step 1 Text ... |
| 17 | Skip Google Details | code | 2 | runOnceForEachItem | [5760,192] |  |  |
| 18 | Parse Google Details | code | 2 | runOnceForEachItem | [5872,-16] |  |  |
| 19 | Prepare Company Update | code | 2 | runOnceForEachItem | [6096,80] |  |  |
| 20 | Update Company in Supabase | httpRequest | 4.2 |  | [6320,80] | continueRegularOutput | PATCH updates enrichment fields. Batched 10 at a time with 5... |
| 21 | Prepare Social Processing | code | 2 | runOnceForEachItem | [6544,80] |  |  |
| 22 | Has Social Links? | if | 2 |  | [6768,80] |  |  |
| 23 | Needs Social Discovery? | if | 2 |  | [6992,160] |  |  |
| 24 | Build Social Discovery Batch | code | 2 | runOnceForAllItems | [7216,352] |  |  |
| 25 | Discovery Queries Exist? | if | 2 |  | [7440,352] |  |  |
| 26 | Prepare FB Search Input | code | 2 | runOnceForAllItems | [7664,160] |  |  |
| 27 | Prepare IG Search Input | code | 2 | runOnceForAllItems | [7664,560] |  |  |
| 28 | Start FB Search Run | httpRequest | 4.2 |  | [7888,160] | continueRegularOutput | Starts the Apify Facebook Search Scraper actor to find Faceb... |
| 29 | Start IG Search Run | httpRequest | 4.2 |  | [7888,560] | continueRegularOutput | Starts the Apify Instagram Search Scraper actor to discover ... |
| 30 | Extract FB Run ID | code | 2 | runOnceForAllItems | [8112,160] |  |  |
| 31 | Extract IG Run ID | code | 2 | runOnceForAllItems | [8112,560] |  |  |
| 32 | Wait FB 30s | wait | 1.1 |  | [8336,160] |  |  |
| 33 | Wait IG 30s | wait | 1.1 |  | [8336,560] |  |  |
| 34 | Check FB Run Status | httpRequest | 4.2 |  | [8560,80] |  |  |
| 35 | Check IG Run Status | httpRequest | 4.2 |  | [8560,496] |  |  |
| 36 | Parse FB Status | code | 2 | runOnceForAllItems | [8784,80] |  |  |
| 37 | Parse IG Status | code | 2 | runOnceForAllItems | [8784,496] |  |  |
| 38 | FB Run Succeeded? | if | 2 |  | [9008,160] |  |  |
| 39 | IG Run Succeeded? | if | 2 |  | [9008,560] |  |  |
| 40 | Fetch FB Search Results | httpRequest | 4.2 |  | [9232,160] |  |  |
| 41 | Fetch IG Search Results | httpRequest | 4.2 |  | [9232,560] |  |  |
| 42 | Match FB Results to Companies | code | 2 | runOnceForAllItems | [9456,160] |  |  |
| 43 | Match IG Results to Companies | code | 2 | runOnceForAllItems | [9456,560] |  |  |
| 44 | Prepare Social Profiles Insert | code | 2 | runOnceForEachItem | [9680,-208] |  |  |
| 45 | FB Matches Found? | if | 2 |  | [9680,160] |  |  |
| 46 | IG Matches Found? | if | 2 |  | [9680,560] |  |  |
| 47 | Insert Social Profiles | httpRequest | 4.2 |  | [9904,-208] | continueRegularOutput | Inserts social profiles found from website HTML. Uses merge-... |
| 48 | Insert FB Social Profiles | httpRequest | 4.2 |  | [9904,80] | continueRegularOutput |  |
| 49 | Insert IG Social Profiles | httpRequest | 4.2 |  | [9904,640] | continueRegularOutput |  |
| 50 | Run Summary1 | code | 2 | runOnceForAllItems | [10128,224] |  | Final summary of the enrichment batch. Shows stats for websi... |

### Step 3b: Social Enrichment

**12 nodes** | X range: [10130, 12577]

| # | Node Name | Type | v | Mode | Position | onError | Notes |
|---|-----------|------|---|------|----------|---------|-------|
| 1 | Bridge to 3b | code | 2 | runOnceForAllItems | [10336,224] |  |  |
| 2 | Step 3b Config | set | 3.4 |  | [10560,224] |  | CONFIGURE: batch_size = how many social profiles to process.... |
| 3 | Fetch Unenriched Social Profiles | httpRequest | 4.2 |  | [10784,224] |  | Fetches social_profiles rows where follower_count is NULL (n... |
| 4 | Parse Batch1 | code | 2 | runOnceForAllItems | [11008,224] |  |  |
| 5 | Batch Empty?1 | if | 2 |  | [11232,224] |  |  |
| 6 | No Records - Done1 | code | 2 | runOnceForAllItems | [11456,128] |  |  |
| 7 | Build SociaVault Request | code | 2 | runOnceForEachItem | [11456,320] |  | Extracts username/handle from profile_url, builds SociaVault... |
| 8 | Should Enrich? | if | 2 |  | [11680,320] |  |  |
| 9 | Call SociaVault API | httpRequest | 4.2 |  | [11904,256] | continueRegularOutput | Calls SociaVault profile endpoint. Batched 5 at a time with ... |
| 10 | Parse SociaVault Response | code | 2 | runOnceForEachItem | [12128,256] |  | Extracts follower_count, post_count, last_post_date from Soc... |
| 11 | Update Social Profile in Supabase | httpRequest | 4.2 |  | [12352,256] | continueRegularOutput | PATCH updates social_profiles row. Batched 10 at a time with... |
| 12 | Run Summary2 | code | 2 | runOnceForAllItems | [12576,336] |  | Final summary with per-platform breakdown. |

### Step 3a: Find People

**30 nodes** | X range: [12578, 16641]

| # | Node Name | Type | v | Mode | Position | onError | Notes |
|---|-----------|------|---|------|----------|---------|-------|
| 1 | Bridge to 3a | code | 2 | runOnceForAllItems | [12784,336] |  |  |
| 2 | Step 3a Config | set | 3.4 |  | [13104,320] |  | CONFIGURE: batch_size = companies per run. skip_apollo/skip_... |
| 3 | Fetch Companies | httpRequest | 4.2 |  | [13328,320] |  |  |
| 4 | Fetch Existing Contacts | httpRequest | 4.2 |  | [13552,320] | continueRegularOutput |  |
| 5 | Filter & Parse Batch | code | 2 | runOnceForAllItems | [13776,320] |  |  |
| 6 | Batch Empty?2 | if | 2 |  | [14000,320] |  |  |
| 7 | No Records - Done2 | code | 2 | runOnceForAllItems | [14224,224] |  |  |
| 8 | Solo Practitioner Check | code | 2 | runOnceForEachItem | [14224,416] |  | Detects solo practitioners from estimated_size='solo' or bus... |
| 9 | Is Solo? | if | 2 |  | [14528,304] |  |  |
| 10 | Has Domain & Apollo? | if | 2 |  | [14752,400] |  | Routes to Apollo search if company has a domain AND apollo i... |
| 11 | Apollo People Search | httpRequest | 4.2 |  | [14960,288] | continueRegularOutput | FREE - does not consume credits. Searches for people at the ... |
| 12 | Parse Apollo Search | code | 2 | runOnceForEachItem | [15152,240] |  |  |
| 13 | Apollo Found People? | if | 2 |  | [15376,240] |  |  |
| 14 | Fetch About Page | httpRequest | 4.2 |  | [15536,496] | continueRegularOutput | Fetches /about page as fallback when Apollo found no results... |
| 15 | Enrich Enabled? | if | 2 |  | [15552,128] |  | Guards Apollo enrichment credits. Set apollo_enrich_enabled=... |
| 16 | No Domain Fallback | code | 2 | runOnceForEachItem | [15664,688] |  | Last resort: tries to extract a person name from the busines... |
| 17 | Prepare Solo Contact | code | 2 | runOnceForEachItem | [15696,-160] |  |  |
| 18 | Parse About Page | code | 2 | runOnceForEachItem | [15696,496] |  |  |
| 19 | Apollo People Enrich | httpRequest | 4.2 |  | [15744,32] | continueRegularOutput | COSTS 1 CREDIT per call. Enriches the selected person with f... |
| 20 | Apollo Search Only Contact | code | 2 | runOnceForEachItem | [15792,240] |  | Fallback: uses Apollo search data (first name + obfuscated l... |
| 21 | About Found Name? | if | 2 |  | [15856,496] |  |  |
| 22 | No Domain Found Name? | if | 2 |  | [15888,736] |  |  |
| 23 | Parse Apollo Enrich | code | 2 | runOnceForEachItem | [15920,32] |  |  |
| 24 | Validate & Clean Contact3 | code | 2 | runOnceForEachItem | [16000,240] |  |  |
| 25 | Validate & Clean Contact4 | code | 2 | runOnceForEachItem | [16048,400] |  |  |
| 26 | Validate & Clean Contact2 | code | 2 | runOnceForEachItem | [16080,624] |  |  |
| 27 | Validate & Clean Contact1 | code | 2 | runOnceForEachItem | [16112,32] |  |  |
| 28 | Validate & Clean Contact | code | 2 | runOnceForEachItem | [16128,-160] |  |  |
| 29 | Insert Contact to Supabase | httpRequest | 4.2 |  | [16352,304] | continueRegularOutput | Inserts contact into Supabase contacts table. All paths (sol... |
| 30 | Run Summary3 | code | 2 | runOnceForAllItems | [16640,144] |  | Final summary: contacts created from each source (solo detec... |

### Step 4: Enrich People

**39 nodes** | X range: [16642, 24000]

| # | Node Name | Type | v | Mode | Position | onError | Notes |
|---|-----------|------|---|------|----------|---------|-------|
| 1 | Bridge to 4 | code | 2 | runOnceForAllItems | [16864,144] |  |  |
| 2 | Step 4 Config | set | 3.4 |  | [17088,144] |  | Config for Step 4: Enrich People. - skip_hunter/skip_snovio:... |
| 3 | Fetch Contacts | httpRequest | 4.2 |  | [17312,144] | continueRegularOutput | Fetches all contacts from Supabase for enrichment |
| 4 | Collapse to Single | code | 2 | runOnceForAllItems | [17536,144] |  |  |
| 5 | Fetch Companies1 | httpRequest | 4.2 |  | [17760,144] | continueRegularOutput | Fetches company data (domain, phone, city) to support enrich... |
| 6 | Filter & Merge Contacts | code | 2 | runOnceForAllItems | [17984,144] |  | Merges contact data with company data. Filters to contacts t... |
| 7 | Batch Empty?3 | if | 2 |  | [18208,144] |  |  |
| 8 | No Records - Done3 | code | 2 | runOnceForAllItems | [18432,48] |  |  |
| 9 | Needs Email? | if | 2 |  | [18432,240] |  | Routes contacts that are missing email_business to the email... |
| 10 | Has Domain & Name? | if | 2 |  | [18656,336] |  | Email finder APIs require domain + first name at minimum. Co... |
| 11 | Hunter Enabled? | if | 2 |  | [18864,176] |  | Checks if Hunter is disabled in config. TRUE output = skip_h... |
| 12 | Hunter Email Finder | httpRequest | 4.2 |  | [19008,400] | continueRegularOutput | Hunter.io Email Finder: domain + first_name + last_name → em... |
| 13 | Skip Hunter | code | 2 | runOnceForEachItem | [19232,80] |  |  |
| 14 | Parse Hunter Response | code | 2 | runOnceForEachItem | [19232,400] |  |  |
| 15 | Hunter Found Email? | if | 2 |  | [19536,160] |  |  |
| 16 | Snov.io Enabled? | if | 2 |  | [19680,304] |  | Checks if Snov.io is disabled. TRUE = skip, FALSE = call API... |
| 17 | Snov.io Email Finder | httpRequest | 4.2 |  | [19904,400] | continueRegularOutput | Snov.io fallback email finder. Requires access token via SNO... |
| 18 | Skip Email - Pass Through | code | 2 | runOnceForEachItem | [20096,-32] |  | Contacts that already have email_business or don't have doma... |
| 19 | Skip Snov.io | code | 2 | runOnceForEachItem | [20128,240] |  |  |
| 20 | Parse Snov.io Response | code | 2 | runOnceForEachItem | [20128,400] |  |  |
| 21 | Merge Email Results | code | 2 | runOnceForEachItem | [20320,160] |  | Merges results from email waterfall (Hunter → Snov.io) and p... |
| 22 | No Domain - Skip Email | code | 2 | runOnceForEachItem | [20352,544] |  | Contacts without domain+name can't do email finder lookups. ... |
| 23 | Collect Email Results | code | 2 | runOnceForAllItems | [20560,160] |  |  |
| 24 | Has Email to Verify? | if | 2 |  | [20720,224] |  | Routes contacts with a best email to verification. Contacts ... |
| 25 | Hunter Verifier Enabled? | if | 2 |  | [20896,112] |  | Checks if Hunter Verifier is disabled in config. TRUE = skip... |
| 26 | Hunter Email Verifier | httpRequest | 4.2 |  | [21120,128] | continueRegularOutput | Hunter Email Verifier: 1 credit per call. Returns status (va... |
| 27 | Skip Verification | code | 2 | runOnceForEachItem | [21120,336] |  |  |
| 28 | Parse Verifier Response | code | 2 | runOnceForEachItem | [21312,128] |  |  |
| 29 | Collect Verified Results | code | 2 | runOnceForAllItems | [21472,240] |  |  |
| 30 | Needs NamSor? | if | 2 |  | [21664,224] |  | Routes to NamSor if: enabled in config AND contact has first... |
| 31 | NamSor Origin | httpRequest | 4.2 |  | [21792,144] | continueRegularOutput | NamSor Origin API: first_name + last_name → country of origi... |
| 32 | Parse NamSor Response | code | 2 | runOnceForEachItem | [22016,144] |  |  |
| 33 | Skip NamSor | code | 2 | runOnceForEachItem | [22016,336] |  |  |
| 34 | Collect NamSor Results | code | 2 | runOnceForAllItems | [22336,240] |  |  |
| 35 | Prepare Contact Update | code | 2 | runOnceForEachItem | [22688,224] |  | Builds the Supabase PATCH payload. Includes email_status, em... |
| 36 | Has Updates? | if | 2 |  | [22912,224] |  |  |
| 37 | Update Contact in Supabase | httpRequest | 4.2 |  | [23136,112] | continueRegularOutput | PATCH updates the contact record with enriched fields. Only ... |
| 38 | Collect Updates | code | 2 | runOnceForAllItems | [23328,224] |  |  |
| 39 | Run Summary4 | code | 2 | runOnceForAllItems | [23536,224] |  | Final summary: contacts processed, emails found (by source),... |

---

## 3. Set Node Details (5 nodes)

### Metro Config

- **ID:** `a0b81122-bcd5-45d5-8fe6-8d44573dba06`
- **Position:** [-848, -16]
- **Step:** Step 1: Discovery
- **Notes:** CONFIGURE: Change metro_name, lat/lng, radius, search queries, and yelp_location for each metro.

| # | Name | Value | Type |
|---|------|-------|------|
| 1 | `metro_name` | `Austin, TX` | string |
| 2 | `latitude` | `30.2672` | string |
| 3 | `longitude` | `-97.7431` | string |
| 4 | `radius_meters` | `10000` | string |
| 5 | `search_queries` | `massage therapy,massage clinic,RMT,spa massage,massage therapist` | string |
| 6 | `yelp_location` | `Austin, TX` | string |

### Enrichment Config

- **ID:** `54d1fa8d-b26d-42d0-b2f6-d4c22f4ae77f`
- **Position:** [2736, -16]
- **Step:** Step 2: Company Enrichment
- **Notes:** CONFIGURE: batch_size = how many companies to process per run. batch_offset = starting offset (for resuming). http_timeout_ms = timeout for website fetches. Set skip flags to 'true' to bypass sub-steps.

| # | Name | Value | Type |
|---|------|-------|------|
| 1 | `batch_size` | `100` | string |
| 2 | `batch_offset` | `0` | string |
| 3 | `http_timeout_ms` | `15000` | string |
| 4 | `skip_google_details` | `false` | string |
| 5 | `skip_social_discovery` | `true` | string |

### Step 3b Config

- **ID:** `752befe7-4985-41af-aa6b-c59a10c6d8be`
- **Position:** [10560, 224]
- **Step:** Step 3b: Social Enrichment
- **Notes:** CONFIGURE: batch_size = how many social profiles to process. Set skip_<platform> to 'true' to skip that platform.

| # | Name | Value | Type |
|---|------|-------|------|
| 1 | `batch_size` | `100` | string |
| 2 | `batch_offset` | `0` | string |
| 3 | `skip_instagram` | `false` | string |
| 4 | `skip_facebook` | `false` | string |
| 5 | `skip_tiktok` | `false` | string |
| 6 | `skip_twitter` | `false` | string |
| 7 | `skip_linkedin` | `false` | string |
| 8 | `skip_youtube` | `false` | string |

### Step 3a Config

- **ID:** `5514320f-6f5b-4f5b-8c91-4aa237e32dcb`
- **Position:** [13104, 320]
- **Step:** Step 3a: Find People
- **Notes:** CONFIGURE: batch_size = companies per run. skip_apollo/skip_website_scrape to bypass sub-steps. apollo_enrich_enabled = set false to save credits (search only, no enrich).

| # | Name | Value | Type |
|---|------|-------|------|
| 1 | `batch_size` | `50` | string |
| 2 | `batch_offset` | `0` | string |
| 3 | `skip_apollo` | `false` | string |
| 4 | `skip_website_scrape` | `false` | string |
| 5 | `apollo_enrich_enabled` | `true` | string |

### Step 4 Config

- **ID:** `782a2bfd-6b39-401a-aacc-f36090c307a3`
- **Position:** [17088, 144]
- **Step:** Step 4: Enrich People
- **Notes:** Config for Step 4: Enrich People.
- skip_hunter/skip_snovio: set to 'true' to disable. Set to 'false' when ready.
- skip_hunter_verifier: 'true' = skip email verification, 'false' = verify emails via Hunter
- skip_namsor: 'false' = enabled (NamSor API key required as NAMSOR_API_KEY env var)
- batch_size: how many contacts to process

| # | Name | Value | Type |
|---|------|-------|------|
| 1 | `batch_size` | `10` | string |
| 2 | `batch_offset` | `0` | string |
| 3 | `skip_hunter` | `false` | string |
| 4 | `skip_snovio` | `true` | string |
| 5 | `skip_namsor` | `false` | string |
| 6 | `skip_hunter_verifier` | `false` | string |

---

## 4. IF Node Details (32 nodes)

### Run Succeeded?

- **ID:** `1a02709f-fc9d-4d1a-8eb3-3852f91501d5`
- **Position:** [720, 80]
- **Step:** Step 1: Discovery

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "strict"
  },
  "conditions": [
    {
      "id": "succeeded",
      "leftValue": "={{ $json.status }}",
      "rightValue": "SUCCEEDED",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Fetch Apify Results
- **FALSE (output[1]) ->** Wait 30s

### Fuzzy Match?

- **ID:** `a3fb61b0-59b0-493c-8094-06907e223f61`
- **Position:** [2064, -16]
- **Step:** Step 1: Discovery

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "strict",
    "version": 1
  },
  "conditions": [
    {
      "id": "fuzzy-check",
      "leftValue": "={{ $json._fuzzy_match_flag }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Insert Flagged (Needs Review)
- **FALSE (output[1]) ->** Insert to Supabase

### Batch Empty?

- **ID:** `3787c4c4-9c41-4136-8072-b4fbc95c3e59`
- **Position:** [3408, -16]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "empty-check",
      "leftValue": "={{ $json._empty }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** No Records - Done
- **FALSE (output[1]) ->** Needs Backfill?

### Needs Backfill?

- **ID:** `2cb8d359-46de-48d4-a293-c427c2ee14cf`
- **Position:** [3632, 80]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose",
    "version": 3
  },
  "conditions": [
    {
      "id": "b807db58-4ea5-4a80-893d-18a9609d454a",
      "leftValue": "={{ $json.domain }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "empty",
        "singleValue": true
      }
    },
    {
      "id": "1650bd01-dca9-4d41-932b-501666c3ff50",
      "leftValue": "={{ $json.has_website }}",
      "rightValue": "true",
      "operator": {
        "type": "boolean",
        "operation": "true",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Google Places Lookup
- **FALSE (output[1]) ->** Merge Backfill

### Has Website?

- **ID:** `35de7fc8-4ad1-439b-9e04-86dc071c5a23`
- **Position:** [4528, 80]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-domain",
      "leftValue": "={{ $json.has_website }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Fetch Website HTML
- **FALSE (output[1]) ->** Skip - No Website

### Has Google Place ID?

- **ID:** `14faf286-a9b0-4f82-8e8c-6d5c70f48fb3`
- **Position:** [5424, 80]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-place-id",
      "leftValue": "={{ $json.google_place_id }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "notEquals"
      }
    },
    {
      "id": "not-skipped",
      "leftValue": "={{ $json._skip_google_details }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "notEquals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Google Places Details
- **FALSE (output[1]) ->** Skip Google Details

### Has Social Links?

- **ID:** `6e7ecb26-78a8-4895-b72e-cae1da3a00df`
- **Position:** [6768, 80]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-social-links",
      "leftValue": "={{ $json.social_links_found.length }}",
      "rightValue": "0",
      "operator": {
        "type": "number",
        "operation": "gt"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Prepare Social Profiles Insert
- **FALSE (output[1]) ->** Needs Social Discovery?

### Needs Social Discovery?

- **ID:** `97b32703-20c6-4a13-a6f7-ed2b49a31097`
- **Position:** [6992, 160]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "needs-discovery",
      "leftValue": "={{ $json.needs_social_discovery }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Build Social Discovery Batch
- **FALSE (output[1]) ->** Run Summary1

### Discovery Queries Exist?

- **ID:** `58284816-3efb-4f6e-8a8d-6f3f3265dfbc`
- **Position:** [7440, 352]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-queries",
      "leftValue": "={{ $json._no_social_discovery_needed }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "notEquals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Prepare FB Search Input, Prepare IG Search Input
- **FALSE (output[1]) ->** Run Summary1

### FB Run Succeeded?

- **ID:** `c06e0c3d-b66f-432f-acbf-7422a881a76f`
- **Position:** [9008, 160]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "fb-succeeded",
      "leftValue": "={{ $json.status }}",
      "rightValue": "SUCCEEDED",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Fetch FB Search Results
- **FALSE (output[1]) ->** Wait FB 30s

### IG Run Succeeded?

- **ID:** `481255bb-e6d5-4ea2-9395-af4e2c3761bd`
- **Position:** [9008, 560]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "ig-succeeded",
      "leftValue": "={{ $json.status }}",
      "rightValue": "SUCCEEDED",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Fetch IG Search Results
- **FALSE (output[1]) ->** Wait IG 30s

### FB Matches Found?

- **ID:** `9842146d-9b9b-487d-b4d5-4d7ea725847d`
- **Position:** [9680, 160]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-fb-results",
      "leftValue": "={{ $json._fb_match_count }}",
      "rightValue": "0",
      "operator": {
        "type": "number",
        "operation": "gt"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Insert FB Social Profiles
- **FALSE (output[1]) ->** Run Summary1

### IG Matches Found?

- **ID:** `bf0ceda0-9949-4350-b7ff-3f72b8ae0146`
- **Position:** [9680, 560]
- **Step:** Step 2: Company Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-ig-results",
      "leftValue": "={{ $json._ig_match_count }}",
      "rightValue": "0",
      "operator": {
        "type": "number",
        "operation": "gt"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Insert IG Social Profiles
- **FALSE (output[1]) ->** Run Summary1

### Batch Empty?1

- **ID:** `41fec4aa-25c3-4541-b234-884eac0cf93a`
- **Position:** [11232, 224]
- **Step:** Step 3b: Social Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "empty-check",
      "leftValue": "={{ $json._empty }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** No Records - Done1
- **FALSE (output[1]) ->** Build SociaVault Request

### Should Enrich?

- **ID:** `014949d1-83f2-4a75-bd76-05ef6d6037fc`
- **Position:** [11680, 320]
- **Step:** Step 3b: Social Enrichment

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "should-skip",
      "leftValue": "={{ $json._skip }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "notEquals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Call SociaVault API
- **FALSE (output[1]) ->** Run Summary2

### Batch Empty?2

- **ID:** `1af71400-26c5-45ac-8d72-d6b325fef533`
- **Position:** [14000, 320]
- **Step:** Step 3a: Find People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "empty-check",
      "leftValue": "={{ $json._empty }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** No Records - Done2
- **FALSE (output[1]) ->** Solo Practitioner Check

### Is Solo?

- **ID:** `452e170e-02b9-4e19-860b-fc4448394b72`
- **Position:** [14528, 304]
- **Step:** Step 3a: Find People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "is-solo",
      "leftValue": "={{ $json._is_solo }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Prepare Solo Contact
- **FALSE (output[1]) ->** Has Domain & Apollo?

### Has Domain & Apollo?

- **ID:** `0723f2f9-5176-43a0-bc31-29bbc4b47717`
- **Position:** [14752, 400]
- **Step:** Step 3a: Find People
- **Notes:** Routes to Apollo search if company has a domain AND apollo is not skipped. Otherwise goes to website scrape fallback.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-domain",
      "leftValue": "={{ $json.domain }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "notEquals"
      }
    },
    {
      "id": "not-skip-apollo",
      "leftValue": "={{ $('Step 3a Config').first().json.skip_apollo }}",
      "rightValue": "true",
      "operator": {
        "type": "string",
        "operation": "notEquals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Apollo People Search
- **FALSE (output[1]) ->** No Domain Fallback

### Apollo Found People?

- **ID:** `2c2cd5da-3c76-449c-9be1-a91b476657dd`
- **Position:** [15376, 240]
- **Step:** Step 3a: Find People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "apollo-found",
      "leftValue": "={{ $json._apollo_found }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Enrich Enabled?
- **FALSE (output[1]) ->** Fetch About Page

### Enrich Enabled?

- **ID:** `8b8d3e1c-c70a-4cc1-85d4-f1e86a91399b`
- **Position:** [15552, 128]
- **Step:** Step 3a: Find People
- **Notes:** Guards Apollo enrichment credits. Set apollo_enrich_enabled=false in config to skip enrichment and just use search results.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "enrich-enabled",
      "leftValue": "={{ $('Step 3a Config').first().json.apollo_enrich_enabled }}",
      "rightValue": "true",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Apollo People Enrich
- **FALSE (output[1]) ->** Apollo Search Only Contact

### About Found Name?

- **ID:** `4ecaf3fa-e762-404d-96d9-f18970daeabd`
- **Position:** [15856, 496]
- **Step:** Step 3a: Find People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "found-name",
      "leftValue": "={{ $json._has_contact }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Validate & Clean Contact4
- **FALSE (output[1]) ->** Run Summary3

### No Domain Found Name?

- **ID:** `8f88a95e-d323-4149-b45c-73cfa451b070`
- **Position:** [15888, 736]
- **Step:** Step 3a: Find People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-contact",
      "leftValue": "={{ $json._has_contact }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Validate & Clean Contact2
- **FALSE (output[1]) ->** Run Summary3

### Batch Empty?3

- **ID:** `cac8fd6f-5040-4cba-ba13-e32b576ffe5b`
- **Position:** [18208, 144]
- **Step:** Step 4: Enrich People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "is-empty",
      "leftValue": "={{ $json._empty }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** No Records - Done3
- **FALSE (output[1]) ->** Needs Email?

### Needs Email?

- **ID:** `f9d810ae-6ea7-4434-9ccf-6042c1df6c8a`
- **Position:** [18432, 240]
- **Step:** Step 4: Enrich People
- **Notes:** Routes contacts that are missing email_business to the email waterfall. Contacts that already have email skip ahead.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "needs-email",
      "leftValue": "={{ $json.email_business }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "notExists"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Has Domain & Name?
- **FALSE (output[1]) ->** Skip Email - Pass Through

### Has Domain & Name?

- **ID:** `9a56eb2c-56a4-4d09-ad34-c6310ac876d5`
- **Position:** [18656, 336]
- **Step:** Step 4: Enrich People
- **Notes:** Email finder APIs require domain + first name at minimum. Contacts without these skip email enrichment.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-domain",
      "leftValue": "={{ $json._company_domain }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "exists"
      }
    },
    {
      "id": "has-first-name",
      "leftValue": "={{ $json.first_name }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "exists"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Hunter Enabled?
- **FALSE (output[1]) ->** No Domain - Skip Email

### Hunter Enabled?

- **ID:** `5dd93e8e-397c-4e48-b3f2-23ae7e6e72ea`
- **Position:** [18864, 176]
- **Step:** Step 4: Enrich People
- **Notes:** Checks if Hunter is disabled in config. TRUE output = skip_hunter is 'true' (disabled), FALSE output = Hunter enabled.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "skip-hunter-check",
      "leftValue": "={{ $('Step 4 Config').first().json.skip_hunter }}",
      "rightValue": "true",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Skip Hunter
- **FALSE (output[1]) ->** Hunter Email Finder

### Hunter Found Email?

- **ID:** `83d7b998-66ad-4876-9a2a-88e0a9abb91d`
- **Position:** [19536, 160]
- **Step:** Step 4: Enrich People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "hunter-found",
      "leftValue": "={{ $json._hunter_email }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "exists"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Merge Email Results
- **FALSE (output[1]) ->** Snov.io Enabled?

### Snov.io Enabled?

- **ID:** `3c41e9db-c0b6-47d4-9612-506c2fa6bb6e`
- **Position:** [19680, 304]
- **Step:** Step 4: Enrich People
- **Notes:** Checks if Snov.io is disabled. TRUE = skip, FALSE = call API.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "skip-snovio-check",
      "leftValue": "={{ $('Step 4 Config').first().json.skip_snovio }}",
      "rightValue": "true",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Skip Snov.io
- **FALSE (output[1]) ->** Snov.io Email Finder

### Has Email to Verify?

- **ID:** `d40844b9-4771-4a61-aa47-ffdbfca35408`
- **Position:** [20720, 224]
- **Step:** Step 4: Enrich People
- **Notes:** Routes contacts with a best email to verification. Contacts without email skip ahead.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-best-email",
      "leftValue": "={{ $json._best_email }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "exists"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Hunter Verifier Enabled?
- **FALSE (output[1]) ->** Skip Verification

### Hunter Verifier Enabled?

- **ID:** `7805a8b3-f947-4754-9d4f-a5000410caa8`
- **Position:** [20896, 112]
- **Step:** Step 4: Enrich People
- **Notes:** Checks if Hunter Verifier is disabled in config. TRUE = skip_hunter_verifier is 'true' (disabled), FALSE = Verifier enabled.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "strict",
    "version": 1
  },
  "conditions": [
    {
      "id": "skip-verifier-check",
      "leftValue": "={{ $('Step 4 Config').first().json.skip_hunter_verifier }}",
      "rightValue": "true",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Skip Verification
- **FALSE (output[1]) ->** Hunter Email Verifier

### Needs NamSor?

- **ID:** `3679d3b0-6f87-4c7d-9abc-45f97063a921`
- **Position:** [21664, 224]
- **Step:** Step 4: Enrich People
- **Notes:** Routes to NamSor if: enabled in config AND contact has first_name AND cultural_affinity is missing.

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "skip-namsor-check",
      "leftValue": "={{ $('Step 4 Config').first().json.skip_namsor }}",
      "rightValue": "false",
      "operator": {
        "type": "string",
        "operation": "equals"
      }
    },
    {
      "id": "has-first-name",
      "leftValue": "={{ $json.first_name }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "exists"
      }
    },
    {
      "id": "missing-affinity",
      "leftValue": "={{ $json.cultural_affinity }}",
      "rightValue": "",
      "operator": {
        "type": "string",
        "operation": "notExists"
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** NamSor Origin
- **FALSE (output[1]) ->** Skip NamSor

### Has Updates?

- **ID:** `daacc06c-14f2-49aa-93d3-3424d2ace589`
- **Position:** [22912, 224]
- **Step:** Step 4: Enrich People

**Conditions:**

```json
{
  "options": {
    "caseSensitive": true,
    "leftValue": "",
    "typeValidation": "loose"
  },
  "conditions": [
    {
      "id": "has-updates",
      "leftValue": "={{ $json._has_updates }}",
      "rightValue": true,
      "operator": {
        "type": "boolean",
        "operation": "equals",
        "singleValue": true
      }
    }
  ],
  "combinator": "and"
}
```

- **TRUE (output[0]) ->** Update Contact in Supabase
- **FALSE (output[1]) ->** Collect Updates

---

## 5. HTTP Request Node Details (36 nodes)

### Start Apify Run

- **ID:** `33ffe9a4-d680-4bd2-9d45-242130e350f5`
- **Position:** [-400, 80]
- **Step:** Step 1: Discovery
- **Method:** POST
- **URL:** `=https://api.apify.com/v2/actor-tasks/uplifted_veranda~yelp-scraper-task/runs?token={{ $env.APIFY_API_TOKEN }}`
- **onError:** `continueRegularOutput`
- **Notes:** Starts the Apify task. Returns run object with data.id for polling.

**Headers:**

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |

**Body:**

```json
={
  "searchTerms": ["{{ $json.query }}"],
  "locations": ["{{ $json.yelp_location }}"],
  "searchLimit": 5,
  "maxImages": 0,
  "reviewLimit": 0
}
```

**Timeout:** 30000ms

### Check Run Status

- **ID:** `df91ec9c-d0c8-4edb-a227-4a62e49e8707`
- **Position:** [272, 16]
- **Step:** Step 1: Discovery
- **Method:** GET
- **URL:** `=https://api.apify.com/v2/actor-runs/{{ $('Extract Run ID').first().json.runId }}?token={{ $env.APIFY_API_TOKEN }}`
- **onError:** `continueRegularOutput`

**Timeout:** 15000ms

### Google Places - Text Search

- **ID:** `730b6130-37c2-4200-b102-0e8c3e9c891d`
- **Position:** [944, -160]
- **Step:** Step 1: Discovery
- **Method:** POST
- **URL:** `https://places.googleapis.com/v1/places:searchText`
- **Notes:** Google Places API (v1). Needs HTTP Header Auth credential: name='X-Goog-Api-Key', value=your API key.

**Headers:**

| Name | Value |
|------|-------|
| `X-Goog-FieldMask` | `places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.international...` |
| `X-Goog-Api-Key` | `={{ $env.GOOGLE_PLACES_API_KEY }}` |

**Body:**

```json
={
  "textQuery": "{{ $json.query }}",
  "locationBias": {
    "circle": {
      "center": {
        "latitude": {{ $json.latitude }},
        "longitude": {{ $json.longitude }}
      },
      "radius": {{ $json.radius_meters }}
    }
  },
  "maxResultCount": 10
}
```

### Fetch Apify Results

- **ID:** `6be46492-cd6b-4ab3-bb79-3d990eb82988`
- **Position:** [944, 80]
- **Step:** Step 1: Discovery
- **Method:** GET
- **URL:** `=https://api.apify.com/v2/datasets/{{ $json.datasetId }}/items?token={{ $env.APIFY_API_TOKEN }}`

**Timeout:** 60000ms

### Insert Flagged (Needs Review)

- **ID:** `60e2440a-9ea0-4bc9-b6cd-282184cf6ce3`
- **Position:** [2288, -112]
- **Step:** Step 1: Discovery
- **Method:** POST
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/companies?on_conflict=google_place_id`
- **Notes:** Fuzzy-matched records. Status = needs_review for manual dedup.

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates` |

**Body:**

```json
={{ JSON.stringify({ name: $json.name, phone: $json.phone, domain: $json.domain, address: $json.address, city: $json.city, state: $json.state, country: $json.country, google_place_id: $json.google_place_id, category: $json.category, has_website: $json.has_website, source_urls: $json.source_urls, enrichment_status: 'needs_review', discovered_at: $json.discovered_at }) }}
```

### Insert to Supabase

- **ID:** `50d1e854-7bbf-48b7-b701-0eded1411f84`
- **Position:** [2288, 80]
- **Step:** Step 1: Discovery
- **Method:** POST
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/companies?on_conflict=google_place_id`
- **onError:** `continueRegularOutput`
- **Notes:** Clean records. Uses service_role key (bypasses RLS).

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates` |

**Body:**

```json
={{ JSON.stringify({ name: $json.name, phone: $json.phone, domain: $json.domain, address: $json.address, city: $json.city, state: $json.state, country: $json.country, google_place_id: $json.google_place_id, category: $json.category, has_website: $json.has_website, has_online_booking: $json.has_online_booking, on_groupon: $json.on_groupon, on_yelp: $json.on_yelp, google_review_count: $json.google_review_count, google_rating: $json.google_rating, source_urls: $json.source_urls, enrichment_status: 'discovered', discovered_at: $json.discovered_at }) }}
```

**Batching:** `{"batch": {}}`

### Fetch Batch from Supabase

- **ID:** `1df7b7f4-5866-4be3-8dd9-f0690b52def7`
- **Position:** [2960, -16]
- **Step:** Step 2: Company Enrichment
- **Method:** GET
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/companies?enrichment_status=eq.discovered&order=discovered_at.asc&limit={{ $json.batch_size }}&offset={{ $json.batch_offset }}&select=id,name,phone,domain,address,city,state,country,google_place_id,category,has_website,google_review_count,google_rating,source_urls,on_yelp,on_groupon`

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |

**Timeout:** 30000ms

### Google Places Lookup

- **ID:** `aea1ae1a-9214-4112-a5ec-2e3855ce4e9f`
- **Position:** [3856, 0]
- **Step:** Step 2: Company Enrichment
- **Method:** POST
- **URL:** `https://places.googleapis.com/v1/places:searchText`
- **onError:** `continueRegularOutput`

**Headers:**

| Name | Value |
|------|-------|
| `X-Goog-FieldMask` | `places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websi...` |
| `X-Goog-Api-Key` | `={{ $env.GOOGLE_PLACES_API_KEY }}` |

**Body:**

```json
={
  "textQuery": "{{ $json.name }} {{ $json.city }} {{ $json.state }}",
  "maxResultCount": 3
}
```

**Batching:** `{"batch": {"batchSize": 5}}`

### Fetch Website HTML

- **ID:** `96fc8693-42b1-47cb-96b9-2437457cf208`
- **Position:** [4752, -16]
- **Step:** Step 2: Company Enrichment
- **Method:** GET
- **URL:** `=https://{{ $json.domain }}`
- **onError:** `continueRegularOutput`
- **Notes:** Fetches homepage HTML. On error (timeout, SSL, 403, etc.) continues with error data so the pipeline doesn't break.

**Headers:**

| Name | Value |
|------|-------|
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Sa...` |
| `Accept` | `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8` |

**Timeout:** ={{ Number($('Enrichment Config').first().json.http_timeout_ms) }}ms

**Options:** `{"redirect": {"redirect": {"maxRedirects": 5}}, "response": {"response": {"fullResponse": true, "responseFormat": "text"}}}`

### Google Places Details

- **ID:** `6717c6e5-0564-4899-b6c6-e9ddd290559e`
- **Position:** [5648, -16]
- **Step:** Step 2: Company Enrichment
- **Method:** GET
- **URL:** `=https://places.googleapis.com/v1/places/{{ $json.google_place_id }}`
- **onError:** `continueRegularOutput`
- **Notes:** Fetches ONLY incremental fields not captured in Step 1 Text Search: opening hours, business status, price level, photo count.

**Headers:**

| Name | Value |
|------|-------|
| `X-Goog-FieldMask` | `currentOpeningHours,regularOpeningHours,types,photos,priceLevel,businessStatus` |
| `X-Goog-Api-Key` | `={{ $env.GOOGLE_PLACES_API_KEY }}` |

**Timeout:** 15000ms

### Update Company in Supabase

- **ID:** `9b97ccfa-b2b0-4ba3-b39a-4764000b7d3a`
- **Position:** [6320, 80]
- **Step:** Step 2: Company Enrichment
- **Method:** PATCH
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/companies?id=eq.{{ $json._company_id }}`
- **onError:** `continueRegularOutput`
- **Notes:** PATCH updates enrichment fields. Batched 10 at a time with 500ms delay to avoid overwhelming Supabase.

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=minimal` |

**Body:**

```json
={{ JSON.stringify($json._update_payload) }}
```

**Batching:** `{"batch": {"batchSize": 10, "batchInterval": 500}}`

### Start FB Search Run

- **ID:** `17bef2d1-a06d-4684-a9ad-2dbb04a60fc1`
- **Position:** [7888, 160]
- **Step:** Step 2: Company Enrichment
- **Method:** POST
- **URL:** `=https://api.apify.com/v2/actor-tasks/uplifted_veranda~facebook-search-scraper-task/runs?token={{ $env.APIFY_API_TOKEN }}`
- **onError:** `continueRegularOutput`
- **Notes:** Starts the Apify Facebook Search Scraper actor to find Facebook pages for companies without social links.

**Headers:**

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |

**Body:**

```json
={{ JSON.stringify($json._apify_input) }}
```

**Timeout:** 30000ms

### Start IG Search Run

- **ID:** `49d3af95-5128-486f-8022-a7a4f80c14db`
- **Position:** [7888, 560]
- **Step:** Step 2: Company Enrichment
- **Method:** POST
- **URL:** `=https://api.apify.com/v2/actor-tasks/uplifted_veranda~instagram-search-scraper-task/runs?token={{ $env.APIFY_API_TOKEN }}`
- **onError:** `continueRegularOutput`
- **Notes:** Starts the Apify Instagram Search Scraper actor to discover Instagram profiles.

**Headers:**

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |

**Body:**

```json
={{ JSON.stringify($json._apify_input) }}
```

**Timeout:** 30000ms

### Check FB Run Status

- **ID:** `df0b23b8-9d22-47ca-9fc1-822fd4eae973`
- **Position:** [8560, 80]
- **Step:** Step 2: Company Enrichment
- **Method:** GET
- **URL:** `=https://api.apify.com/v2/actor-runs/{{ $('Extract FB Run ID').first().json.runId }}?token={{ $env.APIFY_API_TOKEN }}`

**Timeout:** 15000ms

### Check IG Run Status

- **ID:** `9b8b4707-4e41-4498-864c-54d6675e88ef`
- **Position:** [8560, 496]
- **Step:** Step 2: Company Enrichment
- **Method:** GET
- **URL:** `=https://api.apify.com/v2/actor-runs/{{ $('Extract IG Run ID').first().json.runId }}?token={{ $env.APIFY_API_TOKEN }}`

**Timeout:** 15000ms

### Fetch FB Search Results

- **ID:** `ba4202f9-977e-4d37-beeb-1d9bc7608de7`
- **Position:** [9232, 160]
- **Step:** Step 2: Company Enrichment
- **Method:** GET
- **URL:** `=https://api.apify.com/v2/datasets/{{ $json.datasetId }}/items?token={{ $env.APIFY_API_TOKEN }}`

**Timeout:** 60000ms

### Fetch IG Search Results

- **ID:** `758fa719-c717-403e-8667-df45c89b9852`
- **Position:** [9232, 560]
- **Step:** Step 2: Company Enrichment
- **Method:** GET
- **URL:** `=https://api.apify.com/v2/datasets/{{ $json.datasetId }}/items?token={{ $env.APIFY_API_TOKEN }}`

**Timeout:** 60000ms

### Insert Social Profiles

- **ID:** `7b30136a-98cb-40ed-882d-0cea80678bdb`
- **Position:** [9904, -208]
- **Step:** Step 2: Company Enrichment
- **Method:** POST
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/social_profiles`
- **onError:** `continueRegularOutput`
- **Notes:** Inserts social profiles found from website HTML. Uses merge-duplicates to handle re-runs gracefully.

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates,return=minimal` |

**Body:**

```json
={{ JSON.stringify($json._social_rows) }}
```

### Insert FB Social Profiles

- **ID:** `7bc9a0bd-2451-4798-9b92-2cf0c0854c73`
- **Position:** [9904, 80]
- **Step:** Step 2: Company Enrichment
- **Method:** POST
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/social_profiles`
- **onError:** `continueRegularOutput`

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates,return=minimal` |

**Body:**

```json
={{ JSON.stringify($json._fb_social_rows) }}
```

### Insert IG Social Profiles

- **ID:** `d88536f0-ec38-472e-9d2f-e270b5943133`
- **Position:** [9904, 640]
- **Step:** Step 2: Company Enrichment
- **Method:** POST
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/social_profiles`
- **onError:** `continueRegularOutput`

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates,return=minimal` |

**Body:**

```json
={{ JSON.stringify($json._ig_social_rows) }}
```

### Fetch Unenriched Social Profiles

- **ID:** `e93ab76e-60c6-4cc0-a18d-e2ec7979a125`
- **Position:** [10784, 224]
- **Step:** Step 3b: Social Enrichment
- **Method:** GET
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/social_profiles?follower_count=is.null&order=scraped_at.asc&limit={{ $json.batch_size }}&offset={{ $json.batch_offset }}&select=id,company_id,platform,profile_url,follower_count,post_count,last_post_date,scraped_at`
- **Notes:** Fetches social_profiles rows where follower_count is NULL (not yet enriched by SociaVault).

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |

**Timeout:** 30000ms

### Call SociaVault API

- **ID:** `2189cd6e-39b9-44c6-8678-c9166f7e3eff`
- **Position:** [11904, 256]
- **Step:** Step 3b: Social Enrichment
- **Method:** GET
- **URL:** `={{ $json._sociavault_url }}`
- **onError:** `continueRegularOutput`
- **Notes:** Calls SociaVault profile endpoint. Batched 5 at a time with 2s delay. On error, continues.

**Headers:**

| Name | Value |
|------|-------|
| `X-API-Key` | `={{ $env.SOCIAVAULT_API_KEY }}` |

**Batching:** `{"batch": {"batchSize": 5, "batchInterval": 2000}}`

**Timeout:** 30000ms

### Update Social Profile in Supabase

- **ID:** `96c76dab-99a8-4c5f-9a3a-7776ec79fe78`
- **Position:** [12352, 256]
- **Step:** Step 3b: Social Enrichment
- **Method:** PATCH
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/social_profiles?id=eq.{{ $json._profile_id }}`
- **onError:** `continueRegularOutput`
- **Notes:** PATCH updates social_profiles row. Batched 10 at a time with 500ms delay.

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=minimal` |

**Body:**

```json
={{ JSON.stringify($json._update_payload) }}
```

**Batching:** `{"batch": {"batchSize": 10, "batchInterval": 500}}`

### Fetch Companies

- **ID:** `db34216e-3683-434e-b7d5-8482ba771481`
- **Position:** [13328, 320]
- **Step:** Step 3a: Find People
- **Method:** GET
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/companies?enrichment_status=in.(partially_enriched,fully_enriched)&order=lead_score.desc,discovered_at.asc&limit={{ $json.batch_size }}&offset={{ $json.batch_offset }}&select=id,name,phone,domain,address,city,state,country,google_place_id,category,estimated_size,has_website,google_review_count,google_rating`

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |

**Timeout:** 30000ms

### Fetch Existing Contacts

- **ID:** `1f266183-5f4e-4a95-82ae-c18850a4dd6a`
- **Position:** [13552, 320]
- **Step:** Step 3a: Find People
- **Method:** GET
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/contacts?select=company_id`
- **onError:** `continueRegularOutput`

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |

**Timeout:** 30000ms

### Apollo People Search

- **ID:** `952338c4-dc81-42b4-8848-9915039d48dc`
- **Position:** [14960, 288]
- **Step:** Step 3a: Find People
- **Method:** POST
- **URL:** `https://api.apollo.io/api/v1/mixed_people/api_search`
- **onError:** `continueRegularOutput`
- **Notes:** FREE - does not consume credits. Searches for people at the company's domain. Returns person IDs with obfuscated last names.

**Headers:**

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |
| `Cache-Control` | `no-cache` |
| `X-Api-Key` | `={{ $env.APOLLO_API_KEY }}` |

**Body:**

```json
={
  "q_organization_domains": "{{ $json.domain }}",
  "person_titles": ["owner", "founder", "ceo", "proprietor", "director", "manager", "massage therapist", "licensed massage therapist"],
  "per_page": 5
}
```

**Timeout:** 15000ms

### Fetch About Page

- **ID:** `41c40c2f-8bfd-4565-aeba-88a5eadd25f9`
- **Position:** [15536, 496]
- **Step:** Step 3a: Find People
- **Method:** GET
- **URL:** `=https://{{ $json.domain }}/about`
- **onError:** `continueRegularOutput`
- **Notes:** Fetches /about page as fallback when Apollo found no results. Tries to extract owner name from HTML.

**Headers:**

| Name | Value |
|------|-------|
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Sa...` |
| `Accept` | `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8` |

**Timeout:** 15000ms

**Options:** `{"redirect": {"redirect": {"maxRedirects": 5}}, "response": {"response": {"fullResponse": true, "responseFormat": "text"}}}`

### Apollo People Enrich

- **ID:** `1c370a70-3b98-4ed4-acb7-7ba954e23676`
- **Position:** [15744, 32]
- **Step:** Step 3a: Find People
- **Method:** POST
- **URL:** `https://api.apollo.io/api/v1/people/match`
- **onError:** `continueRegularOutput`
- **Notes:** COSTS 1 CREDIT per call. Enriches the selected person with full name, email, phone, LinkedIn. Batched 5/sec.

**Headers:**

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |
| `Cache-Control` | `no-cache` |
| `X-Api-Key` | `={{ $env.APOLLO_API_KEY }}` |

**Body:**

```json
={
  "id": "{{ $json._apollo_person_id }}",
  "reveal_personal_emails": true,
  "reveal_phone_number": false
}
```

**Batching:** `{"batch": {"batchSize": 5}}`

**Timeout:** 15000ms

### Insert Contact to Supabase

- **ID:** `e31d3abb-2a94-4a24-b668-4edeb0483f6a`
- **Position:** [16352, 304]
- **Step:** Step 3a: Find People
- **Method:** POST
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/contacts`
- **onError:** `continueRegularOutput`
- **Notes:** Inserts contact into Supabase contacts table. All paths (solo, apollo, website) converge here with the same _contact shape.

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=minimal` |

**Body:**

```json
={{ JSON.stringify($json._contact) }}
```

**Batching:** `{"batch": {"batchSize": 10, "batchInterval": 500}}`

### Fetch Contacts

- **ID:** `d334ed75-e0ca-4491-8cf7-8f206fe00170`
- **Position:** [17312, 144]
- **Step:** Step 4: Enrich People
- **Method:** GET
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/contacts?select=id,company_id,first_name,last_name,role,is_owner,email_business,email_personal,phone_direct,linkedin_url,cultural_affinity,source,email_status&order=created_at.asc&limit={{ $json.batch_size }}&offset={{ $json.batch_offset }}`
- **onError:** `continueRegularOutput`
- **Notes:** Fetches all contacts from Supabase for enrichment

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |

**Timeout:** 30000ms

### Fetch Companies1

- **ID:** `68877820-7fb4-4486-85cd-63caf86809cb`
- **Position:** [17760, 144]
- **Step:** Step 4: Enrich People
- **Method:** GET
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/companies?select=id,name,phone,domain,city,state&enrichment_status=in.(partially_enriched,fully_enriched)`
- **onError:** `continueRegularOutput`
- **Notes:** Fetches company data (domain, phone, city) to support enrichment lookups

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |

**Timeout:** 30000ms

### Hunter Email Finder

- **ID:** `5d9601c6-1954-4440-a2d9-f166c8f896c8`
- **Position:** [19008, 400]
- **Step:** Step 4: Enrich People
- **Method:** GET
- **URL:** `=https://api.hunter.io/v2/email-finder?domain={{ encodeURIComponent($json._company_domain) }}&first_name={{ encodeURIComponent($json.first_name) }}&last_name={{ encodeURIComponent($json.last_name || '') }}&api_key={{ $env.HUNTER_API_KEY }}`
- **onError:** `continueRegularOutput`
- **Notes:** Hunter.io Email Finder: domain + first_name + last_name → email. 1 credit per call. Rate limit: 15/sec, 500/min.

**Headers:**

| Name | Value |
|------|-------|
| `Accept` | `application/json` |

**Batching:** `{"batch": {"batchSize": 5}}`

**Timeout:** 15000ms

### Snov.io Email Finder

- **ID:** `d1d92981-9bf0-4121-8df2-316965fa109b`
- **Position:** [19904, 400]
- **Step:** Step 4: Enrich People
- **Method:** POST
- **URL:** `https://api.snov.io/v1/get-emails-from-names`
- **onError:** `continueRegularOutput`
- **Notes:** Snov.io fallback email finder. Requires access token via SNOVIO_ACCESS_TOKEN env var.

**Headers:**

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |

**Body:**

```json
={
  "firstName": "{{ $json.first_name }}",
  "lastName": "{{ $json.last_name || '' }}",
  "domain": "{{ $json._company_domain }}"
}
```

**Batching:** `{"batch": {"batchSize": 3, "batchInterval": 1500}}`

**Timeout:** 15000ms

### Hunter Email Verifier

- **ID:** `51de5078-11c8-4d90-9fc6-7a30396157b3`
- **Position:** [21120, 128]
- **Step:** Step 4: Enrich People
- **Method:** GET
- **URL:** `=https://api.hunter.io/v2/email-verifier?email={{ encodeURIComponent($json._best_email) }}&api_key={{ $env.HUNTER_API_KEY }}`
- **onError:** `continueRegularOutput`
- **Notes:** Hunter Email Verifier: 1 credit per call. Returns status (valid/invalid/accept_all/unknown), score, SMTP check results.

**Headers:**

| Name | Value |
|------|-------|
| `Accept` | `application/json` |

**Batching:** `{"batch": {"batchSize": 3, "batchInterval": 2000}}`

**Timeout:** 15000ms

### NamSor Origin

- **ID:** `d7043289-c4c9-4045-8b49-03e1c7bd0c13`
- **Position:** [21792, 144]
- **Step:** Step 4: Enrich People
- **Method:** GET
- **URL:** `=https://v2.namsor.com/NamSorAPIv2/api2/json/origin/{{ encodeURIComponent($json.first_name) }}/{{ encodeURIComponent($json.last_name || 'Unknown') }}`
- **onError:** `continueRegularOutput`
- **Notes:** NamSor Origin API: first_name + last_name → country of origin, region, sub-region. 10 credits per name. Auth via X-API-KEY header.

**Headers:**

| Name | Value |
|------|-------|
| `X-API-KEY` | `={{ $env.NAMSOR_API_KEY }}` |
| `Accept` | `application/json` |

**Batching:** `{"batch": {"batchSize": 5, "batchInterval": 500}}`

**Timeout:** 10000ms

### Update Contact in Supabase

- **ID:** `cef9b4ed-9820-4d9c-8da1-e789cbb004d4`
- **Position:** [23136, 112]
- **Step:** Step 4: Enrich People
- **Method:** PATCH
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/contacts?id=eq.{{ $json._contact_id }}`
- **onError:** `continueRegularOutput`
- **Notes:** PATCH updates the contact record with enriched fields. Only sends changed fields.

**Headers:**

| Name | Value |
|------|-------|
| `apikey` | `={{ $env.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=minimal` |

**Body:**

```json
={{ JSON.stringify($json._update_payload) }}
```

**Batching:** `{"batch": {"batchSize": 10, "batchInterval": 500}}`

**Timeout:** 15000ms

---

## 6. Code Node Details (72 nodes)

### Duplicate Code Groups

The following code blocks are duplicated across multiple nodes. Each group is documented once,
with all node names listed.

- **Bridge to 3b pattern:** Bridge to 3b, Bridge to 3a, Bridge to 4
- **Validate & Clean Contact3 pattern:** Validate & Clean Contact3, Validate & Clean Contact4, Validate & Clean Contact2, Validate & Clean Contact1, Validate & Clean Contact

### Split Search Queries

- **ID:** `2210a103-e3ea-49ee-b541-d68b7e9a5e34`
- **Position:** [-624, -16]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 12

**jsCode:**

```javascript
const config = $input.first().json;
const queries = config.search_queries.split(',').map(q => q.trim());
return queries.map(query => ({
  json: {
    query,
    latitude: config.latitude,
    longitude: config.longitude,
    radius_meters: config.radius_meters,
    metro_name: config.metro_name,
    yelp_location: config.yelp_location
  }
}));
```

**Input fields (detected):** (none detected)

### Extract Run ID

- **ID:** `c009a50e-d98f-42fb-ad5c-ffe08f1348cc`
- **Position:** [-176, 80]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 14

**jsCode:**

```javascript
const response = $input.first().json;
let runId = '';
let datasetId = '';

if (response.data) {
  runId = response.data.id || '';
  datasetId = response.data.defaultDatasetId || '';
}

if (!runId) {
  throw new Error('Failed to start Apify run. Response: ' + JSON.stringify(response).substring(0, 500));
}

return [{ json: { runId, datasetId, pollCount: 0 } }];
```

**Input fields (detected):** (none detected)

### Parse Status

- **ID:** `984c8d00-213b-48a1-a366-ecad587f54f5`
- **Position:** [496, 16]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 27

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Extract Run ID` | `.first` |
| `Parse Status` | `.first` |

**jsCode:**

```javascript
const response = $input.first().json;
const prevData = $('Extract Run ID').first().json;

let status = 'UNKNOWN';
let datasetId = prevData.datasetId || '';

// Single run response
if (response.data && response.data.status && !response.data.items) {
  status = response.data.status;
  if (response.data.defaultDatasetId) datasetId = response.data.defaultDatasetId;
}
// List response
else if (response.data && response.data.items && response.data.items.length > 0) {
  status = response.data.items[0].status;
  if (response.data.items[0].defaultDatasetId) datasetId = response.data.items[0].defaultDatasetId;
}

// Increment poll count from previous Parse Status if looping, otherwise from Extract Run ID
let pollCount = 0;
try {
  pollCount = $('Parse Status').first().json.pollCount || 0;
} catch(e) {
  pollCount = prevData.pollCount || 0;
}
pollCount++;

return [{ json: { runId: prevData.runId, datasetId, pollCount, status } }];
```

**Input fields (detected):** (none detected)

### Normalize Google Results

- **ID:** `ce2cbb27-b415-41b3-a093-6ed18a008655`
- **Position:** [1168, -160]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 54

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Metro Config` | `.first` |

**jsCode:**

```javascript
const allInputs = JSON.parse(JSON.stringify($input.all().map(i => i.json)));
const allPlaces = [];

for (const input of allInputs) {
  const places = input.places || [];
  const q = input.query || '';
  places.forEach(p => { p._query = q; });
  allPlaces.push(...places);
}

const metro = JSON.parse(JSON.stringify($('Metro Config').first().json)).metro_name;

return allPlaces.map(place => {
  let city = '', state = '', country = '';
  if (place.addressComponents) {
    for (const comp of place.addressComponents) {
      if (comp.types && comp.types.includes('locality')) city = comp.longText || '';
      if (comp.types && comp.types.includes('administrative_area_level_1')) state = comp.shortText || '';
      if (comp.types && comp.types.includes('country')) country = comp.shortText || '';
    }
  }

  let phone = place.internationalPhoneNumber || place.nationalPhoneNumber || '';
  let phoneNormalized = phone.replace(/[^\d+]/g, '');
  if (phoneNormalized && !phoneNormalized.startsWith('+')) {
    phoneNormalized = '+1' + phoneNormalized.replace(/^1/, '');
  }

  const website = place.websiteUri || '';
  let domain = '';
  if (website) {
    const match = website.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
    if (match) domain = match[1];
  }

  return {
    json: {
      name: (place.displayName && place.displayName.text) || '',
      phone: phoneNormalized,
      domain: domain,
      address: place.formattedAddress || '',
      city, state, country: country || 'US',
      google_place_id: place.id || '',
      category: (place.primaryTypeDisplayName && place.primaryTypeDisplayName.text) || place.primaryType || '',
      google_rating: place.rating || null,
      google_review_count: place.userRatingCount || 0,
      has_website: !!website,
      google_maps_url: place.googleMapsUri || '',
      source_urls: [{source: 'google_places', url: place.googleMapsUri || '', query_used: place._query || ''}],
      discovery_metro: metro,
      discovery_source: 'google_places'
    }
  };
});
```

**Input fields (detected):** (none detected)

### Normalize Yelp Results

- **ID:** `f00aa961-127f-44d3-be9b-bff95186e169`
- **Position:** [1168, 80]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 52
- **Notes:** After testing, change $('Test Input (Remove After Testing)') to $('Metro Config') and $('Split Search Queries').

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Metro Config` | `.first` |
| `Split Search Queries` | `.first` |

**jsCode:**

```javascript
const metro = $('Metro Config').first().json.metro_name;
const query = $('Split Search Queries').first().json.query || '';
const results = [];

for (const item of items) {
  const biz = item.json;
  if (!biz.name) continue;

  let phone = (biz.phone || '').replace(/[^\d+]/g, '');
  if (phone && !phone.startsWith('+')) {
    phone = '+1' + phone.replace(/^1/, '');
  }

  let domain = '';
  if (biz.website) {
    try {
      domain = new URL(biz.website.startsWith('http') ? biz.website : 'https://' + biz.website)
        .hostname.replace(/^www\./, '');
    } catch(e) {}
  }

  const addr = biz.address || {};
  const fullAddress = [addr.addressLine1, addr.addressLine2, addr.addressLine3]
    .filter(Boolean).join(', ');

  results.push({
    json: {
      name: biz.name,
      phone: phone,
      domain: domain,
      address: fullAddress,
      city: addr.city || '',
      state: addr.regionCode || '',
      country: addr.country || 'US',
      google_place_id: '',
      category: (biz.categories || []).join(', '),
      google_rating: null,
      google_review_count: 0,
      yelp_rating: biz.aggregatedRating || null,
      yelp_review_count: biz.reviewCount || 0,
      has_website: !!biz.website,
      yelp_url: biz.directUrl || '',
      yelp_is_claimed: biz.claimed || false,
      yelp_is_advertiser: biz.advertiser || false,
      source_urls: [{source: 'yelp_apify', url: biz.directUrl || '', query_used: query}],
      discovery_metro: metro,
      discovery_source: 'yelp_apify'
    }
  });
}

return results.length > 0 ? results : [{ json: { _empty: true } }];
```

**Input fields (detected):** (none detected)

### Deduplicate Records

- **ID:** `b7179d36-5ffc-439f-b846-5bb143a38078`
- **Position:** [1616, -16]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 74

**jsCode:**

```javascript
const items = $input.all().map(i => i.json);
const canonical = [];
const phoneIndex = {};
const domainIndex = {};

function normalizePhone(p) { return (p || '').replace(/[^\d+]/g, ''); }
function normalizeDomain(d) { return (d || '').toLowerCase().replace(/^www\./, '').trim(); }
function normalizeName(n) { return (n || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(); }
function nameSimilarity(a, b) {
  const setA = new Set(normalizeName(a).split(/\s+/));
  const setB = new Set(normalizeName(b).split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

for (const item of items) {
  const phone = normalizePhone(item.phone);
  const domain = normalizeDomain(item.domain);
  const city = (item.city || '').toLowerCase();
  let matched = false;

  if (phone && phone.length >= 10 && phoneIndex[phone] !== undefined) {
    const existing = canonical[phoneIndex[phone]];
    existing.source_urls = [...(existing.source_urls || []), ...(item.source_urls || [])];
    if (!existing.domain && item.domain) existing.domain = item.domain;
    if (!existing.google_place_id && item.google_place_id) existing.google_place_id = item.google_place_id;
    if (!existing.has_website && item.has_website) existing.has_website = item.has_website;
    if (item.google_rating) existing.google_rating = item.google_rating;
    if (item.google_review_count) existing.google_review_count = item.google_review_count;
    if (item.yelp_rating) existing.yelp_rating = item.yelp_rating;
    if (item.yelp_review_count) existing.yelp_review_count = item.yelp_review_count;
    if (item.yelp_url) existing.yelp_url = item.yelp_url;
    matched = true;
  }

  if (!matched && domain && domainIndex[domain] !== undefined) {
    const existing = canonical[domainIndex[domain]];
    existing.source_urls = [...(existing.source_urls || []), ...(item.source_urls || [])];
    if (!existing.phone && item.phone) existing.phone = item.phone;
    if (!existing.google_place_id && item.google_place_id) existing.google_place_id = item.google_place_id;
    if (item.google_rating) existing.google_rating = item.google_rating;
    if (item.google_review_count) existing.google_review_count = item.google_review_count;
    if (item.yelp_rating) existing.yelp_rating = item.yelp_rating;
    if (item.yelp_review_count) existing.yelp_review_count = item.yelp_review_count;
    if (item.yelp_url) existing.yelp_url = item.yelp_url;
    matched = true;
  }

  if (!matched) {
    let fuzzyMatch = false;
    for (let i = 0; i < canonical.length; i++) {
      const existing = canonical[i];
      if ((existing.city || '').toLowerCase() === city && city !== '') {
        if (nameSimilarity(existing.name, item.name) >= 0.85) {
          existing.source_urls = [...(existing.source_urls || []), ...(item.source_urls || [])];
          existing._fuzzy_match_flag = true;
          existing._fuzzy_match_names = [...(existing._fuzzy_match_names || [existing.name]), item.name];
          fuzzyMatch = true;
          break;
        }
      }
    }
    if (!fuzzyMatch) {
      const idx = canonical.length;
      canonical.push({...item});
      if (phone && phone.length >= 10) phoneIndex[phone] = idx;
      if (domain) domainIndex[domain] = idx;
    }
  }
}

console.log('Dedup:', items.length, 'raw ->', canonical.length, 'unique,', canonical.filter(c => c._fuzzy_match_flag).length, 'fuzzy flagged');
return canonical.map(item => ({ json: item }));
```

**Input fields (detected):** city, domain, google_place_id, google_rating, google_review_count, has_website, name, phone, source_urls, yelp_rating, yelp_review_count, yelp_url

### Prepare for Supabase

- **ID:** `977fd0f5-761e-4305-9801-29dc56b91d20`
- **Position:** [1840, -16]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 19

**jsCode:**

```javascript
const now = new Date().toISOString();
return $input.all().map(item => {
  const r = item.json;
  return { json: {
    name: r.name, phone: r.phone || null, domain: r.domain || null,
    address: r.address || null, city: r.city || null, state: r.state || null,
    country: r.country || 'US', google_place_id: r.google_place_id || null,
    category: r.category || null, has_website: r.has_website || false,
    has_online_booking: false, booking_platform: null, has_paid_ads: false,
    on_groupon: false,
    on_yelp: (r.source_urls || []).some(s => s.source === 'yelp_apify'),
    google_review_count: r.google_review_count || 0,
    google_rating: r.google_rating || null,
    estimated_size: null, source_urls: r.source_urls || [],
    enrichment_status: r._fuzzy_match_flag ? 'needs_review' : 'discovered',
    lead_score: 0, discovered_at: now, enriched_at: null,
    _fuzzy_match_flag: r._fuzzy_match_flag || false
  }};
});
```

**Input fields (detected):** (none detected)

### Run Summary

- **ID:** `904634a5-cffe-431f-ab8d-d912d5801553`
- **Position:** [2512, -16]
- **Step:** Step 1: Discovery
- **Mode:** `runOnceForAllItems`
- **Lines:** 18

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Deduplicate Records` | `.all` |
| `Metro Config` | `.first` |

**jsCode:**

```javascript
const allItems = $('Deduplicate Records').all();
const metro = $('Metro Config').first().json.metro_name;
const fromGoogle = allItems.filter(i => (i.json.source_urls || []).some(s => s.source === 'google_places')).length;
const fromYelp = allItems.filter(i => (i.json.source_urls || []).some(s => s.source === 'yelp_apify')).length;
const bothSources = allItems.filter(i => { const s = (i.json.source_urls || []).map(x => x.source); return s.includes('google_places') && s.includes('yelp_apify'); }).length;
const fuzzyFlagged = allItems.filter(i => i.json._fuzzy_match_flag).length;

const summary = {
  metro, run_timestamp: new Date().toISOString(),
  total_unique_records: allItems.length,
  found_on_google: fromGoogle, found_on_yelp: fromYelp, found_on_both: bothSources,
  flagged_for_review: fuzzyFlagged,
  clean_records: allItems.length - fuzzyFlagged,
  sources_used: ['google_places', 'yelp_apify']
};
console.log('=== DISCOVERY RUN SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
return [{ json: summary }];
```

**Input fields (detected):** (none detected)

### Parse Batch

- **ID:** `ec61713a-fd89-4810-9ff3-497601e24a3f`
- **Position:** [3184, -16]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 24

**jsCode:**

```javascript
// Supabase HTTP node may return items individually (one per row) or as a single array.
// Handle both cases.
const allInputs = $input.all();

let companies = [];

if (allInputs.length === 1 && Array.isArray(allInputs[0].json)) {
  // Single item containing an array
  companies = allInputs[0].json;
} else if (allInputs.length === 1 && allInputs[0].json[0]) {
  // Single item with nested array
  companies = allInputs[0].json;
} else {
  // Multiple items, one company per item (this is what n8n HTTP node does)
  companies = allInputs.map(i => i.json);
}

if (!companies || companies.length === 0 || (companies.length === 1 && !companies[0].id)) {
  return [{ json: { _empty: true, _count: 0, _message: 'No companies to enrich in this batch' } }];
}

console.log(`Batch loaded: ${companies.length} companies to enrich`);

return companies.map(c => ({ json: c }));
```

**Input fields (detected):** (none detected)

### No Records - Done

- **ID:** `5d72c418-ea8c-4a59-b38a-42bfc0cfacd0`
- **Position:** [3632, -112]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**jsCode:**

```javascript
return [{ json: { message: 'No companies with enrichment_status=discovered found. Step 2 complete or no Step 1 data available.', completed_at: new Date().toISOString() } }];
```

**Input fields (detected):** (none detected)

### Extract & Patch Domain

- **ID:** `10e8341e-4856-400b-994a-ccda048aa054`
- **Position:** [4080, 16]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 68

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Needs Backfill?` | `.item.json` |

**jsCode:**

```javascript
const company = $('Needs Backfill?').item.json;
const response = $input.item.json;
const places = response.places || [];

if (places.length === 0) {
  return { json: { ...company } };
}

const companyName = (company.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
const companyPhone = (company.phone || '').replace(/[^\d]/g, '');

let bestMatch = null;
let bestScore = 0;

for (const place of places) {
  const placeName = ((place.displayName && place.displayName.text) || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
  let score = 0;

  const companyWords = companyName.split(/\s+/).filter(w => w.length > 2);
  const placeWords = placeName.split(/\s+/).filter(w => w.length > 2);
  const matchingWords = companyWords.filter(w => placeWords.some(pw => pw.includes(w) || w.includes(pw)));
  score = companyWords.length > 0 ? matchingWords.length / companyWords.length : 0;

  const placePhone = (place.internationalPhoneNumber || place.nationalPhoneNumber || '').replace(/[^\d]/g, '');
  if (companyPhone && placePhone && (placePhone.includes(companyPhone.slice(-10)) || companyPhone.includes(placePhone.slice(-10)))) {
    score += 0.5;
  }

  if (score > bestScore && score >= 0.4) {
    bestScore = score;
    bestMatch = place;
  }
}

if (!bestMatch) {
  return { json: { ...company } };
}

const website = bestMatch.websiteUri || '';
let domain = null;
if (website) {
  const match = website.match(/^https?:\/\/(?:www\.)?([^\/]+)/i);
  if (match) domain = match[1];
}

// Merge found data into the company item so downstream nodes see it
const updated = { ...company };
if (bestMatch.id && !company.google_place_id) updated.google_place_id = bestMatch.id;
if (domain) {
  updated.domain = domain;
  updated.has_website = true;
}
if (bestMatch.rating && !company.google_rating) updated.google_rating = bestMatch.rating;
if (bestMatch.userRatingCount && !company.google_review_count) updated.google_review_count = bestMatch.userRatingCount;

// Also build a Supabase patch payload for persistence
const patch = {};
if (updated.google_place_id !== company.google_place_id) patch.google_place_id = updated.google_place_id;
if (updated.domain !== company.domain) patch.domain = updated.domain;
if (updated.has_website !== company.has_website) patch.has_website = updated.has_website;
if (updated.google_rating !== company.google_rating) patch.google_rating = updated.google_rating;
if (updated.google_review_count !== company.google_review_count) patch.google_review_count = updated.google_review_count;

updated._backfill_patch = Object.keys(patch).length > 0 ? patch : null;
updated._backfill_matched = bestMatch.displayName?.text || '';
updated._backfill_score = bestScore;

return { json: updated };
```

**Input fields (detected):** domain, google_place_id, google_rating, google_review_count, has_website, name, phone

### Analyze Website HTML

- **ID:** `f8073621-1fb3-457a-a51c-39ebc171d9e7`
- **Position:** [4976, -16]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 193
- **Notes:** Detects booking platforms, paid ads scripts, social media links, and estimates team size from website HTML.

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Has Website?` | `.item.json` |

**jsCode:**

```javascript
const company = $('Has Website?').item.json;
const response = $input.item.json;
const domain = (company.domain || '').toLowerCase();

// === DOMAIN-BASED BOOKING DETECTION (runs even if fetch fails) ===
const bookingSignatures = {
  'jane_app': ['jane.app', 'janeapp.com'],
  'acuity': ['acuityscheduling.com', 'squareup.com/appointments', 'app.acuityscheduling.com'],
  'mindbody': ['mindbodyonline.com', 'clients.mindbodyonline.com', 'mindbody.io', 'healcode.com'],
  'square': ['square.site', 'squareup.com'],
  'vagaro': ['vagaro.com'],
  'fresha': ['fresha.com', 'shedul.com'],
  'schedulicity': ['schedulicity.com'],
  'schedulista': ['schedulista.com'],
  'booksy': ['booksy.com'],
  'massagebook': ['massagebook.com'],
  'genbook': ['genbook.com'],
  'noterro': ['noterro.com'],
  'clinicsense': ['clinicsense.com'],
  'wix_bookings': ['wix.com/booking', 'bookings.wixapps.net'],
  'calendly': ['calendly.com']
};

let booking_platform = null;
let has_online_booking = false;

// Check domain first — catches cases like xyz.schedulista.com or xyz.janeapp.com
for (const [platform, signatures] of Object.entries(bookingSignatures)) {
  for (const sig of signatures) {
    if (domain.includes(sig)) {
      booking_platform = platform;
      has_online_booking = true;
      break;
    }
  }
  if (has_online_booking) break;
}

// Handle fetch errors — still return domain-based findings
if (response.error || (!response.body && !response.data)) {
  return {
    json: {
      ...company,
      _website_enrichment: {
        has_online_booking,
        booking_platform,
        has_paid_ads: false,
        estimated_size: null,
        social_links_found: [],
        _website_fetch_status: 'error',
        _website_error: response.error || 'Empty response'
      }
    }
  };
}

const rawHtml = response.body || response.data || '';
const html = (typeof rawHtml === 'string' ? rawHtml : '').toLowerCase();
const htmlOriginal = typeof rawHtml === 'string' ? rawHtml : '';

// === HTML-BASED BOOKING DETECTION (supplements domain detection) ===
if (!has_online_booking) {
  for (const [platform, signatures] of Object.entries(bookingSignatures)) {
    for (const sig of signatures) {
      if (html.includes(sig)) {
        booking_platform = platform;
        has_online_booking = true;
        break;
      }
    }
    if (has_online_booking) break;
  }
}

// Also check for generic booking button patterns
if (!has_online_booking) {
  const bookingPatterns = ['book now', 'book online', 'book appointment', 'schedule now', 'schedule online', 'book a massage', 'online booking'];
  for (const pattern of bookingPatterns) {
    if (html.includes(pattern)) {
      has_online_booking = true;
      booking_platform = 'unknown';
      break;
    }
  }
}

// === PAID ADS DETECTION ===
// Only flag actual advertising/conversion pixels, NOT basic analytics
const adSignatures = [
  // Google Ads (NOT analytics — gtag/js and google-analytics.com are just tracking)
  'googleadservices.com',
  'googlesyndication.com', 
  'googleads.g.doubleclick.net',
  'google_conversion',
  'conversion_async',
  'ads/ga-audiences',
  // Meta/Facebook Ads (fbevents.js + fbq( = Meta Pixel with conversion tracking)
  'fbevents.js',
  'fbq(',
  // LinkedIn Ads
  'snap.licdn.com',
  'linkedin.com/insight',
  // TikTok Ads
  'analytics.tiktok.com',
  'tiktok.com/i18n/pixel',
  // Twitter/X Ads
  'ads-twitter.com',
  'static.ads-twitter.com'
];

let has_paid_ads = false;
const detected_ad_platforms = [];
for (const sig of adSignatures) {
  if (html.includes(sig)) {
    has_paid_ads = true;
    detected_ad_platforms.push(sig);
  }
}

// === SOCIAL LINKS EXTRACTION ===
const socialPatterns = {
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/gi,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+/gi,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/gi,
  x: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9._-]+/gi,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[a-zA-Z0-9._-]+/gi
};

const social_links_found = [];
const seenPlatforms = new Set();

for (const [platform, regex] of Object.entries(socialPatterns)) {
  const matches = htmlOriginal.match(regex) || [];
  for (const url of matches) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('/sharer') || lowerUrl.includes('/share') || 
        lowerUrl.includes('/intent') || lowerUrl.includes('/login') ||
        lowerUrl.includes('/help') || lowerUrl.includes('/about') ||
        lowerUrl.includes('/policies') || lowerUrl.includes('/privacy')) {
      continue;
    }
    if (!seenPlatforms.has(platform)) {
      social_links_found.push({ platform, url: url.replace(/\/+$/, '') });
      seenPlatforms.add(platform);
    }
  }
}

// === TEAM SIZE ESTIMATION ===
let estimated_size = null;
const teamPatterns = [
  /our\s+team/i, /meet\s+(?:the\s+)?team/i, /our\s+(?:therapists|practitioners|staff|massage\s+therapists)/i,
  /meet\s+(?:our|the)\s+(?:therapists|practitioners|staff)/i
];

let hasTeamPage = false;
for (const p of teamPatterns) {
  if (p.test(htmlOriginal)) {
    hasTeamPage = true;
    break;
  }
}

if (hasTeamPage) {
  const namePatterns = htmlOriginal.match(/<h[2-4][^>]*>[^<]{2,40}<\/h[2-4]>/gi) || [];
  const staffLinks = htmlOriginal.match(/\/(?:team|staff|therapist|practitioner)s?\/[a-z-]+/gi) || [];
  const memberCount = Math.max(namePatterns.length, staffLinks.length);
  
  if (memberCount <= 1) estimated_size = 'solo';
  else if (memberCount <= 5) estimated_size = 'small';
  else estimated_size = 'medium';
} else {
  const soloSignals = ['sole proprietor', 'solo practice', 'independent massage', 
    'i am a licensed', 'i\'m a licensed', 'about me', 'my practice', 'my approach',
    'my services', 'i specialize', 'i provide'];
  const isSolo = soloSignals.some(s => html.includes(s));
  if (isSolo) estimated_size = 'solo';
}

return {
  json: {
    ...company,
    _website_enrichment: {
      has_online_booking,
      booking_platform,
      has_paid_ads,
      estimated_size,
      social_links_found,
      _website_fetch_status: 'success'
    }
  }
};
```

**Input fields (detected):** domain

### Skip - No Website

- **ID:** `4132b860-779c-490f-9de8-3285e6a63538`
- **Position:** [4976, 176]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 50

**jsCode:**

```javascript
// For companies without a website, pass through with empty enrichment
// but still check domain for booking platform signals
const item = $input.item.json;
const domain = (item.domain || '').toLowerCase();

const bookingSignatures = {
  'jane_app': ['jane.app', 'janeapp.com'],
  'acuity': ['acuityscheduling.com', 'squareup.com/appointments'],
  'mindbody': ['mindbodyonline.com', 'clients.mindbodyonline.com', 'mindbody.io'],
  'square': ['square.site', 'squareup.com'],
  'vagaro': ['vagaro.com'],
  'fresha': ['fresha.com', 'shedul.com'],
  'schedulicity': ['schedulicity.com'],
  'schedulista': ['schedulista.com'],
  'booksy': ['booksy.com'],
  'massagebook': ['massagebook.com'],
  'genbook': ['genbook.com'],
  'noterro': ['noterro.com'],
  'clinicsense': ['clinicsense.com'],
  'wix_bookings': ['wix.com/booking'],
  'calendly': ['calendly.com']
};

let booking_platform = null;
let has_online_booking = false;

for (const [platform, signatures] of Object.entries(bookingSignatures)) {
  for (const sig of signatures) {
    if (domain.includes(sig)) {
      booking_platform = platform;
      has_online_booking = true;
      break;
    }
  }
  if (has_online_booking) break;
}

return {
  json: {
    ...item,
    _website_enrichment: {
      has_online_booking,
      booking_platform,
      has_paid_ads: false,
      estimated_size: null,
      social_links_found: [],
      _website_fetch_status: 'skipped_no_website'
    }
  }
};
```

**Input fields (detected):** domain

### Merge Website Results

- **ID:** `4cca63b6-84fa-471f-a957-24ca66de88cf`
- **Position:** [5200, 80]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 41

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Enrichment Config` | `.first` |

**jsCode:**

```javascript
// Merge website-enriched (from both paths: with website and without)
const item = $input.item.json;
const enrichment = item._website_enrichment || {};
// Enrichment Config is a single-item node, .first() is correct here
const config = $('Enrichment Config').first().json;
const skipGoogleDetails = config.skip_google_details === 'true' || config.skip_google_details === true;

// Prepare the enriched company object
const enriched = {
  id: item.id,
  name: item.name,
  phone: item.phone,
  domain: item.domain,
  address: item.address,
  city: item.city,
  state: item.state,
  country: item.country,
  google_place_id: item.google_place_id,
  category: item.category,
  has_website: item.has_website,
  google_review_count: item.google_review_count,
  google_rating: item.google_rating,
  source_urls: item.source_urls,
  on_yelp: item.on_yelp,
  on_groupon: item.on_groupon,

  // Enriched fields from website analysis
  has_online_booking: enrichment.has_online_booking || false,
  booking_platform: enrichment.booking_platform || null,
  has_paid_ads: enrichment.has_paid_ads || false,
  estimated_size: enrichment.estimated_size || null,

  // Social links for later processing
  _social_links_found: enrichment.social_links_found || [],
  _website_fetch_status: enrichment._website_fetch_status || 'unknown',
  _website_error: enrichment._website_error || null,
  _needs_social_discovery: (enrichment.social_links_found || []).length === 0,
  _skip_google_details: skipGoogleDetails
};

return { json: enriched };
```

**Input fields (detected):** _website_enrichment, address, category, city, country, domain, google_place_id, google_rating, google_review_count, has_website, id, name, on_groupon, on_yelp, phone, source_urls, state

### Skip Google Details

- **ID:** `29512238-af71-45a1-8965-58e94e021c20`
- **Position:** [5760, 192]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 15

**jsCode:**

```javascript
// Companies without Google Place ID skip details fetch
const company = $input.item.json;
return {
  json: {
    ...company,
    _google_details: {
      opening_hours: null,
      business_status: null,
      photo_count: 0,
      price_level: null,
      additional_types: [],
      _fetch_status: 'skipped'
    }
  }
};
```

**Input fields (detected):** (none detected)

### Parse Google Details

- **ID:** `6647ac0d-5b45-48b6-9131-44b282df0536`
- **Position:** [5872, -16]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 39

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Has Google Place ID?` | `.item.json` |

**jsCode:**

```javascript
const company = $('Has Google Place ID?').item.json;
const details = $input.item.json;

// Extract incremental data from Google Places Details
let opening_hours = null;
let business_status = null;
let photo_count = 0;
let price_level = null;
let additional_types = [];

if (details && !details.error) {
  if (details.regularOpeningHours && details.regularOpeningHours.periods) {
    opening_hours = details.regularOpeningHours;
  } else if (details.currentOpeningHours && details.currentOpeningHours.periods) {
    opening_hours = details.currentOpeningHours;
  }
  business_status = details.businessStatus || null;
  if (details.photos && Array.isArray(details.photos)) {
    photo_count = details.photos.length;
  }
  price_level = details.priceLevel || null;
  if (details.types && Array.isArray(details.types)) {
    additional_types = details.types;
  }
}

return {
  json: {
    ...company,
    _google_details: {
      opening_hours,
      business_status,
      photo_count,
      price_level,
      additional_types,
      _fetch_status: details.error ? 'error' : 'success'
    }
  }
};
```

**Input fields (detected):** (none detected)

### Prepare Company Update

- **ID:** `3b5fc27e-97c5-47b3-8310-6aedf579403f`
- **Position:** [6096, 80]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 28

**jsCode:**

```javascript
const item = $input.item.json;
const now = new Date().toISOString();

// Build the PATCH payload for Supabase
const updatePayload = {
  has_online_booking: item.has_online_booking || false,
  booking_platform: item.booking_platform || null,
  has_paid_ads: item.has_paid_ads || false,
  estimated_size: item.estimated_size || null,
  enrichment_status: 'partially_enriched',
  enriched_at: now
};

// Include backfill data if present (from Google Places lookup)
if (item.domain) updatePayload.domain = item.domain;
if (item.google_place_id) updatePayload.google_place_id = item.google_place_id;
if (item.has_website) updatePayload.has_website = item.has_website;
if (item.google_rating) updatePayload.google_rating = item.google_rating;
if (item.google_review_count) updatePayload.google_review_count = item.google_review_count;

return {
  json: {
    _company_id: item.id,
    _update_payload: updatePayload,
    // Pass through everything for social discovery
    ...item
  }
};
```

**Input fields (detected):** booking_platform, domain, estimated_size, google_place_id, google_rating, google_review_count, has_online_booking, has_paid_ads, has_website, id

### Prepare Social Processing

- **ID:** `f17fc381-44bf-45a8-97c4-5a7bffa58763`
- **Position:** [6544, 80]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 21

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Prepare Company Update` | `.item.json` |
| `Enrichment Config` | `.first` |

**jsCode:**

```javascript
// Collect social links found from website analysis per company
// and determine which companies need Apify social discovery
const item = $('Prepare Company Update').item.json;
const config = $('Enrichment Config').first().json;
const skipSocial = config.skip_social_discovery === 'true' || config.skip_social_discovery === true;

const socialLinks = item._social_links_found || [];
const needsDiscovery = item._needs_social_discovery && !skipSocial;

return {
  json: {
    company_id: item.id,
    company_name: item.name,
    city: item.city,
    state: item.state,
    domain: item.domain,
    social_links_found: socialLinks,
    needs_social_discovery: needsDiscovery,
    _skip_social: skipSocial
  }
};
```

**Input fields (detected):** _needs_social_discovery, _social_links_found, city, domain, id, name, state

### Build Social Discovery Batch

- **ID:** `25e99149-3f48-4929-8367-77d6d519c3f0`
- **Position:** [7216, 352]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 34

**jsCode:**

```javascript
// Collect all companies that need social discovery into a single batch for Apify
// This node collects items from the loop and builds the search queries
const items = $input.all();

const searchQueries = [];
const companyMap = {};

for (const item of items) {
  const data = item.json;
  if (!data.company_name || !data.city) continue;
  
  const searchTerm = `${data.company_name} ${data.city} ${data.state || ''} massage`.trim();
  searchQueries.push({
    company_id: data.company_id,
    company_name: data.company_name,
    city: data.city,
    state: data.state,
    search_term: searchTerm
  });
}

if (searchQueries.length === 0) {
  return [{ json: { _no_social_discovery_needed: true, _count: 0 } }];
}

console.log(`Social discovery needed for ${searchQueries.length} companies`);

return [{
  json: {
    _social_discovery_queries: searchQueries,
    _count: searchQueries.length,
    _no_social_discovery_needed: false
  }
}];
```

**Input fields (detected):** (none detected)

### Prepare FB Search Input

- **ID:** `7b641251-6e69-4b6a-938b-c620cb2b3411`
- **Position:** [7664, 160]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 26

**jsCode:**

```javascript
// Build the Apify Facebook Search Scraper input
// Actor: apify/facebook-search-scraper
// Input fields: categories (array of search terms), locations (array), resultsLimit (number)
const data = $input.first().json;
const queries = data._social_discovery_queries || [];

// Build category search terms: "CompanyName City" for each company
const categories = queries.map(q => 
  `${q.company_name} ${q.city}`.trim()
).slice(0, 100);

// Get unique locations in "City, State" format
const locations = [...new Set(
  queries.map(q => `${q.city}, ${q.state}`.trim()).filter(l => l !== ',')
)];

return [{
  json: {
    _queries: queries,
    _apify_input: {
      categories: categories,
      locations: locations,
      resultsLimit: 3
    }
  }
}];
```

**Input fields (detected):** (none detected)

### Prepare IG Search Input

- **ID:** `e66efe26-7960-4cc6-ae76-73360b4877c7`
- **Position:** [7664, 560]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 35

**jsCode:**

```javascript
// Build the Apify Instagram Search Scraper input
// Actor: apify/instagram-search-scraper
// Input fields: search (single string), searchType (string), searchLimit (number),
//               enhanceUserSearchWithFacebookPage (boolean)
//
// LIMITATION: IG Search Scraper takes ONE search string per run.
// Strategy: We search for "massage therapy [city] [state]" to find local businesses,
// then match results back to individual companies.
const data = $input.first().json;
const queries = data._social_discovery_queries || [];

if (queries.length === 0) {
  return [{ json: { _queries: queries, _apify_input: {}, _ig_skip: true } }];
}

// Get the most common city from the batch (they're likely all the same metro)
const cityCounts = {};
for (const q of queries) {
  const loc = `${q.city} ${q.state}`.trim();
  cityCounts[loc] = (cityCounts[loc] || 0) + 1;
}
const primaryCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0][0];

return [{
  json: {
    _queries: queries,
    _apify_input: {
      search: `massage therapy ${primaryCity}`,
      searchType: "user",
      searchLimit: Math.min(queries.length * 2, 50),
      enhanceUserSearchWithFacebookPage: false
    },
    _ig_skip: false
  }
}];
```

**Input fields (detected):** (none detected)

### Extract FB Run ID

- **ID:** `152148a5-b362-4fe2-8352-b04c1b585da1`
- **Position:** [8112, 160]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 16

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Prepare FB Search Input` | `.first` |

**jsCode:**

```javascript
const response = $input.first().json;
const queries = $('Prepare FB Search Input').first().json._queries;
let runId = '';
let datasetId = '';

if (response.data) {
  runId = response.data.id || '';
  datasetId = response.data.defaultDatasetId || '';
}

if (!runId) {
  console.log('Facebook Search: Failed to start run. Response:', JSON.stringify(response).substring(0, 500));
  return [{ json: { _fb_search_failed: true, _fb_error: 'Failed to start Apify run', _queries: queries, runId: '', datasetId: '' } }];
}

return [{ json: { runId, datasetId, pollCount: 0, _queries: queries, _fb_search_failed: false } }];
```

**Input fields (detected):** (none detected)

### Extract IG Run ID

- **ID:** `dc1c5f7d-9c8d-4aa4-bd1d-ef691c52a502`
- **Position:** [8112, 560]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 23

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Prepare IG Search Input` | `.first` |

**jsCode:**

```javascript
const response = $input.first().json;
const prevInput = $('Prepare IG Search Input').first().json;
const queries = prevInput._queries;

// If we skipped IG search
if (prevInput._ig_skip) {
  return [{ json: { _ig_search_failed: true, _ig_error: 'No queries - skipped', _queries: queries, runId: '', datasetId: '' } }];
}

let runId = '';
let datasetId = '';

if (response.data) {
  runId = response.data.id || '';
  datasetId = response.data.defaultDatasetId || '';
}

if (!runId) {
  console.log('Instagram Search: Failed to start run. Response:', JSON.stringify(response).substring(0, 500));
  return [{ json: { _ig_search_failed: true, _ig_error: 'Failed to start Apify run', _queries: queries, runId: '', datasetId: '' } }];
}

return [{ json: { runId, datasetId, pollCount: 0, _queries: queries, _ig_search_failed: false } }];
```

**Input fields (detected):** (none detected)

### Parse FB Status

- **ID:** `20eae18e-ad5c-4e22-b28d-1867e4c9146c`
- **Position:** [8784, 80]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 25

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Extract FB Run ID` | `.first` |
| `Parse FB Status` | `.first` |

**jsCode:**

```javascript
const response = $input.first().json;
const prevData = $('Extract FB Run ID').first().json;

let status = 'UNKNOWN';
let datasetId = prevData.datasetId || '';

if (response.data && response.data.status) {
  status = response.data.status;
  if (response.data.defaultDatasetId) datasetId = response.data.defaultDatasetId;
}

let pollCount = 0;
try {
  pollCount = $('Parse FB Status').first().json.pollCount || 0;
} catch(e) {
  pollCount = prevData.pollCount || 0;
}
pollCount++;

// Timeout after 20 polls (10 minutes)
if (pollCount > 20 && status !== 'SUCCEEDED' && status !== 'FAILED') {
  status = 'TIMED_OUT';
}

return [{ json: { runId: prevData.runId, datasetId, pollCount, status, _queries: prevData._queries } }];
```

**Input fields (detected):** (none detected)

### Parse IG Status

- **ID:** `aff1678f-bc7e-4b4b-b2c3-42b8053f9afa`
- **Position:** [8784, 496]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 24

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Extract IG Run ID` | `.first` |
| `Parse IG Status` | `.first` |

**jsCode:**

```javascript
const response = $input.first().json;
const prevData = $('Extract IG Run ID').first().json;

let status = 'UNKNOWN';
let datasetId = prevData.datasetId || '';

if (response.data && response.data.status) {
  status = response.data.status;
  if (response.data.defaultDatasetId) datasetId = response.data.defaultDatasetId;
}

let pollCount = 0;
try {
  pollCount = $('Parse IG Status').first().json.pollCount || 0;
} catch(e) {
  pollCount = prevData.pollCount || 0;
}
pollCount++;

if (pollCount > 20 && status !== 'SUCCEEDED' && status !== 'FAILED') {
  status = 'TIMED_OUT';
}

return [{ json: { runId: prevData.runId, datasetId, pollCount, status, _queries: prevData._queries } }];
```

**Input fields (detected):** (none detected)

### Match FB Results to Companies

- **ID:** `15e16620-9338-47e9-be5e-64f690fbb4ab`
- **Position:** [9456, 160]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 79

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Extract FB Run ID` | `.first` |

**jsCode:**

```javascript
// Match Facebook search results back to companies and build social_profiles rows
const results = $input.first().json;
const queries = $('Extract FB Run ID').first().json._queries || [];

// results should be an array of Facebook page results
const fbPages = Array.isArray(results) ? results : [results];

const socialRows = [];
const matchLog = [];

for (const query of queries) {
  const companyNameLower = (query.company_name || '').toLowerCase();
  const cityLower = (query.city || '').toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const page of fbPages) {
    // FB Search Scraper output fields: title, description, url, address, email, 
    // website, phone, likes, checkins, categories, messenger, adStatus
    const pageName = (page.title || page.name || '').toLowerCase();
    const pageAddress = (page.address || '').toLowerCase();
    const pageDescription = (page.description || '').toLowerCase();
    
    // Score based on name similarity
    const companyWords = companyNameLower.split(/\s+/).filter(w => w.length > 2);
    const matchingWords = companyWords.filter(w => pageName.includes(w));
    let score = companyWords.length > 0 ? matchingWords.length / companyWords.length : 0;
    
    // Bonus for city match in address or description
    if (cityLower && (pageAddress.includes(cityLower) || pageDescription.includes(cityLower))) {
      score += 0.2;
    }
    
    // Bonus for massage/spa/therapy keywords
    const relevantKeywords = ['massage', 'spa', 'therapy', 'therapist', 'bodywork', 'wellness'];
    const pageText = `${pageName} ${pageDescription} ${(page.categories || []).join(' ')}`.toLowerCase();
    if (relevantKeywords.some(kw => pageText.includes(kw))) {
      score += 0.15;
    }
    
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = page;
    }
  }

  if (bestMatch) {
    const pageUrl = bestMatch.url || bestMatch.facebookUrl || '';
    if (pageUrl) {
      socialRows.push({
        company_id: query.company_id,
        platform: 'facebook',
        profile_url: pageUrl,
        follower_count: bestMatch.likes || bestMatch.followers || null,
        post_count: null,
        last_post_date: null,
        scraped_at: new Date().toISOString()
      });
      matchLog.push({ 
        company: query.company_name, 
        matched_to: bestMatch.title || bestMatch.name, 
        score: bestScore,
        fb_url: pageUrl
      });
    }
  }
}

console.log(`Facebook discovery: ${socialRows.length} matches from ${fbPages.length} results for ${queries.length} queries`);

return [{
  json: {
    _fb_social_rows: socialRows,
    _fb_match_count: socialRows.length,
    _fb_total_results: fbPages.length,
    _match_log: matchLog
  }
}];
```

**Input fields (detected):** (none detected)

### Match IG Results to Companies

- **ID:** `f7b92b32-496f-4d9a-a5c5-1d20e7e75751`
- **Position:** [9456, 560]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 81

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Extract IG Run ID` | `.first` |

**jsCode:**

```javascript
// Match Instagram search results back to companies
const results = $input.first().json;
const queries = $('Extract IG Run ID').first().json._queries || [];

// IG Search Scraper returns profiles with fields like:
// username, fullName, biography, followersCount, followsCount, 
// postsCount, isBusinessAccount, profilePicUrl, externalUrl, etc.
const igProfiles = Array.isArray(results) ? results : [results];

const socialRows = [];
const matchLog = [];

for (const query of queries) {
  const companyNameLower = (query.company_name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const cityLower = (query.city || '').toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const profile of igProfiles) {
    const profileName = (profile.fullName || profile.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const profileBio = (profile.biography || profile.bio || '').toLowerCase();
    const username = (profile.username || '').toLowerCase();
    
    // Score based on name similarity
    const companyWords = companyNameLower.split(/\s+/).filter(w => w.length > 2);
    const matchingWords = companyWords.filter(w => 
      profileName.includes(w) || username.includes(w)
    );
    let score = companyWords.length > 0 ? matchingWords.length / companyWords.length : 0;
    
    // Bonus for city mention in bio
    if (cityLower && profileBio.includes(cityLower)) score += 0.2;
    
    // Bonus for massage/spa/therapy keywords in bio or name
    const relevantKeywords = ['massage', 'spa', 'therapy', 'therapist', 'bodywork', 'wellness', 'rmt'];
    if (relevantKeywords.some(kw => profileBio.includes(kw) || profileName.includes(kw))) score += 0.15;
    
    // Bonus for business account
    const isBusinessAccount = profile.isBusinessAccount || profile.isBusiness || false;
    if (isBusinessAccount) score += 0.1;
    
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = profile;
    }
  }

  if (bestMatch) {
    const profileUrl = bestMatch.url || bestMatch.profileUrl || 
      (bestMatch.username ? `https://www.instagram.com/${bestMatch.username}` : '');
    
    if (profileUrl) {
      socialRows.push({
        company_id: query.company_id,
        platform: 'instagram',
        profile_url: profileUrl,
        follower_count: bestMatch.followersCount || bestMatch.followers || null,
        post_count: bestMatch.postsCount || bestMatch.posts || null,
        last_post_date: null,
        scraped_at: new Date().toISOString()
      });
      matchLog.push({ 
        company: query.company_name, 
        matched_to: bestMatch.username || bestMatch.fullName, 
        score: bestScore 
      });
    }
  }
}

console.log(`Instagram discovery: ${socialRows.length} matches from ${igProfiles.length} results for ${queries.length} queries`);

return [{
  json: {
    _ig_social_rows: socialRows,
    _ig_match_count: socialRows.length,
    _ig_total_results: igProfiles.length,
    _match_log: matchLog
  }
}];
```

**Input fields (detected):** (none detected)

### Prepare Social Profiles Insert

- **ID:** `e20e550b-ceca-44e3-a711-6df8570fc40c`
- **Position:** [9680, -208]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 30

**jsCode:**

```javascript
// Insert social profiles found from website HTML into Supabase social_profiles table
const item = $input.item.json;
const links = item.social_links_found || [];

if (links.length === 0) {
  return { json: { _social_inserts: 0, company_id: item.company_id } };
}

// Build an array of social_profiles rows
const rows = links.map(link => ({
  company_id: item.company_id,
  platform: link.platform,
  profile_url: link.url,
  follower_count: null,
  post_count: null,
  last_post_date: null,
  scraped_at: new Date().toISOString()
}));

return {
  json: {
    _social_rows: rows,
    _social_inserts: rows.length,
    company_id: item.company_id,
    company_name: item.company_name,
    city: item.city,
    state: item.state,
    needs_social_discovery: false
  }
};
```

**Input fields (detected):** city, company_id, company_name, social_links_found, state

### Run Summary1

- **ID:** `46071282-354b-4219-9f62-61cdb9ce9704`
- **Position:** [10128, 224]
- **Step:** Step 2: Company Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 61
- **Notes:** Final summary of the enrichment batch. Shows stats for websites analyzed, booking/ads detected, social profiles found. Provides next_offset for continuing with next batch.

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Enrichment Config` | `.first` |
| `Parse Batch` | `.all` |
| `Analyze Website HTML` | `.all` |
| `Match FB Results to Companies` | `.first` |
| `Match IG Results to Companies` | `.first` |

**jsCode:**

```javascript
// Final summary of the enrichment batch run
const config = $('Enrichment Config').first().json;

// Collect stats from various paths
let companiesProcessed = 0;
let websitesFetched = 0;
let websiteErrors = 0;
let bookingDetected = 0;
let paidAdsDetected = 0;
let socialFromWebsite = 0;
let fbDiscovered = 0;
let igDiscovered = 0;

try {
  const batchItems = $('Parse Batch').all();
  companiesProcessed = batchItems.filter(i => !i.json._empty).length;
} catch(e) {}

try {
  const websiteItems = $('Analyze Website HTML').all();
  for (const item of websiteItems) {
    const enrichment = item.json._website_enrichment || {};
    if (enrichment._website_fetch_status === 'success') websitesFetched++;
    if (enrichment._website_fetch_status === 'error') websiteErrors++;
    if (enrichment.has_online_booking) bookingDetected++;
    if (enrichment.has_paid_ads) paidAdsDetected++;
    socialFromWebsite += (enrichment.social_links_found || []).length;
  }
} catch(e) {}

try {
  const fbResults = $('Match FB Results to Companies').first().json;
  fbDiscovered = fbResults._fb_match_count || 0;
} catch(e) {}

try {
  const igResults = $('Match IG Results to Companies').first().json;
  igDiscovered = igResults._ig_match_count || 0;
} catch(e) {}

const summary = {
  run_completed_at: new Date().toISOString(),
  batch_size: config.batch_size,
  batch_offset: config.batch_offset,
  companies_processed: companiesProcessed,
  websites_fetched_successfully: websitesFetched,
  website_fetch_errors: websiteErrors,
  booking_platforms_detected: bookingDetected,
  paid_ads_detected: paidAdsDetected,
  social_links_from_websites: socialFromWebsite,
  facebook_pages_discovered: fbDiscovered,
  instagram_profiles_discovered: igDiscovered,
  total_social_profiles_created: socialFromWebsite + fbDiscovered + igDiscovered,
  next_offset: Number(config.batch_offset) + Number(config.batch_size),
  message: `Enriched ${companiesProcessed} companies. Update batch_offset to ${Number(config.batch_offset) + Number(config.batch_size)} for next run.`
};

console.log('=== ENRICHMENT RUN SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

return [{ json: summary }];
```

**Input fields (detected):** _website_enrichment

### Bridge to 3b

- **ID:** `2a665506-3509-4c42-a017-2d6b0820960d`
- **Position:** [10336, 224]
- **Step:** Step 3b: Social Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 2

> **Shared by 3 nodes:** Bridge to 3b, Bridge to 3a, Bridge to 4

**jsCode:**

```javascript
// Collapse all input items into a single trigger item for the next step
return [{ json: { _trigger: 'continue', _timestamp: new Date().toISOString() } }];
```

**Input fields (detected):** (none detected)

### Parse Batch1

- **ID:** `20ccd9c2-acbb-4327-a9de-bbc1e979f112`
- **Position:** [11008, 224]
- **Step:** Step 3b: Social Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 15

**jsCode:**

```javascript
const allInputs = $input.all();
let profiles = [];

if (allInputs.length === 1 && Array.isArray(allInputs[0].json)) {
  profiles = allInputs[0].json;
} else {
  profiles = allInputs.map(i => i.json);
}

if (!profiles || profiles.length === 0 || (profiles.length === 1 && !profiles[0].id)) {
  return [{ json: { _empty: true, _count: 0, _message: 'No unenriched social profiles found' } }];
}

console.log('Batch loaded: ' + profiles.length + ' social profiles to enrich');
return profiles.map(p => ({ json: p }));
```

**Input fields (detected):** (none detected)

### No Records - Done1

- **ID:** `bdc6ecee-4e9a-4fff-9f9b-d3dfb28f9234`
- **Position:** [11456, 128]
- **Step:** Step 3b: Social Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**jsCode:**

```javascript
return [{ json: { message: 'No unenriched social profiles found. Step 3b complete.', completed_at: new Date().toISOString() } }];
```

**Input fields (detected):** (none detected)

### Build SociaVault Request

- **ID:** `943aee3c-3d66-412f-aad3-e2308cab8976`
- **Position:** [11456, 320]
- **Step:** Step 3b: Social Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 90
- **Notes:** Extracts username/handle from profile_url, builds SociaVault API URL per platform. Skips unparseable profiles.

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Step 3b Config` | `.first` |

**jsCode:**

```javascript
const profile = $input.item.json;
const config = $('Step 3b Config').first().json;
const platform = (profile.platform || '').toLowerCase();
const url = (profile.profile_url || '').trim();
const skipMap = {
  instagram: config.skip_instagram,
  facebook: config.skip_facebook,
  tiktok: config.skip_tiktok,
  x: config.skip_twitter,
  twitter: config.skip_twitter,
  linkedin: config.skip_linkedin,
  youtube: config.skip_youtube
};
const shouldSkip = skipMap[platform] === 'true' || skipMap[platform] === true;
if (shouldSkip) {
  return { json: { ...profile, _skip: true, _skip_reason: `Platform ${platform} disabled`, _sociavault_url: '', _extracted_handle: '' } };
}
let handle = '';
try {
  if (platform === 'instagram') {
    const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
    if (match) handle = match[1];
  } else if (platform === 'facebook') {
    const profileIdMatch = url.match(/profile\.php\?id=(\d+)/);
    if (profileIdMatch) {
      handle = profileIdMatch[1];
    } else {
      const match = url.match(/facebook\.com\/([a-zA-Z0-9._-]+)/i);
      if (match) handle = match[1];
    }
  } else if (platform === 'tiktok') {
    const match = url.match(/tiktok\.com\/@([a-zA-Z0-9._-]+)/i);
    if (match) handle = match[1];
  } else if (platform === 'x' || platform === 'twitter') {
    const match = url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
    if (match) handle = match[1];
  } else if (platform === 'linkedin') {
    const companyMatch = url.match(/linkedin\.com\/company\/([a-zA-Z0-9._-]+)/i);
    const personMatch = url.match(/linkedin\.com\/in\/([a-zA-Z0-9._-]+)/i);
    handle = companyMatch ? companyMatch[1] : (personMatch ? personMatch[1] : '');
  } else if (platform === 'youtube') {
    const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/i);
    const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/i);
    const cMatch = url.match(/youtube\.com\/c\/([a-zA-Z0-9._-]+)/i);
    handle = handleMatch ? handleMatch[1] : (channelMatch ? channelMatch[1] : (cMatch ? cMatch[1] : ''));
  }
} catch (e) {}
const invalidHandles = [
  'sharer', 'share', 'intent', 'login', 'help', 'about', 'policies', 'privacy',
  'hashtag', 'explore', 'watch', 'results', 'search',
  // Facebook non-profile paths (tracking pixels, SDK, plugins, etc.)
  'tr', 'flx', 'plugins', 'dialog', 'ajax', 'ads', 'business', 'events',
  'groups', 'marketplace', 'gaming', 'watch', 'reels', 'stories'
];
if (invalidHandles.includes(handle.toLowerCase())) handle = '';
if (!handle) {
  return { json: { ...profile, _skip: true, _skip_reason: `Could not extract handle from URL: ${url}`, _sociavault_url: '', _extracted_handle: '' } };
}
let sociavaultUrl = '';
const baseUrl = 'https://api.sociavault.com/v1/scrape';
if (platform === 'instagram') {
  sociavaultUrl = `${baseUrl}/instagram/profile?handle=${encodeURIComponent(handle)}`;
} else if (platform === 'facebook') {
  // Facebook endpoint requires the full profile URL with https://
  let fbUrl = url;
  if (!fbUrl.startsWith('http')) {
    fbUrl = 'https://' + fbUrl;
  }
  // Ensure https (not http)
  fbUrl = fbUrl.replace(/^http:\/\//, 'https://');
  sociavaultUrl = `${baseUrl}/facebook/profile?url=${encodeURIComponent(fbUrl)}`;
} else if (platform === 'tiktok') {
  sociavaultUrl = `${baseUrl}/tiktok/profile?handle=${encodeURIComponent(handle)}`;
} else if (platform === 'x' || platform === 'twitter') {
  sociavaultUrl = `${baseUrl}/twitter/profile?handle=${encodeURIComponent(handle)}`;
} else if (platform === 'linkedin') {
  const isCompany = url.includes('/company/');
  sociavaultUrl = isCompany
    ? `${baseUrl}/linkedin/company?username=${encodeURIComponent(handle)}`
    : `${baseUrl}/linkedin/profile?username=${encodeURIComponent(handle)}`;
} else if (platform === 'youtube') {
  const isChannelId = handle.startsWith('UC');
  sociavaultUrl = isChannelId
    ? `${baseUrl}/youtube/channel?channel_id=${encodeURIComponent(handle)}`
    : `${baseUrl}/youtube/channel?handle=${encodeURIComponent(handle)}`;
}
if (!sociavaultUrl) {
  return { json: { ...profile, _skip: true, _skip_reason: `Unsupported platform: ${platform}`, _sociavault_url: '', _extracted_handle: handle } };
}
return { json: { ...profile, _skip: false, _skip_reason: null, _sociavault_url: sociavaultUrl, _extracted_handle: handle, _platform: platform } };
```

**Input fields (detected):** (none detected)

### Parse SociaVault Response

- **ID:** `646f8e9a-ce35-4835-bf95-f2218ee85cd5`
- **Position:** [12128, 256]
- **Step:** Step 3b: Social Enrichment
- **Mode:** `runOnceForEachItem`
- **Lines:** 72
- **Notes:** Extracts follower_count, post_count, last_post_date from SociaVault response per platform.

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Should Enrich?` | `.item.json` |

**jsCode:**

```javascript
const response = $input.item.json;
const profileData = $('Should Enrich?').item.json;
const platform = profileData._platform;
const profileId = profileData.id;
const companyId = profileData.company_id;
let follower_count = null;
let post_count = null;
let last_post_date = null;
let fetchStatus = 'success';
let errorMsg = null;
try {
  if (response.error || response.status === 'error' || response.success === false) {
    fetchStatus = 'error';
    errorMsg = response.error || response.message || 'API returned error';
  } else if (platform === 'instagram') {
    // SociaVault returns: { success, data: { success, data: { user: { ... } } } }
    const user = response.data?.data?.user || response.data?.user || response.user || response.data || {};
    follower_count = user.edge_followed_by?.count ?? user.follower_count ?? user.followers_count ?? null;
    post_count = user.edge_owner_to_timeline_media?.count ?? user.media_count ?? null;
    const edges = user.edge_owner_to_timeline_media?.edges || [];
    // edges may be an object with numeric keys instead of an array
    const edgeArray = Array.isArray(edges) ? edges : Object.values(edges);
    if (edgeArray.length > 0) {
      const firstPost = edgeArray[0]?.node || edgeArray[0] || {};
      if (firstPost.taken_at) {
        last_post_date = new Date(firstPost.taken_at * 1000).toISOString().split('T')[0];
      }
    }
  } else if (platform === 'facebook') {
    // SociaVault returns: { success, data: { success, name, followerCount, likeCount, ... } }
    const data = response.data || response;
    follower_count = data.followerCount ?? data.follower_count ?? data.followers_count ?? data.likes ?? data.likeCount ?? data.fan_count ?? null;
    post_count = data.posts_count ?? data.postCount ?? null;
  } else if (platform === 'tiktok') {
    const stats = response.data?.userInfo?.stats || response.data?.stats || {};
    const user = response.data?.userInfo?.user || response.data?.user || response.data || response;
    follower_count = stats.followerCount ?? user.followerCount ?? user.followers_count ?? null;
    post_count = stats.videoCount ?? user.videoCount ?? null;
  } else if (platform === 'x' || platform === 'twitter') {
    // SociaVault returns: { success, data: { success, __typename: "User", legacy: { followers_count, statuses_count, ... }, ... } }
    const data = response.data || {};
    const legacy = data.legacy || {};
    const user = data.user || data;
    follower_count = legacy.followers_count ?? legacy.normal_followers_count ?? user.followers_count ?? user.followerCount ?? user.public_metrics?.followers_count ?? null;
    post_count = legacy.statuses_count ?? user.statuses_count ?? user.tweet_count ?? user.public_metrics?.tweet_count ?? null;
    // Check for "account doesn't exist" responses
    if (data.message === "Account doesn't exist" || data.userId === null && data.handle) {
      fetchStatus = 'not_found';
      errorMsg = `Account @${data.handle} does not exist`;
      follower_count = null;
      post_count = null;
    }
    if (user.status?.created_at) {
      try { last_post_date = new Date(user.status.created_at).toISOString().split('T')[0]; } catch(e) {}
    }
  } else if (platform === 'linkedin') {
    const data = response.data || response;
    follower_count = data.followerCount ?? data.followers_count ?? data.followersCount ?? null;
  } else if (platform === 'youtube') {
    const data = response.data || response;
    follower_count = data.subscriberCount ?? data.subscriber_count ?? data.statistics?.subscriberCount ?? null;
    post_count = data.videoCount ?? data.video_count ?? data.statistics?.videoCount ?? null;
    if (typeof follower_count === 'string') follower_count = parseInt(follower_count, 10);
    if (typeof post_count === 'string') post_count = parseInt(post_count, 10);
  }
  if (follower_count !== null) follower_count = Number(follower_count) || null;
  if (post_count !== null) post_count = Number(post_count) || null;
} catch (e) {
  fetchStatus = 'error';
  errorMsg = 'Parse error: ' + e.message;
}
return { json: { _profile_id: profileId, _company_id: companyId, _platform: platform, _extracted_handle: profileData._extracted_handle, _fetch_status: fetchStatus, _error: errorMsg, _update_payload: { follower_count, post_count, last_post_date, scraped_at: new Date().toISOString() } } };
```

**Input fields (detected):** (none detected)

### Run Summary2

- **ID:** `88b637d0-c76a-4b24-9c4f-f734f76451fb`
- **Position:** [12576, 336]
- **Step:** Step 3b: Social Enrichment
- **Mode:** `runOnceForAllItems`
- **Lines:** 43
- **Notes:** Final summary with per-platform breakdown.

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Step 3b Config` | `.first` |
| `Build SociaVault Request` | `.all` |
| `Parse SociaVault Response` | `.all` |

**jsCode:**

```javascript
const config = $('Step 3b Config').first().json;
let totalProcessed = 0, enriched = 0, errors = 0, skipped = 0;
const platformCounts = {};
const errorDetails = [];

try {
  const allItems = $('Build SociaVault Request').all();
  totalProcessed = allItems.length;
  skipped = allItems.filter(i => i.json._skip === true).length;
} catch(e) {}

try {
  const results = $('Parse SociaVault Response').all();
  for (const item of results) {
    const data = item.json;
    const platform = data._platform || 'unknown';
    if (!platformCounts[platform]) platformCounts[platform] = { success: 0, error: 0 };
    if (data._fetch_status === 'error') {
      errors++;
      platformCounts[platform].error++;
      errorDetails.push({ handle: data._extracted_handle, platform: data._platform, error: data._error });
    } else {
      enriched++;
      platformCounts[platform].success++;
    }
  }
} catch(e) {}

const summary = {
  run_completed_at: new Date().toISOString(),
  batch_size: config.batch_size,
  batch_offset: config.batch_offset,
  total_profiles_in_batch: totalProcessed,
  skipped, enriched, errors,
  platform_breakdown: platformCounts,
  error_details: errorDetails.slice(0, 10),
  next_offset: Number(config.batch_offset) + Number(config.batch_size),
  message: `Enriched ${enriched} social profiles (${errors} errors, ${skipped} skipped).`
};

console.log('=== STEP 3b: SOCIAL ENRICHMENT SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
return [{ json: summary }];
```

**Input fields (detected):** (none detected)

### Bridge to 3a

- **ID:** `b46e61e0-07d7-4a2c-90fb-891bdd0c631a`
- **Position:** [12784, 336]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForAllItems`
- **Lines:** 2

> **DUPLICATE:** Identical code to **Bridge to 3b** — see that node for full jsCode.

### Filter & Parse Batch

- **ID:** `989ee9a3-2aa5-4fa6-ba7d-c02754733bb7`
- **Position:** [13776, 320]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForAllItems`
- **Lines:** 34

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Fetch Companies` | `.all` |

**jsCode:**

```javascript
// Get companies from upstream Fetch Companies node
const companyItems = $('Fetch Companies').all();
let companies = [];
if (companyItems.length === 1 && Array.isArray(companyItems[0].json)) {
  companies = companyItems[0].json;
} else {
  companies = companyItems.map(i => i.json);
}

// Get existing contact company_ids
const contactItems = $input.all();
let existingIds = new Set();
for (const item of contactItems) {
  if (item.json && item.json.company_id) {
    existingIds.add(item.json.company_id);
  }
  // Handle array response
  if (Array.isArray(item.json)) {
    for (const row of item.json) {
      if (row.company_id) existingIds.add(row.company_id);
    }
  }
}

// Filter out companies that already have contacts
const filtered = companies.filter(c => c.id && !existingIds.has(c.id));

console.log(`Companies: ${companies.length} total, ${existingIds.size} already have contacts, ${filtered.length} need people discovery`);

if (filtered.length === 0) {
  return [{ json: { _empty: true, _count: 0, _message: 'All companies already have contacts or no companies to process' } }];
}

return filtered.map(c => ({ json: c }));
```

**Input fields (detected):** company_id

### No Records - Done2

- **ID:** `32ffc287-be9b-48e8-8e75-cde2c7c77f08`
- **Position:** [14224, 224]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**jsCode:**

```javascript
return [{ json: { message: 'No companies need people discovery. All already have contacts or no partially/fully enriched companies found.', completed_at: new Date().toISOString() } }];
```

**Input fields (detected):** (none detected)

### Solo Practitioner Check

- **ID:** `38d393bc-b961-4eb2-849f-f0c190ce4c59`
- **Position:** [14224, 416]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 176
- **Notes:** Detects solo practitioners from estimated_size='solo' or business name patterns. Extracts first/last name from business name to avoid wasting API credits.

**jsCode:**

```javascript
const item = $input.item.json;
const name = (item.name || '').trim();
const estimatedSize = item.estimated_size;

let isSolo = false;
let firstName = null;
let lastName = null;

// Common first names for validation (covers ~90% of US population)
const commonFirstNames = new Set([
  'aaron','abby','abigail','adam','adrian','adriana','aiden','aimee','alana','albert',
  'alec','alexa','alexander','alexandra','alexis','alice','alicia','alina','alison','allison',
  'alyssa','amanda','amber','amelia','amy','ana','andrea','andrew','angela','angelica',
  'angie','anita','ann','anna','anne','annie','anthony','april','aria','ariana',
  'ashley','audrey','austin','autumn','ava','avery','bailey','barbara','beatrice','becky',
  'bella','ben','benjamin','beth','bethany','betty','beverly','bianca','blake','bonnie',
  'brad','bradley','brandi','brandon','brandy','breanna','brenda','brent','brett','brian',
  'briana','brianna','bridget','brittany','brittney','brooke','bruce','bryan','caitlin','caleb',
  'cameron','camila','candace','cara','carina','carl','carla','carlos','carly','carmen',
  'carol','carolina','caroline','carolyn','carrie','casey','cassandra','cassidy','catherine','cathy',
  'cecilia','celeste','celia','chad','charlene','charles','charlie','charlotte','chase','chelsea',
  'cheryl','chloe','chris','christa','christian','christina','christine','christopher','cindy','claire',
  'clara','claudia','cody','colleen','connor','constance','corey','corinne','courtney','craig',
  'crystal','cynthia','daisy','dale','dana','daniel','daniela','danielle','daphne','darlene',
  'darren','dave','david','dawn','dean','deanna','debbie','deborah','debra','denise',
  'derek','desiree','destiny','diana','diane','dianne','dolores','dominic','donna','doris',
  'dorothy','douglas','drew','dustin','dylan','eddie','edith','edward','eileen','elaine',
  'elena','elisa','elizabeth','ella','ellen','ellie','emily','emma','eric','erica',
  'erika','erin','ernest','esther','ethan','eugene','eva','evan','evelyn','faith',
  'faye','felicia','fiona','florence','frances','frank','gabriel','gabriela','gabriella','gabrielle',
  'gail','gary','gavin','genevieve','george','georgia','gerald','gina','giselle','gladys',
  'glen','glenn','gloria','grace','grant','greg','gregory','gretchen','hailey','haley',
  'hannah','harold','harriet','harry','hayden','hazel','heather','heidi','helen','henry',
  'hillary','holly','hope','howard','hunter','ian','irene','iris','isaac','isabel',
  'isabella','ivy','jack','jackie','jackson','jacob','jacqueline','jade','jaime','jake',
  'james','jamie','jan','jane','janet','janice','jared','jasmine','jason','jay',
  'jean','jeanette','jeanne','jeff','jeffrey','jenna','jennifer','jenny','jeremy','jerry',
  'jesse','jessica','jill','jillian','jim','jimmy','jo','joan','joann','joanna',
  'joanne','jocelyn','jodi','jody','joe','joel','johanna','john','johnny','jolene',
  'jon','jonathan','jordan','jorge','jose','joseph','josephine','josh','joshua','joy',
  'joyce','juan','judith','judy','julia','julian','juliana','julie','june','justin',
  'kaitlyn','kara','karen','karina','karl','kate','katelyn','katherine','kathleen','kathryn',
  'kathy','katie','katrina','kay','kayla','keith','kelley','kelli','kelly','kelsey',
  'ken','kendra','kenneth','kenny','kerry','kevin','kim','kimberly','kirsten','krista',
  'kristen','kristin','kristina','kristy','kyle','kylie','lacey','lana','lance','larry',
  'laura','lauren','laurie','leah','lee','leigh','lena','leo','leon','leslie',
  'lexy','liam','lillian','lily','linda','lindsay','lindsey','lisa','logan','lois',
  'lora','lorena','lori','lorraine','louis','louise','lucia','luis','luke','lydia',
  'lynn','mackenzie','madeline','madison','maggie','malik','mallory','mandy','marc','marcia',
  'marco','marcus','margaret','maria','mariah','marie','marilyn','marina','mario','marisa',
  'marissa','mark','marlene','marsha','martha','martin','mary','mason','matt','matthew',
  'maureen','max','maya','megan','meghan','melanie','melinda','melissa','melody','meredith',
  'mia','michael','michele','michelle','miguel','mike','mildred','mindy','miranda','misty',
  'mitchell','molly','monica','monique','morgan','mya','nadia','nancy','naomi','natalia',
  'natalie','natasha','nathan','nathaniel','neil','nelson','nicholas','nicole','nina','noah',
  'noel','nora','norma','olivia','owen','paige','pam','pamela','patricia','patrick',
  'patty','paul','paula','pauline','peggy','penny','peter','philip','phyllis','priscilla',
  'rachel','ralph','ramona','randall','randy','ray','raymond','rebecca','regina','renee',
  'rhonda','ricardo','richard','rick','ricky','riley','rita','rob','robert','roberta',
  'robin','rochelle','rodney','roger','ronald','rosa','rosalie','rose','rosemary','roxanne',
  'ruby','russell','ruth','ryan','sabrina','sally','samantha','samuel','sandra','sandy',
  'sara','sarah','savannah','scott','sean','selena','serena','seth','shana','shane',
  'shannon','sharon','shawn','sheila','shelby','shelley','shelly','sheri','sherri','sherry',
  'shirley','sierra','silvia','simone','sofia','sonia','sonya','sophia','stacey','stacy',
  'stella','stephanie','stephen','steve','steven','sue','summer','susan','suzanne','sydney',
  'sylvia','tabitha','tamara','tammy','tanya','tara','tatiana','taylor','teresa','terri',
  'terry','tess','tessa','theresa','thomas','tiffany','tim','timothy','tina','tito',
  'todd','tom','tommy','toni','tony','tonya','tracey','traci','tracy','travis',
  'tricia','trisha','troy','tyler','valerie','vanessa','vera','veronica','vicki','vicky',
  'victoria','vincent','violet','virginia','vivian','wade','walter','wanda','warren','wayne',
  'wendy','wesley','whitney','william','willie','wilma','xavier','yolanda','yvette','yvonne',
  'zachary','zoe'
]);

function isLikelyFirstName(word) {
  return commonFirstNames.has(word.toLowerCase());
}

// Pattern 1: "by Name" pattern - "Bodywork by Benna", "Massage by Celeste"
const byPattern = name.match(/\bby\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i);
if (byPattern) {
  const candidate = byPattern[1];
  if (isLikelyFirstName(candidate) || estimatedSize === 'solo') {
    isSolo = true;
    firstName = candidate;
    lastName = byPattern[2] || null;
  }
}

// Pattern 2: "with Name" pattern - "inTouch with Nadine"
if (!firstName) {
  const withPattern = name.match(/\bwith\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i);
  if (withPattern) {
    const candidate = withPattern[1];
    if (isLikelyFirstName(candidate) || estimatedSize === 'solo') {
      isSolo = true;
      firstName = candidate;
      lastName = withPattern[2] || null;
    }
  }
}

// Pattern 3: Possessive - "Lexy's Massage", "Martha's Healing Hands"
if (!firstName) {
  const possessiveMatch = name.match(/^([A-Z][a-z]+)'s\s+/i);
  if (possessiveMatch && isLikelyFirstName(possessiveMatch[1])) {
    isSolo = true;
    firstName = possessiveMatch[1];
  }
}

// Pattern 4: "FirstName LastName, LMT/CMT/RMT" or "FirstName LastName Massage Therapy"
if (!firstName) {
  const nameFirst = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*[,|]\s*|\s+)(?:LMT|CMT|RMT|Licensed|Massage|Bodywork|Therapeutic|Wellness)/i);
  if (nameFirst) {
    const fn = nameFirst[1];
    const ln = nameFirst[2];
    if (isLikelyFirstName(fn) && !commonFirstNames.has(ln.toLowerCase())) {
      // First word is a real name, second word is likely a last name (not another first name used as brand)
      isSolo = true;
      firstName = fn;
      lastName = ln;
    }
  }
}

// Pattern 5: "FirstName LastName's Massage/Spa"
if (!firstName) {
  const possessiveFullName = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)'s\s+(?:Massage|Bodywork|Wellness|Spa|Healing)/i);
  if (possessiveFullName && isLikelyFirstName(possessiveFullName[1])) {
    isSolo = true;
    firstName = possessiveFullName[1];
    lastName = possessiveFullName[2];
  }
}

// Pattern 6: Three-part name with title - "Kristy Adele Lloyd, LMT"
if (!firstName) {
  const threePartName = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s+(?:LMT|CMT|RMT|Licensed)/i);
  if (threePartName && isLikelyFirstName(threePartName[1])) {
    isSolo = true;
    firstName = threePartName[1];
    lastName = threePartName[3]; // Skip middle name, use last
  }
}

// Pattern 7: Name embedded after comma - "Mobile Massage Austin, Gina Bongiorno, LMT"
if (!firstName) {
  const commaNameMatch = name.match(/,\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*,?\s*(?:LMT|CMT|RMT|Licensed))?/i);
  if (commaNameMatch && isLikelyFirstName(commaNameMatch[1])) {
    isSolo = true;
    firstName = commaNameMatch[1];
    lastName = commaNameMatch[2];
  }
}

// If estimated_size is solo but no name extracted, still flag as solo
if (estimatedSize === 'solo' && !isSolo) {
  isSolo = true;
}

// Reject if extracted first name matches the company's city (e.g. "Austin" in Austin, TX)
if (firstName && item.city && firstName.toLowerCase() === item.city.toLowerCase()) {
  firstName = null;
  lastName = null;
  // Don't unflag isSolo — it might still be solo, just can't extract the name
}

return {
  json: {
    ...item,
    _is_solo: isSolo,
    _solo_first_name: firstName,
    _solo_last_name: lastName
  }
};
```

**Input fields (detected):** city, estimated_size, name

### Parse Apollo Search

- **ID:** `7b51328c-b140-4cd0-b97d-3454a9ff0013`
- **Position:** [15152, 240]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 54

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Solo Practitioner Check` | `.item.json` |

**jsCode:**

```javascript
const company = $('Solo Practitioner Check').item.json;
const response = $input.item.json;
const people = response.people || [];

if (!people || people.length === 0) {
  return {
    json: {
      ...company,
      _apollo_found: false,
      _apollo_person_id: null,
      _apollo_person_count: 0
    }
  };
}

// Score people by role relevance - prefer owners/founders
const ownerKeywords = ['owner', 'founder', 'ceo', 'proprietor', 'principal', 'co-founder'];
const managerKeywords = ['manager', 'director', 'general manager', 'gm', 'head'];
const practitionerKeywords = ['massage', 'therapist', 'lmt', 'cmt', 'rmt', 'bodywork', 'esthetician'];

let bestPerson = null;
let bestScore = -1;

for (const person of people) {
  const title = (person.title || '').toLowerCase();
  let score = 0;

  if (ownerKeywords.some(k => title.includes(k))) score = 10;
  else if (managerKeywords.some(k => title.includes(k))) score = 5;
  else if (practitionerKeywords.some(k => title.includes(k))) score = 3;
  else score = 1;

  // Bonus for having email available
  if (person.has_email === true || person.has_email === 'true') score += 1;

  if (score > bestScore) {
    bestScore = score;
    bestPerson = person;
  }
}

console.log(`Apollo search for ${company.domain}: ${people.length} people found. Best: ${bestPerson.first_name} (${bestPerson.title || 'no title'}, score ${bestScore})`);

return {
  json: {
    ...company,
    _apollo_found: true,
    _apollo_person_id: bestPerson.id,
    _apollo_first_name: bestPerson.first_name,
    _apollo_last_name_obfuscated: bestPerson.last_name_obfuscated || null,
    _apollo_title: bestPerson.title || null,
    _apollo_person_count: people.length
  }
};
```

**Input fields (detected):** domain

### No Domain Fallback

- **ID:** `0fc8bfa9-091c-46d8-a9f8-43bc648b4112`
- **Position:** [15664, 688]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 141
- **Notes:** Last resort: tries to extract a person name from the business name when there's no domain to search or scrape.

**jsCode:**

```javascript
// Website scrape fallback for companies without a domain
// Use the same validated name extraction as solo detection
const item = $input.item.json;
const name = (item.name || '').trim();

const commonFirstNames = new Set([
  'aaron','abby','abigail','adam','adrian','adriana','aiden','aimee','alana','albert',
  'alexa','alexander','alexandra','alexis','alice','alicia','alison','allison','amanda','amber',
  'amelia','amy','ana','andrea','andrew','angela','angelica','angie','anita','ann',
  'anna','anne','annie','anthony','april','aria','ariana','ashley','audrey','ava',
  'avery','bailey','barbara','becky','bella','ben','benjamin','beth','bethany','betty',
  'beverly','bianca','blake','bonnie','brad','bradley','brandi','brandon','brandy','brenda',
  'brent','brian','brianna','bridget','brittany','brooke','bruce','bryan','caitlin','caleb',
  'cameron','candace','cara','carl','carla','carlos','carly','carmen','carol','caroline',
  'carolyn','carrie','casey','cassandra','catherine','cathy','celeste','chad','charlene','charles',
  'charlotte','chelsea','cheryl','chloe','chris','christina','christine','christopher','cindy','claire',
  'clara','claudia','colleen','connor','courtney','craig','crystal','cynthia','daisy','dale',
  'dana','daniel','daniela','danielle','darlene','dave','david','dawn','dean','deanna',
  'debbie','deborah','debra','denise','derek','desiree','diana','diane','dolores','donna',
  'doris','dorothy','douglas','drew','dustin','dylan','eddie','edward','eileen','elaine',
  'elena','elizabeth','ella','ellen','emily','emma','eric','erica','erika','erin',
  'esther','ethan','eva','evelyn','faith','felicia','fiona','florence','frances','frank',
  'gabriel','gabriela','gabrielle','gail','gary','george','georgia','gerald','gina','glen',
  'glenn','gloria','grace','greg','gregory','hailey','haley','hannah','harold','harry',
  'hazel','heather','heidi','helen','henry','holly','hope','howard','hunter','ian',
  'irene','iris','isaac','isabel','isabella','ivy','jack','jackie','jacob','jacqueline',
  'jade','jaime','jake','james','jamie','jane','janet','janice','jared','jasmine',
  'jason','jay','jean','jeff','jeffrey','jenna','jennifer','jenny','jeremy','jerry',
  'jesse','jessica','jill','jim','jimmy','joan','joanna','joanne','jocelyn','jodi',
  'joe','joel','john','johnny','jon','jonathan','jordan','jose','joseph','josh',
  'joshua','joy','joyce','judith','judy','julia','julie','june','justin','kaitlyn',
  'kara','karen','karina','kate','katelyn','katherine','kathleen','kathryn','kathy','katie',
  'katrina','kay','kayla','keith','kelly','kelsey','ken','kendra','kenneth','kevin',
  'kim','kimberly','kirsten','krista','kristen','kristin','kristina','kristy','kyle','kylie',
  'lacey','lana','lance','larry','laura','lauren','laurie','leah','lee','leigh',
  'lena','leon','leslie','lexy','liam','lillian','lily','linda','lindsay','lindsey',
  'lisa','logan','lois','lori','lorraine','louis','louise','lucia','luis','luke',
  'lydia','lynn','mackenzie','madeline','madison','maggie','mallory','mandy','marc','marcia',
  'marcus','margaret','maria','marie','marilyn','marina','mario','marisa','mark','marlene',
  'martha','martin','mary','matt','matthew','maureen','max','maya','megan','meghan',
  'melanie','melinda','melissa','melody','meredith','mia','michael','michele','michelle','miguel',
  'mike','mildred','mindy','miranda','misty','molly','monica','monique','morgan','nadia',
  'nancy','naomi','natalia','natalie','natasha','nathan','nicholas','nicole','nina','noah',
  'nora','norma','olivia','owen','paige','pamela','patricia','patrick','paul','paula',
  'peggy','penny','peter','philip','phyllis','priscilla','rachel','ralph','randy','ray',
  'raymond','rebecca','regina','renee','rhonda','richard','rick','riley','rita','robert',
  'roberta','robin','rodney','roger','ronald','rosa','rose','rosemary','ruby','russell',
  'ruth','ryan','sabrina','sally','samantha','samuel','sandra','sandy','sara','sarah',
  'savannah','scott','sean','selena','serena','seth','shannon','sharon','shawn','sheila',
  'shelby','shelly','sheri','sherry','shirley','sierra','simone','sofia','sonia','sophia',
  'stacey','stacy','stella','stephanie','stephen','steve','steven','sue','summer','susan',
  'suzanne','sydney','sylvia','tamara','tammy','tanya','tara','tatiana','taylor','teresa',
  'terri','terry','tessa','theresa','thomas','tiffany','timothy','tina','tito','todd',
  'tom','toni','tony','tonya','tracey','tracy','travis','tricia','troy','tyler',
  'valerie','vanessa','vera','veronica','vicki','victoria','vincent','violet','virginia','vivian',
  'walter','wanda','wayne','wendy','wesley','whitney','william','willie','wilma','xavier',
  'yolanda','yvette','yvonne','zachary','zoe'
]);

function isLikelyFirstName(word) {
  return commonFirstNames.has(word.toLowerCase());
}

let firstName = null;
let lastName = null;

// Pattern 1: "by Name" - "Bodywork by Benna"
const byPattern = name.match(/\bby\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i);
if (byPattern && isLikelyFirstName(byPattern[1])) {
  firstName = byPattern[1];
  lastName = byPattern[2] || null;
}

// Pattern 2: "with Name" - "inTouch with Nadine"
if (!firstName) {
  const withPattern = name.match(/\bwith\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i);
  if (withPattern && isLikelyFirstName(withPattern[1])) {
    firstName = withPattern[1];
    lastName = withPattern[2] || null;
  }
}

// Pattern 3: Possessive - "Martha's Healing Hands"
if (!firstName) {
  const possessive = name.match(/^([A-Z][a-z]+)'s\s+/i);
  if (possessive && isLikelyFirstName(possessive[1])) {
    firstName = possessive[1];
  }
}

// Pattern 4: "FirstName LastName, LMT" or similar credential
if (!firstName) {
  const credMatch = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*,?\s*(?:LMT|CMT|RMT|Licensed))/i);
  if (credMatch && isLikelyFirstName(credMatch[1])) {
    firstName = credMatch[1];
    lastName = credMatch[2];
  }
}

// Pattern 5: Name after comma - "Mobile Massage Austin, Gina Bongiorno, LMT"
if (!firstName) {
  const commaMatch = name.match(/,\s*([A-Z][a-z]+)\s+([A-Z][a-z]+)/i);
  if (commaMatch && isLikelyFirstName(commaMatch[1])) {
    firstName = commaMatch[1];
    lastName = commaMatch[2];
  }
}

// Pattern 6: Validated first+last before business keyword
if (!firstName) {
  const nameKeyword = name.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(?:Massage|Bodywork|Therapeutic|Wellness|Healing|Spa)/i);
  if (nameKeyword && isLikelyFirstName(nameKeyword[1]) && !isLikelyFirstName(nameKeyword[2])) {
    firstName = nameKeyword[1];
    lastName = nameKeyword[2];
  }
}

const hasContact = !!(firstName);

return {
  json: {
    _contact: hasContact ? {
      company_id: item.id,
      first_name: firstName,
      last_name: lastName,
      role: 'owner',
      is_owner: true,
      email_business: null,
      email_personal: null,
      phone_direct: null,
      linkedin_url: null,
      location: [item.city, item.state].filter(Boolean).join(', ') || null,
      cultural_affinity: null,
      source: 'manual'
    } : null,
    _company_name: item.name,
    _company_id: item.id,
    _source_method: 'no_domain_name_extraction',
    _has_contact: hasContact
  }
};
```

**Input fields (detected):** city, id, name, state

### Prepare Solo Contact

- **ID:** `742b08b8-ac7e-4457-973c-f829cf4845ba`
- **Position:** [15696, -160]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 23

**jsCode:**

```javascript
const item = $input.item.json;
return {
  json: {
    _contact: {
      company_id: item.id,
      first_name: item._solo_first_name || null,
      last_name: item._solo_last_name || null,
      role: 'owner',
      is_owner: true,
      email_business: null,
      email_personal: null,
      phone_direct: null,
      linkedin_url: null,
      location: [item.city, item.state].filter(Boolean).join(', ') || null,
      cultural_affinity: null,
      source: 'solo_detection'
    },
    _company_name: item.name,
    _company_id: item.id,
    _source_method: 'solo_detection',
    _has_contact: !!(item._solo_first_name)
  }
};
```

**Input fields (detected):** _solo_first_name, _solo_last_name, city, id, name, state

### Parse About Page

- **ID:** `c7cb906c-8393-4af2-8938-2ce3492df94f`
- **Position:** [15696, 496]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 128

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Solo Practitioner Check` | `.item.json` |

**jsCode:**

```javascript
const company = $('Solo Practitioner Check').item.json;
const response = $input.item.json;
const rawHtml = response.body || response.data || '';
const html = typeof rawHtml === 'string' ? rawHtml : '';

let firstName = null;
let lastName = null;

const commonFirstNames = new Set([
  'aaron','abby','abigail','adam','adrian','adriana','aiden','aimee','alana','albert',
  'alexa','alexander','alexandra','alexis','alice','alicia','alison','allison','amanda','amber',
  'amelia','amy','ana','andrea','andrew','angela','angelica','angie','anita','ann',
  'anna','anne','annie','anthony','april','aria','ariana','ashley','audrey','ava',
  'avery','bailey','barbara','becky','bella','ben','benjamin','beth','bethany','betty',
  'beverly','bianca','blake','bonnie','brad','bradley','brandi','brandon','brandy','brenda',
  'brent','brian','brianna','bridget','brittany','brooke','bruce','bryan','caitlin','caleb',
  'cameron','candace','cara','carl','carla','carlos','carly','carmen','carol','caroline',
  'carolyn','carrie','casey','cassandra','catherine','cathy','celeste','chad','charlene','charles',
  'charlotte','chelsea','cheryl','chloe','chris','christina','christine','christopher','cindy','claire',
  'clara','claudia','colleen','connor','courtney','craig','crystal','cynthia','daisy','dale',
  'dana','daniel','daniela','danielle','darlene','dave','david','dawn','dean','deanna',
  'debbie','deborah','debra','denise','derek','desiree','diana','diane','dolores','donna',
  'doris','dorothy','douglas','drew','dustin','dylan','eddie','edward','eileen','elaine',
  'elena','elizabeth','ella','ellen','emily','emma','eric','erica','erika','erin',
  'esther','ethan','eva','evelyn','faith','felicia','fiona','florence','frances','frank',
  'gabriel','gabriela','gabrielle','gail','gary','george','georgia','gerald','gina','glen',
  'glenn','gloria','grace','greg','gregory','hailey','haley','hannah','harold','harry',
  'hazel','heather','heidi','helen','henry','holly','hope','howard','hunter','ian',
  'irene','iris','isaac','isabel','isabella','ivy','jack','jackie','jacob','jacqueline',
  'jade','jaime','jake','james','jamie','jane','janet','janice','jared','jasmine',
  'jason','jay','jean','jeff','jeffrey','jenna','jennifer','jenny','jeremy','jerry',
  'jesse','jessica','jill','jim','jimmy','joan','joanna','joanne','jocelyn','jodi',
  'joe','joel','john','johnny','jon','jonathan','jordan','jose','joseph','josh',
  'joshua','joy','joyce','judith','judy','julia','julie','june','justin','kaitlyn',
  'kara','karen','karina','kate','katelyn','katherine','kathleen','kathryn','kathy','katie',
  'katrina','kay','kayla','keith','kelly','kelsey','ken','kendra','kenneth','kevin',
  'kim','kimberly','kirsten','krista','kristen','kristin','kristina','kristy','kyle','kylie',
  'lacey','lana','lance','larry','laura','lauren','laurie','leah','lee','leigh',
  'lena','leon','leslie','lexy','liam','lillian','lily','linda','lindsay','lindsey',
  'lisa','logan','lois','lori','lorraine','louis','louise','lucia','luis','luke',
  'lydia','lynn','mackenzie','madeline','madison','maggie','mallory','mandy','marc','marcia',
  'marcus','margaret','maria','marie','marilyn','marina','mario','marisa','mark','marlene',
  'martha','martin','mary','matt','matthew','maureen','max','maya','megan','meghan',
  'melanie','melinda','melissa','melody','meredith','mia','michael','michele','michelle','miguel',
  'mike','mildred','mindy','miranda','misty','molly','monica','monique','morgan','nadia',
  'nancy','naomi','natalia','natalie','natasha','nathan','nicholas','nicole','nina','noah',
  'nora','norma','olivia','owen','paige','pamela','patricia','patrick','paul','paula',
  'peggy','penny','peter','philip','phyllis','priscilla','rachel','ralph','randy','ray',
  'raymond','rebecca','regina','renee','rhonda','richard','rick','riley','rita','robert',
  'roberta','robin','rodney','roger','ronald','rosa','rose','rosemary','ruby','russell',
  'ruth','ryan','sabrina','sally','samantha','samuel','sandra','sandy','sara','sarah',
  'savannah','scott','sean','selena','serena','seth','shannon','sharon','shawn','sheila',
  'shelby','shelly','sheri','sherry','shirley','sierra','simone','sofia','sonia','sophia',
  'stacey','stacy','stella','stephanie','stephen','steve','steven','sue','summer','susan',
  'suzanne','sydney','sylvia','tamara','tammy','tanya','tara','tatiana','taylor','teresa',
  'terri','terry','tessa','theresa','thomas','tiffany','timothy','tina','tito','todd',
  'tom','toni','tony','tonya','tracey','tracy','travis','tricia','troy','tyler',
  'valerie','vanessa','vera','veronica','vicki','victoria','vincent','violet','virginia','vivian',
  'walter','wanda','wayne','wendy','wesley','whitney','william','willie','wilma','xavier',
  'yolanda','yvette','yvonne','zachary','zoe'
]);

function isLikelyFirstName(word) {
  return commonFirstNames.has((word || '').toLowerCase());
}

if (html.length > 0) {
  // Strip HTML tags for cleaner text matching
  const textOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const patterns = [
    // "Owner: Jane Smith" or "Founded by Jane Smith"
    /(?:owner|owned\s+by|founded\s+by|proprietor)[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    // "Hi, I'm Jane Smith" or "My name is Jane Smith"
    /(?:hi,?\s+i'?m|hello,?\s+i'?m|my\s+name\s+is|i\s+am)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    // "About Jane Smith" (standalone, not "About Our Team" etc)
    /(?:^|\s)about\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*[,|]|\s+(?:LMT|CMT|RMT|Licensed))/i,
    // "Meet Jane Smith" (standalone)
    /(?:^|\s)meet\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s*[,|]|\s+(?:LMT|CMT|RMT|Licensed|is\s+a|has\s+been))/i,
    // "Jane Smith, LMT" or "Jane Smith, Licensed Massage Therapist"
    /([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s+(?:LMT|CMT|RMT|Licensed\s+Massage)/i
  ];

  for (const pattern of patterns) {
    // Try against both raw HTML and stripped text
    for (const source of [textOnly, html]) {
      const match = source.match(pattern);
      if (match) {
        const fn = match[1];
        const ln = match[2];
        // Validate: first word must be a real name, both words reasonable length
        if (isLikelyFirstName(fn) &&
            fn.length >= 2 && fn.length <= 20 &&
            ln.length >= 2 && ln.length <= 20) {
          firstName = fn;
          lastName = ln;
          break;
        }
      }
    }
    if (firstName) break;
  }
}

const hasContact = !!(firstName && lastName);

return {
  json: {
    _contact: hasContact ? {
      company_id: company.id,
      first_name: firstName,
      last_name: lastName,
      role: 'owner',
      is_owner: true,
      email_business: null,
      email_personal: null,
      phone_direct: null,
      linkedin_url: null,
      location: [company.city, company.state].filter(Boolean).join(', ') || null,
      cultural_affinity: null,
      source: 'website'
    } : null,
    _company_name: company.name,
    _company_id: company.id,
    _source_method: 'website_scrape',
    _has_contact: hasContact
  }
};
```

**Input fields (detected):** city, id, name, state

### Apollo Search Only Contact

- **ID:** `22abecdd-55fb-4826-9462-fa1f3d48594a`
- **Position:** [15792, 240]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 24
- **Notes:** Fallback: uses Apollo search data (first name + obfuscated last name) when enrichment credits are disabled.

**jsCode:**

```javascript
// Apollo search found someone but enrichment is disabled - use search-only data
const item = $input.item.json;
return {
  json: {
    _contact: {
      company_id: item.id,
      first_name: item._apollo_first_name || null,
      last_name: null,
      role: (item._apollo_title || '').toLowerCase().includes('owner') ? 'owner' : 'unknown',
      is_owner: (item._apollo_title || '').toLowerCase().includes('owner'),
      email_business: null,
      email_personal: null,
      phone_direct: null,
      linkedin_url: null,
      location: [item.city, item.state].filter(Boolean).join(', ') || null,
      cultural_affinity: null,
      source: 'apollo'
    },
    _company_name: item.name,
    _company_id: item.id,
    _source_method: 'apollo_search_only',
    _has_contact: !!(item._apollo_first_name)
  }
};
```

**Input fields (detected):** _apollo_first_name, _apollo_title, city, id, name, state

### Parse Apollo Enrich

- **ID:** `9a934f56-ca30-44c5-839c-e298daf33b65`
- **Position:** [15920, 32]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 71

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Parse Apollo Search` | `.item.json` |

**jsCode:**

```javascript
const company = $('Parse Apollo Search').item.json;
const response = $input.item.json;
const person = response.person || response.match || response;

if (!person || !person.first_name) {
  // Enrichment failed but we still have search data
  return {
    json: {
      _contact: {
        company_id: company.id,
        first_name: company._apollo_first_name || null,
        last_name: null,
        role: (company._apollo_title || '').toLowerCase().includes('owner') ? 'owner' : 'unknown',
        is_owner: (company._apollo_title || '').toLowerCase().includes('owner'),
        email_business: null,
        email_personal: null,
        phone_direct: null,
        linkedin_url: null,
        location: [company.city, company.state].filter(Boolean).join(', ') || null,
        cultural_affinity: null,
        source: 'apollo'
      },
      _company_name: company.name,
      _company_id: company.id,
      _source_method: 'apollo_search_only',
      _has_contact: !!(company._apollo_first_name)
    }
  };
}

// Extract phone number
let phoneNumber = null;
if (person.phone_numbers && person.phone_numbers.length > 0) {
  phoneNumber = person.phone_numbers[0].sanitized_number || person.phone_numbers[0].raw_number || null;
}

// Determine role
const title = (person.title || '').toLowerCase();
let role = 'unknown';
let isOwner = false;
if (['owner', 'founder', 'ceo', 'proprietor', 'principal', 'co-founder'].some(k => title.includes(k))) {
  role = 'owner';
  isOwner = true;
} else if (['manager', 'director', 'gm', 'general manager'].some(k => title.includes(k))) {
  role = 'manager';
} else if (['massage', 'therapist', 'lmt', 'cmt', 'rmt', 'esthetician'].some(k => title.includes(k))) {
  role = 'practitioner';
}

return {
  json: {
    _contact: {
      company_id: company.id,
      first_name: person.first_name || null,
      last_name: person.last_name || null,
      role: role,
      is_owner: isOwner,
      email_business: person.email || null,
      email_personal: (person.personal_emails && person.personal_emails[0]) || null,
      phone_direct: phoneNumber,
      linkedin_url: person.linkedin_url || null,
      location: [person.city, person.state].filter(Boolean).join(', ') || [company.city, company.state].filter(Boolean).join(', ') || null,
      cultural_affinity: null,
      source: 'apollo'
    },
    _company_name: company.name,
    _company_id: company.id,
    _source_method: 'apollo_enriched',
    _has_contact: true
  }
};
```

**Input fields (detected):** _apollo_first_name, _apollo_title, city, id, name, state

### Validate & Clean Contact3

- **ID:** `8b5f4d27-1c06-4ae3-9815-c2036fcd7009`
- **Position:** [16000, 240]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 322

> **Shared by 5 nodes:** Validate & Clean Contact3, Validate & Clean Contact4, Validate & Clean Contact2, Validate & Clean Contact1, Validate & Clean Contact

**jsCode:**

```javascript
// Validate & Clean Contact
// Cleans emails, phones, names, LinkedIn URLs before Supabase insert.
// Nulls out invalid data rather than blocking the insert.
// Adds _validation_flags array for audit trail.

const item = $input.item.json;
const contact = item._contact;
const flags = [];

// If no contact object (shouldn't happen, but safety), pass through
if (!contact) {
  return {
    json: {
      ...item,
      _validation_flags: ['no_contact_object']
    }
  };
}

// ═══════════════════════════════════════════════
// EMAIL VALIDATION
// ═══════════════════════════════════════════════

function validateEmail(email, fieldName) {
  if (!email) return null;

  // Trim and lowercase
  let cleaned = email.trim().toLowerCase();

  // Basic format check: x@x.x
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleaned)) {
    flags.push(`${fieldName}_invalid_format: "${email}"`);
    return null;
  }

  // Reject known junk/placeholder patterns
  const junkPatterns = [
    /^noreply@/,
    /^no-reply@/,
    /^donotreply@/,
    /^do-not-reply@/,
    /^test@/,
    /^admin@example\./,
    /^info@example\./,
    /^user@example\./,
    /^sample@/,
    /^fake@/,
    /^placeholder@/,
    /^null@/,
    /^none@/,
    /^na@/,
    /^n\/a@/,
    /^unknown@/,
    /^abuse@/,
    /^postmaster@/,
    /^mailer-daemon@/
  ];

  if (junkPatterns.some(p => p.test(cleaned))) {
    flags.push(`${fieldName}_junk_pattern: "${cleaned}"`);
    return null;
  }

  // Reject common role-based/generic emails (not personal)
  const rolePatterns = [
    /^info@/,
    /^contact@/,
    /^hello@/,
    /^support@/,
    /^sales@/,
    /^office@/,
    /^billing@/,
    /^reception@/,
    /^frontdesk@/,
    /^front\.desk@/,
    /^appointments@/,
    /^booking@/,
    /^bookings@/,
    /^schedule@/,
    /^scheduling@/,
    /^inquiries@/,
    /^inquiry@/,
    /^general@/,
    /^team@/,
    /^staff@/
  ];

  if (rolePatterns.some(p => p.test(cleaned))) {
    flags.push(`${fieldName}_role_based: "${cleaned}"`);
    return null;
  }

  // Reject emails with known placeholder/test domains
  const junkDomains = [
    'example.com', 'example.org', 'example.net',
    'test.com', 'test.org',
    'placeholder.com',
    'fake.com',
    'noemail.com',
    'nomail.com',
    'none.com',
    'localhost',
    'mailinator.com',
    'guerrillamail.com',
    'tempmail.com',
    'throwaway.email',
    'yopmail.com'
  ];

  const domain = cleaned.split('@')[1];
  if (junkDomains.includes(domain)) {
    flags.push(`${fieldName}_junk_domain: "${domain}"`);
    return null;
  }

  // Reject if local part is just numbers (often auto-generated)
  const localPart = cleaned.split('@')[0];
  if (/^\d+$/.test(localPart)) {
    flags.push(`${fieldName}_numeric_local: "${cleaned}"`);
    return null;
  }

  // Check for double dots, leading/trailing dots in local part
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    flags.push(`${fieldName}_malformed_local: "${cleaned}"`);
    return null;
  }

  return cleaned;
}

contact.email_business = validateEmail(contact.email_business, 'email_business');
contact.email_personal = validateEmail(contact.email_personal, 'email_personal');


// ═══════════════════════════════════════════════
// PHONE VALIDATION (E.164 normalization)
// ═══════════════════════════════════════════════

function validatePhone(phone, fieldName) {
  if (!phone) return null;

  // Handle Apollo returning phone as object instead of string
  if (typeof phone === 'object' && phone !== null) {
    phone = phone.sanitized_number || phone.raw_number || phone.number || '';
  }

  // Strip everything except digits and leading +
  let cleaned = phone.toString().trim();
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[^\d]/g, '');

  if (!cleaned || cleaned.length === 0) {
    flags.push(`${fieldName}_empty_after_strip`);
    return null;
  }

  // US/CA normalization: should be 10 digits (or 11 with leading 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    cleaned = cleaned; // already has country code
  } else if (cleaned.length === 10) {
    cleaned = '1' + cleaned; // prepend country code
  } else if (cleaned.length < 10) {
    flags.push(`${fieldName}_too_short: "${phone}" (${cleaned.length} digits)`);
    return null;
  } else if (cleaned.length > 11) {
    // Could be international — keep it but flag for review
    flags.push(`${fieldName}_possibly_international: "${phone}" (${cleaned.length} digits)`);
    return '+' + cleaned;
  }

  // Validate US/CA area code (first digit after country code can't be 0 or 1)
  const areaCode = cleaned.substring(1, 4);
  if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
    flags.push(`${fieldName}_invalid_area_code: "${areaCode}"`);
    return null;
  }

  return '+' + cleaned;
}

contact.phone_direct = validatePhone(contact.phone_direct, 'phone_direct');


// ═══════════════════════════════════════════════
// NAME CLEANING
// ═══════════════════════════════════════════════

function cleanName(name, fieldName) {
  if (!name) return null;

  let cleaned = name.trim();

  // Strip Apollo obfuscation artifacts (trailing *, partial names)
  cleaned = cleaned.replace(/\*+$/, '').trim();

  // Reject single-character names
  if (cleaned.length <= 1) {
    flags.push(`${fieldName}_too_short: "${name}"`);
    return null;
  }

  // Reject all-numeric "names"
  if (/^\d+$/.test(cleaned)) {
    flags.push(`${fieldName}_numeric: "${name}"`);
    return null;
  }

  // Reject names with numbers mixed in (likely data artifacts)
  if (/\d/.test(cleaned)) {
    flags.push(`${fieldName}_contains_digits: "${name}"`);
    return null;
  }

  // Reject names that are clearly not names
  const junkNames = [
    'unknown', 'n/a', 'na', 'none', 'null', 'test',
    'owner', 'manager', 'admin', 'info', 'contact'
  ];
  if (junkNames.includes(cleaned.toLowerCase())) {
    flags.push(`${fieldName}_junk_name: "${name}"`);
    return null;
  }

  // Reject massage therapy credentials stored as names (Apollo artifact)
  const credentials = [
    'lmt', 'cmt', 'rmt', 'lmbt', 'lmp', 'bctmb', 'nctmb', 'nctm',
    'cpt', 'cst', 'mld', 'nmt', 'amt', 'abmp'
  ];
  if (credentials.includes(cleaned.toLowerCase())) {
    flags.push(`${fieldName}_credential_not_name: "${name}"`);
    return null;
  }

  // Title case normalization: "JANE" → "Jane", "jane" → "Jane"
  // Preserve already-correct casing like "McDonald", "O'Brien"
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }

  return cleaned;
}

contact.first_name = cleanName(contact.first_name, 'first_name');
contact.last_name = cleanName(contact.last_name, 'last_name');

// If first_name got nulled out, this contact is essentially useless
if (!contact.first_name) {
  flags.push('contact_has_no_valid_first_name');
}


// ═══════════════════════════════════════════════
// LINKEDIN URL VALIDATION
// ═══════════════════════════════════════════════

function validateLinkedIn(url) {
  if (!url) return null;

  let cleaned = url.trim();

  // Must contain linkedin.com/in/ for personal profiles
  if (!/linkedin\.com\/in\//i.test(cleaned)) {
    // Could be a company page or malformed URL
    if (/linkedin\.com/i.test(cleaned)) {
      flags.push(`linkedin_not_personal_profile: "${cleaned}"`);
    } else {
      flags.push(`linkedin_invalid_url: "${cleaned}"`);
    }
    return null;
  }

  // Ensure https:// prefix
  if (!cleaned.startsWith('http')) {
    cleaned = 'https://' + cleaned;
  }

  // Normalize to https
  cleaned = cleaned.replace(/^http:\/\//, 'https://');

  return cleaned;
}

contact.linkedin_url = validateLinkedIn(contact.linkedin_url);


// ═══════════════════════════════════════════════
// LOCATION CLEANING
// ═══════════════════════════════════════════════

if (contact.location) {
  contact.location = contact.location.trim();
  // Null out empty-ish locations
  if (!contact.location || contact.location === ',' || contact.location.length < 2) {
    contact.location = null;
    flags.push('location_empty_after_clean');
  }
}


// ═══════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════

// Update _has_contact based on whether we still have a valid first name
const hasValidContact = !!(contact.first_name);

if (flags.length > 0) {
  console.log(`Validation [${item._company_name}] (${item._source_method}): ${flags.join(', ')}`);
}

return {
  json: {
    _contact: contact,
    _company_name: item._company_name,
    _company_id: item._company_id,
    _source_method: item._source_method,
    _has_contact: hasValidContact,
    _validation_flags: flags
  }
};
```

**Input fields (detected):** _company_id, _company_name, _contact, _source_method, email_business, email_personal, first_name, last_name, linkedin_url, location, phone_direct

### Validate & Clean Contact4

- **ID:** `7c80f89d-8f02-4bd8-b532-011e20bd571f`
- **Position:** [16048, 400]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 322

> **DUPLICATE:** Identical code to **Validate & Clean Contact3** — see that node for full jsCode.

### Validate & Clean Contact2

- **ID:** `ef1c6cd7-79c0-41e8-84d6-48d976da7f7b`
- **Position:** [16080, 624]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 322

> **DUPLICATE:** Identical code to **Validate & Clean Contact3** — see that node for full jsCode.

### Validate & Clean Contact1

- **ID:** `dae65b65-8ee9-40d0-8c97-40de12212eb3`
- **Position:** [16112, 32]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 322

> **DUPLICATE:** Identical code to **Validate & Clean Contact3** — see that node for full jsCode.

### Validate & Clean Contact

- **ID:** `78ec8b0a-9b29-4c6f-84b0-5591436a7649`
- **Position:** [16128, -160]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForEachItem`
- **Lines:** 322

> **DUPLICATE:** Identical code to **Validate & Clean Contact3** — see that node for full jsCode.

### Run Summary3

- **ID:** `5348f2b3-d72b-4a66-9ecb-9631da22e8f2`
- **Position:** [16640, 144]
- **Step:** Step 3a: Find People
- **Mode:** `runOnceForAllItems`
- **Lines:** 128
- **Notes:** Final summary: contacts created from each source (solo detection, Apollo, website scrape, name extraction).

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Step 3a Config` | `.first` |
| `Filter & Parse Batch` | `.all` |
| `Prepare Solo Contact` | `.all` |
| `Parse Apollo Search` | `.all` |
| `Parse Apollo Enrich` | `.all` |
| `Apollo Search Only Contact` | `.all` |
| `Parse About Page` | `.all` |
| `No Domain Fallback` | `.all` |

**jsCode:**

```javascript
// Collect stats from all paths
const config = $('Step 3a Config').first().json;
let companiesProcessed = 0;
let soloDetected = 0;
let soloWithName = 0;
let apolloSearched = 0;
let apolloFound = 0;
let apolloEnriched = 0;
let websiteScraped = 0;
let websiteFoundName = 0;
let noDomainFallback = 0;
let noDomainFoundName = 0;
let totalContactsInserted = 0;

// Validation stats
let validationTotal = 0;
let emailsNulled = 0;
let phonesNulled = 0;
let namesNulled = 0;
let linkedinNulled = 0;
let roleBasedEmails = 0;
let contactsWithFlags = 0;
let allFlags = [];

try {
  const batchItems = $('Filter & Parse Batch').all();
  companiesProcessed = batchItems.filter(i => !i.json._empty).length;
} catch(e) {}

try {
  const soloItems = $('Prepare Solo Contact').all();
  soloDetected = soloItems.length;
  soloWithName = soloItems.filter(i => i.json._has_contact).length;
} catch(e) {}

try {
  const apolloItems = $('Parse Apollo Search').all();
  apolloSearched = apolloItems.length;
  apolloFound = apolloItems.filter(i => i.json._apollo_found).length;
} catch(e) {}

try {
  const enrichItems = $('Parse Apollo Enrich').all();
  apolloEnriched = enrichItems.filter(i => i.json._has_contact).length;
} catch(e) {}

try {
  const searchOnlyItems = $('Apollo Search Only Contact').all();
  apolloEnriched += searchOnlyItems.filter(i => i.json._has_contact).length;
} catch(e) {}

try {
  const aboutItems = $('Parse About Page').all();
  websiteScraped = aboutItems.length;
  websiteFoundName = aboutItems.filter(i => i.json._has_contact).length;
} catch(e) {}

try {
  const noDomainItems = $('No Domain Fallback').all();
  noDomainFallback = noDomainItems.length;
  noDomainFoundName = noDomainItems.filter(i => i.json._has_contact).length;
} catch(e) {}

// Collect validation stats from all 5 Validate & Clean nodes
const validateNodeNames = [
  'Validate & Clean Contact',
  'Validate & Clean Contact1',
  'Validate & Clean Contact2',
  'Validate & Clean Contact3',
  'Validate & Clean Contact4'
];

for (const nodeName of validateNodeNames) {
  try {
    const validatedItems = $(nodeName).all();
    validationTotal += validatedItems.length;
    for (const item of validatedItems) {
      const flags = item.json._validation_flags || [];
      if (flags.length > 0) {
        contactsWithFlags++;
        allFlags.push(...flags);
      }
    }
  } catch(e) {
    // Node didn't execute in this run (normal - not all paths fire every time)
  }
}

emailsNulled = allFlags.filter(f => f.startsWith('email_business_') || f.startsWith('email_personal_')).length;
phonesNulled = allFlags.filter(f => f.startsWith('phone_direct_')).length;
namesNulled = allFlags.filter(f => f.startsWith('first_name_') || f.startsWith('last_name_') || f === 'contact_has_no_valid_first_name').length;
linkedinNulled = allFlags.filter(f => f.startsWith('linkedin_')).length;
roleBasedEmails = allFlags.filter(f => f.includes('_role_based')).length;

totalContactsInserted = soloWithName + apolloEnriched + websiteFoundName + noDomainFoundName;

const summary = {
  run_completed_at: new Date().toISOString(),
  batch_size: config.batch_size,
  companies_processed: companiesProcessed,
  solo_detected: soloDetected,
  solo_with_name_extracted: soloWithName,
  apollo_searched: apolloSearched,
  apollo_found_people: apolloFound,
  apollo_contacts_created: apolloEnriched,
  website_scraped: websiteScraped,
  website_names_found: websiteFoundName,
  no_domain_fallback: noDomainFallback,
  no_domain_names_found: noDomainFoundName,
  total_contacts_inserted: totalContactsInserted,
  companies_without_contacts: companiesProcessed - totalContactsInserted,
  validation: {
    contacts_validated: validationTotal,
    contacts_with_issues: contactsWithFlags,
    emails_nulled: emailsNulled,
    role_based_emails_rejected: roleBasedEmails,
    phones_nulled: phonesNulled,
    names_nulled: namesNulled,
    linkedin_nulled: linkedinNulled,
    all_flags: allFlags
  },
  message: `Created ${totalContactsInserted} contacts from ${companiesProcessed} companies. Sources: ${soloWithName} solo, ${apolloEnriched} Apollo, ${websiteFoundName} website, ${noDomainFoundName} name extraction. Validation cleaned ${contactsWithFlags}/${validationTotal} contacts (${emailsNulled} emails, ${phonesNulled} phones, ${namesNulled} names nulled).`
};

console.log('=== STEP 3a: FIND PEOPLE SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

return [{ json: summary }];
```

**Input fields (detected):** _validation_flags

### Bridge to 4

- **ID:** `bbee8b1b-c4e8-493c-9f1f-54bd6f8ddd8c`
- **Position:** [16864, 144]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 2

> **DUPLICATE:** Identical code to **Bridge to 3b** — see that node for full jsCode.

### Collapse to Single

- **ID:** `81541afe-d0b6-41be-9d80-0b96c9d4a75e`
- **Position:** [17536, 144]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 2

**jsCode:**

```javascript
// Collapse to single item - Fetch Contacts data is accessed by name in Filter & Merge
return [{ json: { _trigger: 'fetch_companies' } }];
```

**Input fields (detected):** (none detected)

### Filter & Merge Contacts

- **ID:** `82cda0ea-ce05-42be-9baa-58f5cc657eac`
- **Position:** [17984, 144]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 71
- **Notes:** Merges contact data with company data. Filters to contacts that still need enrichment (missing email, cultural_affinity, phone, linkedin, OR email_status is unverified).

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Fetch Contacts` | `.all` |
| `Fetch Companies1` | `.all` |

**jsCode:**

```javascript
// Merge contacts with their company data and filter to those needing enrichment
const contactItems = $('Fetch Contacts').all();
const companyItems = $('Fetch Companies1').all();

// Parse contacts - deduplicate by id
let rawContacts = [];
for (const item of contactItems) {
  if (item.json && Array.isArray(item.json)) {
    rawContacts.push(...item.json);
  } else if (item.json && item.json.id) {
    rawContacts.push(item.json);
  }
}

// Deduplicate by contact id
const seenIds = new Set();
let contacts = [];
for (const c of rawContacts) {
  if (c.id && !seenIds.has(c.id)) {
    seenIds.add(c.id);
    contacts.push(c);
  }
}

// Parse companies into a lookup map (map deduplicates naturally)
let companyMap = {};
for (const item of companyItems) {
  if (Array.isArray(item.json)) {
    for (const co of item.json) {
      if (co.id) companyMap[co.id] = co;
    }
  } else if (item.json && item.json.id) {
    companyMap[item.json.id] = item.json;
  }
}

// Filter contacts that need enrichment:
// any contact where there's still something to enrich
const needsEnrichment = contacts.filter(c => {
  const missingEmail = !c.email_business;
  const missingCulturalAffinity = !c.cultural_affinity;
  const missingPhone = !c.phone_direct;
  const missingLinkedin = !c.linkedin_url;
  // Check if email needs verification: has email but status is not verified/invalid/risky/accept_all
  const verifiedStatuses = ['verified', 'invalid', 'risky', 'accept_all'];
  const emailNeedsVerification = c.email_business && !verifiedStatuses.includes(c.email_status);
  return missingEmail || missingCulturalAffinity || missingPhone || missingLinkedin || emailNeedsVerification;
});

console.log(`Contacts: ${rawContacts.length} raw, ${contacts.length} unique, ${needsEnrichment.length} need enrichment, ${contacts.length - needsEnrichment.length} already fully enriched`);

if (needsEnrichment.length === 0) {
  return [{ json: { _empty: true, _count: 0, _message: 'All contacts are already enriched' } }];
}

// Merge company data into each contact
const merged = needsEnrichment.map(c => {
  const company = companyMap[c.company_id] || {};
  return {
    json: {
      ...c,
      _company_name: company.name || null,
      _company_domain: company.domain || null,
      _company_phone: company.phone || null,
      _company_city: company.city || null,
      _company_state: company.state || null
    }
  };
});

return merged;
```

**Input fields (detected):** city, domain, id, name, phone, state

### No Records - Done3

- **ID:** `ff66d587-56fe-4b0b-aa28-7b77c9dfc6b3`
- **Position:** [18432, 48]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**jsCode:**

```javascript
return [{ json: { message: 'No contacts need enrichment. All done!', completed_at: new Date().toISOString() } }];
```

**Input fields (detected):** (none detected)

### Skip Hunter

- **ID:** `60863bb9-1b6d-4574-8898-e6d7e724c25c`
- **Position:** [19232, 80]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 13

**jsCode:**

```javascript
// Hunter is disabled — pass through with no hunter results
const item = $input.item.json;

return {
  json: {
    ...item,
    _hunter_email: null,
    _hunter_score: 0,
    _hunter_linkedin: null,
    _hunter_phone: null,
    _email_source: null
  }
};
```

**Input fields (detected):** (none detected)

### Parse Hunter Response

- **ID:** `c81f5c4f-a06a-4bac-9aea-18bc0ef26a31`
- **Position:** [19232, 400]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 32

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Has Domain & Name?` | `.item.json` |

**jsCode:**

```javascript
const contact = $('Has Domain & Name?').item.json;
const response = $input.item.json;

let hunterEmail = null;
let hunterScore = 0;
let hunterLinkedin = null;
let hunterPhone = null;
let hunterPosition = null;

// Hunter v2 response: { data: { email, score, linkedin_url, phone_number, position } }
const data = response.data || response;
if (data && data.email && data.score >= 50) {
  hunterEmail = data.email;
  hunterScore = data.score || 0;
  hunterLinkedin = data.linkedin_url || null;
  hunterPhone = data.phone_number || null;
  hunterPosition = data.position || null;
}

console.log(`Hunter for ${contact.first_name} ${contact.last_name || ''} @ ${contact._company_domain}: ${hunterEmail ? hunterEmail + ' (score: ' + hunterScore + ')' : 'no result'}`);

return {
  json: {
    ...contact,
    _hunter_email: hunterEmail,
    _hunter_score: hunterScore,
    _hunter_linkedin: hunterLinkedin,
    _hunter_phone: hunterPhone,
    _hunter_position: hunterPosition,
    _email_source: hunterEmail ? 'hunter' : null
  }
};
```

**Input fields (detected):** _company_domain, first_name, last_name

### Skip Email - Pass Through

- **ID:** `d92f1323-f5fd-4467-a11c-6f069c2bfab0`
- **Position:** [20096, -32]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 12
- **Notes:** Contacts that already have email_business or don't have domain+name skip email waterfall.

**jsCode:**

```javascript
// For contacts that already have email or can't do email lookup — just pass through with existing data
const item = $input.item.json;

return {
  json: {
    ...item,
    _best_email: item.email_business || null,
    _best_phone: item.phone_direct || item._company_phone || null,
    _best_linkedin: item.linkedin_url || null,
    _email_source: item.email_business ? 'existing' : null
  }
};
```

**Input fields (detected):** _company_phone, email_business, linkedin_url, phone_direct

### Skip Snov.io

- **ID:** `7e692961-46aa-4db9-acdf-37322c18a060`
- **Position:** [20128, 240]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 9

**jsCode:**

```javascript
// Snov.io disabled — pass through
const item = $input.item.json;

return {
  json: {
    ...item,
    _snovio_email: null
  }
};
```

**Input fields (detected):** (none detected)

### Parse Snov.io Response

- **ID:** `d64e3483-e853-49f5-9a2d-633395d3b8b2`
- **Position:** [20128, 400]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 26

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Hunter Found Email?` | `.item.json` |

**jsCode:**

```javascript
const contact = $input.item.json;
const response = $input.item.json;

// Snov.io response has emails array
let snovEmail = null;
const emails = response.emails || response.data?.emails || [];

if (Array.isArray(emails) && emails.length > 0) {
  // Pick the first valid email
  const validEmail = emails.find(e => e.emailStatus === 'valid' || e.status === 'valid') || emails[0];
  snovEmail = validEmail.email || validEmail.value || null;
}

// Preserve upstream contact data (it's in the same json since HTTP node passes through)
// We need to get the original contact data from the upstream node
const upstreamContact = $('Hunter Found Email?').item.json;

console.log(`Snov.io for ${upstreamContact.first_name} ${upstreamContact.last_name || ''}: ${snovEmail || 'no result'}`);

return {
  json: {
    ...upstreamContact,
    _snovio_email: snovEmail,
    _email_source: snovEmail ? 'snovio' : upstreamContact._email_source
  }
};
```

**Input fields (detected):** (none detected)

### Merge Email Results

- **ID:** `a0be5606-9334-41d7-af77-e599d8f86dee`
- **Position:** [20320, 160]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 21
- **Notes:** Merges results from email waterfall (Hunter → Snov.io) and picks the best available email, phone, linkedin.

**jsCode:**

```javascript
const item = $input.item.json;

// Determine best email from waterfall
let bestEmail = item._hunter_email || item._snovio_email || null;
let emailSource = item._email_source || null;

// Determine best phone: direct phone > hunter phone > company phone fallback
let bestPhone = item.phone_direct || item._hunter_phone || item._company_phone || null;

// Determine best linkedin
let bestLinkedin = item.linkedin_url || item._hunter_linkedin || null;

return {
  json: {
    ...item,
    _best_email: bestEmail,
    _best_phone: bestPhone,
    _best_linkedin: bestLinkedin,
    _email_source: emailSource
  }
};
```

**Input fields (detected):** _company_phone, _email_source, _hunter_email, _hunter_linkedin, _hunter_phone, _snovio_email, linkedin_url, phone_direct

### No Domain - Skip Email

- **ID:** `ab0c3486-9ad4-43bb-8e80-8f8e92691a38`
- **Position:** [20352, 544]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 12
- **Notes:** Contacts without domain+name can't do email finder lookups. Still proceeds to NamSor.

**jsCode:**

```javascript
// Contacts without domain+name can't use email finder APIs — pass through
const item = $input.item.json;

return {
  json: {
    ...item,
    _best_email: null,
    _best_phone: item.phone_direct || item._company_phone || null,
    _best_linkedin: item.linkedin_url || null,
    _email_source: null
  }
};
```

**Input fields (detected):** _company_phone, linkedin_url, phone_direct

### Collect Email Results

- **ID:** `40f54f8e-8f98-4e37-a231-58b579509e67`
- **Position:** [20560, 160]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 18

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Merge Email Results` | `.all` |
| `Skip Email - Pass Through` | `.all` |
| `No Domain - Skip Email` | `.all` |

**jsCode:**

```javascript
// Collect all items from all three email paths and deduplicate
const items = [];
try { items.push(...$('Merge Email Results').all()); } catch(e) {}
try { items.push(...$('Skip Email - Pass Through').all()); } catch(e) {}
try { items.push(...$('No Domain - Skip Email').all()); } catch(e) {}

const seen = new Set();
const unique = [];
for (const item of items) {
  const id = item.json.id;
  if (id && !seen.has(id)) {
    seen.add(id);
    unique.push({ json: item.json });
  }
}

console.log(`Collected ${items.length} items from email paths, ${unique.length} unique contacts`);
return unique;
```

**Input fields (detected):** id

### Skip Verification

- **ID:** `e611d79d-01f6-4df6-9782-7b6e3e23ea48`
- **Position:** [21120, 336]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 13

**jsCode:**

```javascript
// Verification skipped (disabled or no email to verify) — pass through
const item = $input.item.json;

return {
  json: {
    ...item,
    _email_status: item._best_email ? 'unverified' : null,
    _email_verified_at: null,
    _verifier_score: null,
    _verifier_smtp_check: null,
    _verifier_mx_records: null
  }
};
```

**Input fields (detected):** _best_email

### Parse Verifier Response

- **ID:** `ea83c777-3e8a-4ba3-8fd2-a11ed9964c89`
- **Position:** [21312, 128]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 53

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Has Email to Verify?` | `.item.json` |

**jsCode:**

```javascript
const contact = $('Has Email to Verify?').item.json;
const response = $input.item.json;

let emailStatus = 'unverified';
let verifierScore = null;
let smtpCheck = null;
let mxRecords = null;

// Hunter v2 verifier response: { data: { status, score, smtp_check, mx_records, ... } }
const data = response.data || response;

if (data && data.status) {
  // Map Hunter status to our schema values
  // Hunter returns: valid, invalid, accept_all, webmail, disposable, unknown
  switch (data.status) {
    case 'valid':
      emailStatus = 'verified';
      break;
    case 'invalid':
      emailStatus = 'invalid';
      break;
    case 'accept_all':
      emailStatus = 'accept_all';
      break;
    case 'disposable':
      emailStatus = 'invalid'; // treat disposable as invalid for outreach
      break;
    case 'webmail':
      emailStatus = 'verified'; // webmail (gmail, yahoo) is valid for outreach
      break;
    case 'unknown':
    default:
      emailStatus = 'risky';
      break;
  }

  verifierScore = data.score || null;
  smtpCheck = data.smtp_check !== undefined ? data.smtp_check : null;
  mxRecords = data.mx_records !== undefined ? data.mx_records : null;
}

console.log(`Verifier for ${contact._best_email}: ${emailStatus} (score: ${verifierScore}, smtp: ${smtpCheck})`);

return {
  json: {
    ...contact,
    _email_status: emailStatus,
    _email_verified_at: new Date().toISOString(),
    _verifier_score: verifierScore,
    _verifier_smtp_check: smtpCheck,
    _verifier_mx_records: mxRecords
  }
};
```

**Input fields (detected):** _best_email

### Collect Verified Results

- **ID:** `34342f98-87fa-44e7-a5ab-431c0076baaa`
- **Position:** [21472, 240]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 17

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Parse Verifier Response` | `.all` |
| `Skip Verification` | `.all` |

**jsCode:**

```javascript
// Collect from verification paths and deduplicate
const items = [];
try { items.push(...$('Parse Verifier Response').all()); } catch(e) {}
try { items.push(...$('Skip Verification').all()); } catch(e) {}

const seen = new Set();
const unique = [];
for (const item of items) {
  const id = item.json.id;
  if (id && !seen.has(id)) {
    seen.add(id);
    unique.push({ json: item.json });
  }
}

console.log(`Collected ${items.length} items from verification paths, ${unique.length} unique contacts`);
return unique;
```

**Input fields (detected):** id

### Parse NamSor Response

- **ID:** `2e70abe4-4633-4fb3-919b-41354769f215`
- **Position:** [22016, 144]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 34

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Needs NamSor?` | `.item.json` |

**jsCode:**

```javascript
const contact = $('Needs NamSor?').item.json;
const response = $input.item.json;

// NamSor origin response: { countryOrigin, countryOriginAlt, regionOrigin, subRegionOrigin, probabilityCalibrated }
let culturalAffinity = null;

if (response && response.countryOrigin) {
  // Build a readable cultural affinity string
  const parts = [];
  if (response.regionOrigin) parts.push(response.regionOrigin);
  if (response.subRegionOrigin && response.subRegionOrigin !== response.regionOrigin) {
    parts.push(response.subRegionOrigin);
  }
  if (response.countryOrigin) parts.push(response.countryOrigin);
  
  culturalAffinity = parts.join(' / ');
  
  // If probability is very low, mark as uncertain
  if (response.probabilityCalibrated && response.probabilityCalibrated < 0.3) {
    culturalAffinity = culturalAffinity + ' (low confidence)';
  }
}

console.log(`NamSor for ${contact.first_name} ${contact.last_name || ''}: ${culturalAffinity || 'no result'}`);

return {
  json: {
    ...contact,
    _cultural_affinity: culturalAffinity,
    _namsor_country: response.countryOrigin || null,
    _namsor_region: response.regionOrigin || null,
    _namsor_probability: response.probabilityCalibrated || null
  }
};
```

**Input fields (detected):** first_name, last_name

### Skip NamSor

- **ID:** `46b0dec8-5a15-44b3-92e8-3479bb7be764`
- **Position:** [22016, 336]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 12

**jsCode:**

```javascript
// NamSor skipped — pass through with existing cultural_affinity (if any)
const item = $input.item.json;

return {
  json: {
    ...item,
    _cultural_affinity: item.cultural_affinity || null,
    _namsor_country: null,
    _namsor_region: null,
    _namsor_probability: null
  }
};
```

**Input fields (detected):** cultural_affinity

### Collect NamSor Results

- **ID:** `740434fd-1b38-4b3c-9508-78d4a422957b`
- **Position:** [22336, 240]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 17

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Parse NamSor Response` | `.all` |
| `Skip NamSor` | `.all` |

**jsCode:**

```javascript
// Collect from NamSor paths and deduplicate
const items = [];
try { items.push(...$('Parse NamSor Response').all()); } catch(e) {}
try { items.push(...$('Skip NamSor').all()); } catch(e) {}

const seen = new Set();
const unique = [];
for (const item of items) {
  const id = item.json.id;
  if (id && !seen.has(id)) {
    seen.add(id);
    unique.push({ json: item.json });
  }
}

console.log(`Collected ${items.length} items from NamSor paths, ${unique.length} unique contacts`);
return unique;
```

**Input fields (detected):** id

### Prepare Contact Update

- **ID:** `4d212022-0a6f-4a89-af49-a2761e2a4a75`
- **Position:** [22688, 224]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForEachItem`
- **Lines:** 97
- **Notes:** Builds the Supabase PATCH payload. Includes email_status, email_verified_at, and validates phone (E.164). Nulls out invalid emails.

**jsCode:**

```javascript
const item = $input.item.json;

// ── Phone validation (same logic as Layer 1) ──
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
  if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
    return null;
  }

  return '+' + cleaned;
}

// Build the update payload — only include fields that have new data
const update = {};

// Email: prefer waterfall result over existing
const newEmail = item._best_email;
if (newEmail && !item.email_business) {
  update.email_business = newEmail;
}

// Email verification status
if (item._email_status && item._email_status !== 'unverified') {
  update.email_status = item._email_status;
  update.email_verified_at = item._email_verified_at;

  // If email was found invalid, null it out so we don't store bad data
  if (item._email_status === 'invalid') {
    update.email_business = null;
    // Also remove from best_email tracking
    console.log(`Invalid email removed for ${item.first_name} ${item.last_name || ''}: ${newEmail || item.email_business}`);
  }
} else if (newEmail || item.email_business) {
  // Email exists but wasn't verified (verifier skipped) — mark as unverified
  update.email_status = 'unverified';
}

// Phone: prefer direct phone, then hunter, then company fallback
// Apply validation to all phone sources
const newPhone = validatePhone(item._best_phone);
if (newPhone && !item.phone_direct) {
  update.phone_direct = newPhone;
}

// LinkedIn
const newLinkedin = item._best_linkedin;
if (newLinkedin && !item.linkedin_url) {
  update.linkedin_url = newLinkedin;
}

// Cultural affinity from NamSor
const newAffinity = item._cultural_affinity;
if (newAffinity && !item.cultural_affinity) {
  update.cultural_affinity = newAffinity;
}

const hasUpdates = Object.keys(update).length > 0;

console.log(`Contact ${item.first_name} ${item.last_name || ''} (${item.id}): ${hasUpdates ? JSON.stringify(update) : 'no new data'}`);

return {
  json: {
    _contact_id: item.id,
    _company_id: item.company_id,
    _first_name: item.first_name,
    _last_name: item.last_name,
    _company_name: item._company_name,
    _update_payload: hasUpdates ? update : null,
    _has_updates: hasUpdates,
    _email_source: item._email_source || null,
    _email_status: item._email_status || null,
    _verifier_score: item._verifier_score || null,
    _namsor_country: item._namsor_country || null,
    _namsor_probability: item._namsor_probability || null
  }
};
```

**Input fields (detected):** _best_email, _best_linkedin, _best_phone, _company_name, _cultural_affinity, _email_source, _email_status, _email_verified_at, _namsor_country, _namsor_probability, _verifier_score, company_id, cultural_affinity, email_business, first_name, id, last_name, linkedin_url, phone_direct

### Collect Updates

- **ID:** `2757cd87-cb51-41d5-88e8-5cccd21a1533`
- **Position:** [23328, 224]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 16

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Update Contact in Supabase` | `.all` |
| `Has Updates?` | `.all` |

**jsCode:**

```javascript
// Collect from update paths and deduplicate
const items = [];
try { items.push(...$('Update Contact in Supabase').all()); } catch(e) {}
try { items.push(...$('Has Updates?').all().filter(i => !i.json._has_updates)); } catch(e) {}

const seen = new Set();
const unique = [];
for (const item of items) {
  const id = item.json._contact_id || item.json.id;
  if (id && !seen.has(id)) {
    seen.add(id);
    unique.push({ json: item.json });
  }
}

return unique;
```

**Input fields (detected):** _contact_id, id

### Run Summary4

- **ID:** `4406e050-b543-4a6c-932f-9620e8d59d3a`
- **Position:** [23536, 224]
- **Step:** Step 4: Enrich People
- **Mode:** `runOnceForAllItems`
- **Lines:** 100
- **Notes:** Final summary: contacts processed, emails found (by source), verification results, phones added, cultural affinity set.

**Upstream References:**

| Referenced Node | Method |
|-----------------|--------|
| `Step 4 Config` | `.first` |
| `Prepare Contact Update` | `.all` |

**jsCode:**

```javascript
const config = $('Step 4 Config').first().json;

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

// Verification stats
let emailsVerified = 0;
let emailsInvalid = 0;
let emailsRisky = 0;
let emailsAcceptAll = 0;
let emailsUnverified = 0;
let verificationTotal = 0;

// Count from Prepare Contact Update outputs
try {
  const prepItems = $('Prepare Contact Update').all();
  totalProcessed = prepItems.length;
  for (const item of prepItems) {
    const d = item.json;
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

    // Verification stats
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
  }
} catch(e) {
  console.log('Error collecting stats:', e.message);
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
  phone_enrichment: {
    phones_added: phonesEnriched
  },
  linkedin_enrichment: {
    linkedin_added: linkedinEnriched
  },
  namsor_enrichment: {
    names_sent: namsorProcessed,
    cultural_affinity_set: namsorSuccess
  },
  message: `Processed ${totalProcessed} contacts. Updated ${contactsUpdated} (${emailsFound} emails, ${phonesEnriched} phones, ${linkedinEnriched} LinkedIn, ${namsorSuccess} cultural affinity). Verification: ${emailsVerified} valid, ${emailsInvalid} invalid removed, ${emailsRisky} risky, ${emailsAcceptAll} accept_all, ${emailsUnverified} not checked. ${contactsSkipped} had no new data.`
};

console.log('=== STEP 4: ENRICH PEOPLE SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

return [{ json: summary }];
```

**Input fields (detected):** (none detected)

---

## 7. Merge Node Details (2 nodes)

### Merge All Sources

- **ID:** `faed64de-f147-4b08-a334-e051efca3fa3`
- **Position:** [1392, -16]
- **Step:** Step 1: Discovery
- **Mode:** ``
- **typeVersion:** 3

**Inputs:**
- input[0] <- Normalize Google Results (output[0])
- input[1] <- Normalize Yelp Results (output[0])

### Merge Backfill

- **ID:** `4ce8b67b-5241-4ec8-8be6-59c04f25b715`
- **Position:** [4304, 80]
- **Step:** Step 2: Company Enrichment
- **Mode:** ``
- **typeVersion:** 3.2

**Inputs:**
- input[1] <- Needs Backfill? (output[1])
- input[0] <- Extract & Patch Domain (output[0])

---

## 8. Wait Node Details (3 nodes)

### Wait 30s

- **ID:** `87611ab3-5320-4f87-9af6-6acd25fc9fc8`
- **Position:** [48, 80]
- **Step:** Step 1: Discovery
- **Amount:** 20
- **Unit:** 

### Wait FB 30s

- **ID:** `a0d0b945-877d-42a7-8fab-eca127e9c147`
- **Position:** [8336, 160]
- **Step:** Step 2: Company Enrichment
- **Amount:** 30
- **Unit:** 

### Wait IG 30s

- **ID:** `b37458e1-f239-4bdc-b8c9-5c7bdd0b4c67`
- **Position:** [8336, 560]
- **Step:** Step 2: Company Enrichment
- **Amount:** 30
- **Unit:** 

---

## 9. Manual Trigger (1 node)

### When clicking ‘Execute workflow’

- **ID:** `ade90cb9-8930-4ca0-bb13-64dd4785518d`
- **Position:** [-1184, -16]
- **typeVersion:** 1
- **Connects to:** Metro Config

---

## 10. Cross-Reference Table: `$('NodeName')` References

Every Code node that references another node via `$('NodeName')`, and which method it uses.

| Code Node | Referenced Node | Method | Step |
|-----------|-----------------|--------|------|
| Analyze Website HTML | Has Website? | `.item.json` | Step 2: Company Enrichment |
| Build SociaVault Request | Step 3b Config | `.first` | Step 3b: Social Enrichment |
| Collect Email Results | Merge Email Results | `.all` | Step 4: Enrich People |
| Collect Email Results | Skip Email - Pass Through | `.all` | Step 4: Enrich People |
| Collect Email Results | No Domain - Skip Email | `.all` | Step 4: Enrich People |
| Collect NamSor Results | Parse NamSor Response | `.all` | Step 4: Enrich People |
| Collect NamSor Results | Skip NamSor | `.all` | Step 4: Enrich People |
| Collect Updates | Update Contact in Supabase | `.all` | Step 4: Enrich People |
| Collect Updates | Has Updates? | `.all` | Step 4: Enrich People |
| Collect Verified Results | Parse Verifier Response | `.all` | Step 4: Enrich People |
| Collect Verified Results | Skip Verification | `.all` | Step 4: Enrich People |
| Extract & Patch Domain | Needs Backfill? | `.item.json` | Step 2: Company Enrichment |
| Extract FB Run ID | Prepare FB Search Input | `.first` | Step 2: Company Enrichment |
| Extract IG Run ID | Prepare IG Search Input | `.first` | Step 2: Company Enrichment |
| Filter & Merge Contacts | Fetch Contacts | `.all` | Step 4: Enrich People |
| Filter & Merge Contacts | Fetch Companies1 | `.all` | Step 4: Enrich People |
| Filter & Parse Batch | Fetch Companies | `.all` | Step 3a: Find People |
| Match FB Results to Companies | Extract FB Run ID | `.first` | Step 2: Company Enrichment |
| Match IG Results to Companies | Extract IG Run ID | `.first` | Step 2: Company Enrichment |
| Merge Website Results | Enrichment Config | `.first` | Step 2: Company Enrichment |
| Normalize Google Results | Metro Config | `.first` | Step 1: Discovery |
| Normalize Yelp Results | Metro Config | `.first` | Step 1: Discovery |
| Normalize Yelp Results | Split Search Queries | `.first` | Step 1: Discovery |
| Parse About Page | Solo Practitioner Check | `.item.json` | Step 3a: Find People |
| Parse Apollo Enrich | Parse Apollo Search | `.item.json` | Step 3a: Find People |
| Parse Apollo Search | Solo Practitioner Check | `.item.json` | Step 3a: Find People |
| Parse FB Status | Extract FB Run ID | `.first` | Step 2: Company Enrichment |
| Parse FB Status | Parse FB Status | `.first` | Step 2: Company Enrichment |
| Parse Google Details | Has Google Place ID? | `.item.json` | Step 2: Company Enrichment |
| Parse Hunter Response | Has Domain & Name? | `.item.json` | Step 4: Enrich People |
| Parse IG Status | Extract IG Run ID | `.first` | Step 2: Company Enrichment |
| Parse IG Status | Parse IG Status | `.first` | Step 2: Company Enrichment |
| Parse NamSor Response | Needs NamSor? | `.item.json` | Step 4: Enrich People |
| Parse Snov.io Response | Hunter Found Email? | `.item.json` | Step 4: Enrich People |
| Parse SociaVault Response | Should Enrich? | `.item.json` | Step 3b: Social Enrichment |
| Parse Status | Extract Run ID | `.first` | Step 1: Discovery |
| Parse Status | Parse Status | `.first` | Step 1: Discovery |
| Parse Verifier Response | Has Email to Verify? | `.item.json` | Step 4: Enrich People |
| Prepare Social Processing | Prepare Company Update | `.item.json` | Step 2: Company Enrichment |
| Prepare Social Processing | Enrichment Config | `.first` | Step 2: Company Enrichment |
| Run Summary | Deduplicate Records | `.all` | Step 1: Discovery |
| Run Summary | Metro Config | `.first` | Step 1: Discovery |
| Run Summary1 | Enrichment Config | `.first` | Step 2: Company Enrichment |
| Run Summary1 | Parse Batch | `.all` | Step 2: Company Enrichment |
| Run Summary1 | Analyze Website HTML | `.all` | Step 2: Company Enrichment |
| Run Summary1 | Match FB Results to Companies | `.first` | Step 2: Company Enrichment |
| Run Summary1 | Match IG Results to Companies | `.first` | Step 2: Company Enrichment |
| Run Summary2 | Step 3b Config | `.first` | Step 3b: Social Enrichment |
| Run Summary2 | Build SociaVault Request | `.all` | Step 3b: Social Enrichment |
| Run Summary2 | Parse SociaVault Response | `.all` | Step 3b: Social Enrichment |
| Run Summary3 | Step 3a Config | `.first` | Step 3a: Find People |
| Run Summary3 | Filter & Parse Batch | `.all` | Step 3a: Find People |
| Run Summary3 | Prepare Solo Contact | `.all` | Step 3a: Find People |
| Run Summary3 | Parse Apollo Search | `.all` | Step 3a: Find People |
| Run Summary3 | Parse Apollo Enrich | `.all` | Step 3a: Find People |
| Run Summary3 | Apollo Search Only Contact | `.all` | Step 3a: Find People |
| Run Summary3 | Parse About Page | `.all` | Step 3a: Find People |
| Run Summary3 | No Domain Fallback | `.all` | Step 3a: Find People |
| Run Summary4 | Step 4 Config | `.first` | Step 4: Enrich People |
| Run Summary4 | Prepare Contact Update | `.all` | Step 4: Enrich People |

### Dangerous Patterns at Convergence Points

The following references use `.item.json` (per-item pairing) and may be downstream of convergence points.
These are **potential batching bug locations** for Phase 2 analysis:

- **Extract & Patch Domain** references `$("Needs Backfill?").item.json` — VERIFY in Phase 2
- **Analyze Website HTML** references `$("Has Website?").item.json` — VERIFY in Phase 2
- **Parse Google Details** references `$("Has Google Place ID?").item.json` — VERIFY in Phase 2
- **Prepare Social Processing** references `$("Prepare Company Update").item.json` — VERIFY in Phase 2
- **Parse SociaVault Response** references `$("Should Enrich?").item.json` — VERIFY in Phase 2
- **Parse Apollo Search** references `$("Solo Practitioner Check").item.json` — VERIFY in Phase 2
- **Parse About Page** references `$("Solo Practitioner Check").item.json` — VERIFY in Phase 2
- **Parse Apollo Enrich** references `$("Parse Apollo Search").item.json` — VERIFY in Phase 2
- **Parse Hunter Response** references `$("Has Domain & Name?").item.json` — VERIFY in Phase 2
- **Parse Snov.io Response** references `$("Hunter Found Email?").item.json` — VERIFY in Phase 2
- **Parse Verifier Response** references `$("Has Email to Verify?").item.json` — VERIFY in Phase 2
- **Parse NamSor Response** references `$("Needs NamSor?").item.json` — VERIFY in Phase 2

---

## 11. Completeness Verification

- **Total nodes in JSON:** 151
- **Total nodes documented:** 151
- **Sum by type:** 5 Set + 32 IF + 36 HTTP + 72 Code + 2 Merge + 3 Wait + 1 Trigger = **151**
- **Match:** YES

### All Node Names (alphabetical)

- About Found Name?
- Analyze Website HTML
- Apollo Found People?
- Apollo People Enrich
- Apollo People Search
- Apollo Search Only Contact
- Batch Empty?
- Batch Empty?1
- Batch Empty?2
- Batch Empty?3
- Bridge to 3a
- Bridge to 3b
- Bridge to 4
- Build SociaVault Request
- Build Social Discovery Batch
- Call SociaVault API
- Check FB Run Status
- Check IG Run Status
- Check Run Status
- Collapse to Single
- Collect Email Results
- Collect NamSor Results
- Collect Updates
- Collect Verified Results
- Deduplicate Records
- Discovery Queries Exist?
- Enrich Enabled?
- Enrichment Config
- Extract & Patch Domain
- Extract FB Run ID
- Extract IG Run ID
- Extract Run ID
- FB Matches Found?
- FB Run Succeeded?
- Fetch About Page
- Fetch Apify Results
- Fetch Batch from Supabase
- Fetch Companies
- Fetch Companies1
- Fetch Contacts
- Fetch Existing Contacts
- Fetch FB Search Results
- Fetch IG Search Results
- Fetch Unenriched Social Profiles
- Fetch Website HTML
- Filter & Merge Contacts
- Filter & Parse Batch
- Fuzzy Match?
- Google Places - Text Search
- Google Places Details
- Google Places Lookup
- Has Domain & Apollo?
- Has Domain & Name?
- Has Email to Verify?
- Has Google Place ID?
- Has Social Links?
- Has Updates?
- Has Website?
- Hunter Email Finder
- Hunter Email Verifier
- Hunter Enabled?
- Hunter Found Email?
- Hunter Verifier Enabled?
- IG Matches Found?
- IG Run Succeeded?
- Insert Contact to Supabase
- Insert FB Social Profiles
- Insert Flagged (Needs Review)
- Insert IG Social Profiles
- Insert Social Profiles
- Insert to Supabase
- Is Solo?
- Match FB Results to Companies
- Match IG Results to Companies
- Merge All Sources
- Merge Backfill
- Merge Email Results
- Merge Website Results
- Metro Config
- NamSor Origin
- Needs Backfill?
- Needs Email?
- Needs NamSor?
- Needs Social Discovery?
- No Domain - Skip Email
- No Domain Fallback
- No Domain Found Name?
- No Records - Done
- No Records - Done1
- No Records - Done2
- No Records - Done3
- Normalize Google Results
- Normalize Yelp Results
- Parse About Page
- Parse Apollo Enrich
- Parse Apollo Search
- Parse Batch
- Parse Batch1
- Parse FB Status
- Parse Google Details
- Parse Hunter Response
- Parse IG Status
- Parse NamSor Response
- Parse Snov.io Response
- Parse SociaVault Response
- Parse Status
- Parse Verifier Response
- Prepare Company Update
- Prepare Contact Update
- Prepare FB Search Input
- Prepare IG Search Input
- Prepare Social Processing
- Prepare Social Profiles Insert
- Prepare Solo Contact
- Prepare for Supabase
- Run Succeeded?
- Run Summary
- Run Summary1
- Run Summary2
- Run Summary3
- Run Summary4
- Should Enrich?
- Skip - No Website
- Skip Email - Pass Through
- Skip Google Details
- Skip Hunter
- Skip NamSor
- Skip Snov.io
- Skip Verification
- Snov.io Email Finder
- Snov.io Enabled?
- Solo Practitioner Check
- Split Search Queries
- Start Apify Run
- Start FB Search Run
- Start IG Search Run
- Step 3a Config
- Step 3b Config
- Step 4 Config
- Update Company in Supabase
- Update Contact in Supabase
- Update Social Profile in Supabase
- Validate & Clean Contact
- Validate & Clean Contact1
- Validate & Clean Contact2
- Validate & Clean Contact3
- Validate & Clean Contact4
- Wait 30s
- Wait FB 30s
- Wait IG 30s
- When clicking ‘Execute workflow’
