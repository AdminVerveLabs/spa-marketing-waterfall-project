  
**Spa Marketing Waterfall**

Enrichment System Architecture

VerveLabs

February 2026

v1.0 — Architecture Reference

# **1\. Executive Summary**

This document defines the architecture for an automated lead discovery and enrichment system targeting massage therapy clinics across select US metro areas. The system discovers businesses from multiple online sources, deduplicates and enriches them with company and contact-level data, scores them for outreach prioritization, and syncs results to a canonical Supabase database.

**Target market:** Massage therapy clinics, spas, and solo RMT practitioners

**Initial scope:** 5–8 US metro areas (\~8,000–12,000 businesses)

**Budget:** $300–400 for initial enrichment run; \~$200–400/month for ongoing monitoring

**Infrastructure:** Hetzner VPS \+ Coolify \+ self-hosted n8n \+ Supabase (cloud)

**Output:** Supabase as canonical store, with sync capability to Apollo/CRM

# **2\. Infrastructure Topology**

## **2.1 Components**

| Component | Service | Details |
| :---- | :---- | :---- |
| VPS | Hetzner CX22 | 2 vCPU, 4GB RAM, Ashburn VA datacenter. \~€4/month. |
| Deployment | Coolify | Handles n8n deployment, SSL certs, updates. Self-hosted on the Hetzner VPS. |
| Orchestration | n8n (self-hosted) | Workflow engine. Stateless — all data lives in Supabase, n8n handles orchestration only. |
| Database | Supabase (cloud) | Canonical data store. Free tier supports up to 500MB and 50k rows. Upgrade when needed. |
| APIs | Multiple | Google Places, Yelp Fusion, Apify (Groupon), NamSor (cultural inference). Details in Section 5\. |

## **2.2 Data Flow Overview**

The system follows a unidirectional data flow pattern. n8n orchestrates all API calls and processing logic. Every discovered and enriched record is written to Supabase as the single source of truth. Downstream consumers (Apollo, CRM, dashboard) read from or sync with Supabase.

Discovery APIs → n8n (orchestration) → Supabase (canonical store) → Apollo / CRM / Dashboard

The Hetzner VPS in Ashburn, VA is chosen specifically for low latency to US-based API endpoints (Google, Yelp, etc.). n8n uses its built-in SQLite for workflow state only — no business data is stored on the VPS.

# **3\. Supabase Schema**

The database uses four core tables with a relational model. Companies are the primary entity; contacts and social profiles link to companies. Scoring rules live in a separate config table.

## **3.1 companies**

The canonical business record. Every discovered massage clinic becomes one row here.

| Column | Type | Notes |
| :---- | :---- | :---- |
| id | uuid (PK) | Auto-generated |
| name | text | Business name (canonical, cleaned) |
| phone | text | E.164 format. Primary dedup key. |
| domain | text | Website domain (nullable). Secondary dedup key. |
| address | text | Full street address |
| city | text | City name |
| state | text | State/province code |
| country | text | US or CA |
| google\_place\_id | text | Stable Google Maps identifier. Key for net-new detection. |
| category | text | Type of therapy/business (massage, RMT, spa, wellness, etc.) |
| has\_website | boolean | Does the business have a live website? |
| has\_online\_booking | boolean | Detected booking system (Jane App, Acuity, MindBody, Square, etc.) |
| booking\_platform | text | Name of detected booking platform (nullable) |
| has\_paid\_ads | boolean | Evidence of Google Ads or other paid advertising |
| on\_groupon | boolean | Listed on Groupon |
| on\_yelp | boolean | Listed on Yelp |
| google\_review\_count | integer | Number of Google reviews (proxy for business size/volume) |
| google\_rating | decimal | Google Maps star rating |
| estimated\_size | text | solo / small (2–5) / medium (6+). Inferred from listings \+ website. |
| source\_urls | jsonb | Array of {source, url} objects tracking where this business was found |
| enrichment\_status | text | discovered | partially\_enriched | fully\_enriched |
| lead\_score | integer | Computed score from scoring\_rules. Updated on enrichment or rule change. |
| discovered\_at | timestamptz | When first discovered |
| enriched\_at | timestamptz | Last enrichment timestamp |
| created\_at | timestamptz | Row creation timestamp |

## **3.2 contacts**

People associated with a company. For solo practitioners, there may be one contact who IS the business owner.

| Column | Type | Notes |
| :---- | :---- | :---- |
| id | uuid (PK) | Auto-generated |
| company\_id | uuid (FK) | References companies.id |
| first\_name | text | First name |
| last\_name | text | Last name |
| role | text | owner / practitioner / manager / unknown |
| is\_owner | boolean | Identified as the business owner |
| email\_business | text | Business/work email |
| email\_personal | text | Personal email (nullable) |
| phone\_direct | text | Direct phone number (nullable) |
| linkedin\_url | text | Personal LinkedIn profile URL |
| location | text | Person's location if different from company |
| cultural\_affinity | text | Inferred via NamSor API from name. Soft signal for messaging. |
| source | text | apollo / website / google / manual |
| created\_at | timestamptz | Row creation timestamp |

## **3.3 social\_profiles**

Social media presence for a company. One row per platform per company.

| Column | Type | Notes |
| :---- | :---- | :---- |
| id | uuid (PK) | Auto-generated |
| company\_id | uuid (FK) | References companies.id |
| platform | text | facebook / instagram / tiktok / x |
| profile\_url | text | Full URL to profile |
| follower\_count | integer | Number of followers at time of scrape |
| post\_count | integer | Total number of posts |
| last\_post\_date | date | Date of most recent post. Key activity signal. |
| scraped\_at | timestamptz | When this data was last collected |

## **3.4 scoring\_rules**

Configurable scoring rules. Non-technical users can edit this table directly in Supabase Table Editor to tune lead prioritization without modifying any workflow logic.

| Column | Type | Notes |
| :---- | :---- | :---- |
| id | uuid (PK) | Auto-generated |
| field\_name | text | Column in companies table (e.g. on\_groupon, estimated\_size) |
| condition | text | Condition to match: equals / not\_equals / greater\_than / less\_than |
| value | text | Value to compare against (e.g. true, solo, 0\) |
| points | integer | Points to add (positive) or subtract (negative) when condition matches |
| label | text | Human-readable description (e.g. 'On Groupon \= price-sensitive') |
| active | boolean | Toggle rules on/off without deleting |

**Example Scoring Rules (starter set)**

| Field | Condition | Value | Points | Rationale |
| :---- | :---- | :---- | :---- | :---- |
| on\_groupon | equals | true | \+15 | Price-sensitive, actively seeking clients |
| has\_website | equals | false | \+10 | Needs digital help |
| has\_online\_booking | equals | false | \+10 | Missing key conversion tool |
| estimated\_size | equals | solo | \+20 | Sweet spot for your service |
| has\_paid\_ads | equals | true | \+5 | Already spending on marketing |
| google\_review\_count | less\_than | 20 | \+5 | Low visibility, room to grow |

## **3.5 Deduplication Logic**

Deduplication runs at the point of insertion into the companies table. The logic is implemented as a Supabase database function (or within the n8n workflow before the Supabase write node) and follows a cascading match strategy:

**Match 1 — Phone (exact):** Normalize incoming phone to E.164 format. If an exact match exists in companies.phone, merge the new data into the existing record. This is the highest-confidence match.

**Match 2 — Domain (exact):** If no phone match, check companies.domain for an exact domain match. If found, merge into the existing record.

**Match 3 — Fuzzy name \+ city (review):** If neither phone nor domain matches, run a fuzzy string comparison (trigram similarity \>= 0.85) on business name within the same city. If a match is found, flag the record for manual review rather than auto-merging. This prevents false merges of different businesses with similar names in the same area.

**No match:** Create a new company record with enrichment\_status \= 'discovered'.

# **4\. Workflow Architecture**

The enrichment pipeline is implemented as a series of modular n8n workflows. Each step is a separate workflow (or sub-workflow) that can be triggered independently, retried on failure, and modified without affecting other steps. The workflows communicate via Supabase — each step reads from and writes back to the canonical tables.

## **4.1 Step 1: Discover Companies**

Goal: Enumerate all massage therapy clinics in target metro areas from multiple sources. Capture minimum viable record (name, phone, address) plus source metadata.

**Sources (in priority order)**

* **Google Places API:** Primary discovery source. Search for 'massage therapy', 'massage clinic', 'RMT', 'spa' within target metro radius. Captures: name, phone, address, domain, Google Place ID, review count, rating, category, photos.

* **Yelp Fusion API:** Secondary discovery. Cross-references Google results and catches businesses not on Google Maps. Captures: name, phone, address, Yelp URL, category, review count.

* **Groupon Scraper (Apify):** Targeted scrape for businesses running Groupon deals. Every result here is automatically a buying signal. Captures: name, address, Groupon URL, deal details.

* **Apollo API:** Search for companies categorized under massage/spa/wellness. Coverage will be partial (\~30–40% of market) but provides richer company data where available.

**Process**

* For each target metro, run all four sources in parallel (n8n Split In Batches \+ parallel execution)

* Normalize all results to a common schema: name, phone (E.164), address, city, state, country, domain, google\_place\_id, source\_urls

* Run deduplication logic (Section 3.5) before writing to Supabase

* Write new companies to Supabase with enrichment\_status \= 'discovered'

* Log discovery run metadata: timestamp, metro, source, records found, new vs. existing

**n8n Implementation Notes**

* Use HTTP Request nodes for Google Places and Yelp APIs

* Use Apify webhook trigger or HTTP node for Groupon scraper

* Phone normalization: use a Code node with a lightweight E.164 formatter (strip non-digits, prepend \+1 for US/CA)

* Rate limiting: Google Places allows 100 QPS; Yelp Fusion allows 5,000/day. Build in wait nodes for Yelp if running large metros.

## **4.2 Step 2: Enrich Companies**

Goal: For each discovered company, gather detailed signals that inform scoring and outreach. Split into sub-steps by data source to allow independent execution and error tolerance.

**Step 2a: Website Analysis (requires domain)**

Skip this sub-step entirely if has\_website \= false or domain is null. No wasted API calls.

* Fetch the homepage (n8n HTTP Request, follow redirects)

* Detect online booking system: scan HTML for known booking platform signatures (jane.app, acuityscheduling.com, mindbodyonline.com, square.site, vagaro.com)

* Detect landing pages: check for distinct landing page patterns or marketing-specific pages

* Detect social links: extract Facebook, Instagram, TikTok, X URLs from page HTML

* Detect paid ads indicators: Google Ads conversion tracking scripts, Meta Pixel, etc.

* Determine estimated size: count practitioners listed on team/staff pages

**Step 2b: Listing Enrichment (from source URLs)**

Uses the source\_urls captured in Step 1 to enrich from the original listing data.

* Google Places Details API: fetch full details using stored google\_place\_id — operating hours, additional categories, photo count

* Yelp listing: re-scrape if needed for category details, price range indicator

* Groupon: extract deal pricing, category, and whether the deal is currently active

**Step 2c: Social Discovery**

If social URLs were not found in Step 2a (no website or no links found), attempt to discover them independently.

* Search Facebook, Instagram for business name \+ city

* Store discovered URLs for processing in Step 3b

**After all sub-steps complete**

* Write enriched fields back to companies table

* Update enrichment\_status to 'partially\_enriched' or 'fully\_enriched' based on completeness

* Update enriched\_at timestamp

## **4.3 Step 3a: Find People**

Goal: Identify the owner/key contact for each company. Runs in parallel with Step 3b.

**Solo Practitioner Detection (pre-check)**

Before making any API calls, check if this is a solo practitioner. Signals: estimated\_size \= 'solo', or business name matches owner name pattern (e.g., "Jane Smith Massage Therapy"). If detected as solo, the owner IS the business — extract the name from the business listing and skip to creating the contact record. Do not waste Apollo credits searching for a person you already know.

**Waterfall Search (if not solo)**

* **Apollo People Search:** Search by company domain or company name. Best for businesses with some web presence.

* **Website Scrape:** Check /about, /team, /staff pages for owner/practitioner names.

* **Google Search:** "\[business name\] \[city\] owner" or "\[business name\] \[city\] massage therapist" as a fallback.

**For each person found**

* Create a record in the contacts table, linked to company\_id

* Set is\_owner \= true if identified as owner, role \= inferred role

* Capture: name, email (if found), phone (if found), LinkedIn URL, source

## **4.4 Step 3b: Enrich Socials**

Goal: For each company social profile discovered in Step 2, collect engagement metrics. Runs in parallel with Step 3a.

* For each social URL found (Facebook, Instagram, TikTok, X):

  * Scrape or API-fetch: follower count, post count, last post date, profile bio

  * Write to social\_profiles table linked to company\_id

* Key signal: last\_post\_date. A profile dormant for 6+ months indicates low digital engagement — which could be either a positive signal (they need help) or negative (they're disengaged). Track it and let scoring rules decide.

**Implementation Notes**

* Facebook Pages API is restrictive — may need Apify actor for public page data

* Instagram: use Apify Instagram Profile Scraper (\~$0.50 per 1,000 profiles)

* TikTok: Apify actor available, low priority unless you see high adoption in this market

* X/Twitter: lowest priority for massage clinics. Only scrape if URL was found on their website.

## **4.5 Step 4: Enrich People**

Goal: Enrich each contact record with direct contact info and cultural affinity for outreach personalization.

* **Email enrichment:** Apollo (if they have a record), Hunter.io, or Snov.io as fallback waterfall.

* **Phone enrichment:** If direct phone not found, business phone from company record serves as fallback.

* **LinkedIn:** Apollo often returns this. If not, search LinkedIn by name \+ company.

* **Cultural affinity:** Run first\_name \+ last\_name through NamSor API. Store result as cultural\_affinity on the contact record. \~$0.01 per lookup.

**After enrichment**

* Update contact record in Supabase with all enriched fields

## **4.6 Step 5: Score & Prioritize**

Goal: Calculate a lead\_score for each company based on configurable scoring rules. This step is decoupled from the enrichment pipeline and can be re-run independently whenever scoring rules change.

**Implementation**

Option A (recommended): Supabase database function that reads scoring\_rules, iterates through conditions, and sums points for each company. Triggered after enrichment completes or when a rule is added/modified.

Option B: n8n workflow that fetches all scoring\_rules, loops through companies, and calculates scores. Simpler to build initially but slower for large datasets.

Either way, the result is an integer lead\_score written to companies.lead\_score. Higher score \= higher outreach priority.

**Scoring run triggers**

* After any company completes enrichment (Steps 2–4)

* After any scoring\_rules record is created, updated, or toggled

* On-demand via manual trigger (n8n webhook or button in Supabase)

## **4.7 Step 6: Sync & Output**

Goal: Make enriched, scored data available for outreach. Supabase is the canonical store; all other destinations are sync targets.

**Tier 1 (immediate)**

* **Supabase Table Editor:** Your non-technical employee can log in, filter by lead\_score, estimated\_size, city, enrichment\_status, etc. No frontend needed. They can sort by score and work top-down.

* **CSV Export:** Supabase supports direct CSV export from any filtered view. Good enough for importing into any tool.

**Tier 2 (when needed)**

* **Apollo Sync:** n8n workflow that pushes enriched companies \+ contacts to Apollo via their API, mapping to custom fields. Trigger: on new fully\_enriched records, or on-demand batch sync.

* **CRM Sync:** Same pattern — swap the Apollo API node for HubSpot/Salesforce/etc. The Supabase schema makes this a straightforward field mapping exercise.

* **Custom Dashboard:** A React app on top of Supabase with auth. Only build this if the Table Editor proves insufficient after real usage. Estimated effort: 4–8 hours, not 1 hour.

# **5\. Net-New Detection**

After the initial market snapshot, a scheduled workflow monitors for new businesses entering the market. This catches new clinic openings, businesses that newly appear on Google/Yelp, and existing businesses that were previously missed.

## **5.1 Schedule**

* **Frequency:** Weekly (every Monday at 6am UTC). Adjustable in n8n Cron node.

* **Scope:** Re-runs Step 1 (discovery) for all previously targeted metros.

* **Behavior:** The dedup logic in Section 3.5 handles the diff automatically. Existing businesses match on phone/domain and get their source\_urls updated. Genuinely new businesses create new records with enrichment\_status \= 'discovered'.

## **5.2 New Record Pipeline**

* New records (enrichment\_status \= 'discovered' with discovered\_at within last 7 days) are automatically queued for enrichment Steps 2–5

* A separate n8n workflow (or a filter in the main enrichment workflow) picks up only these new records

* New records get a 'net\_new' tag so they're easily filterable in the output layer

* Optional: send a weekly Slack or email summary of new businesses discovered

## **5.3 Re-Enrichment**

Existing businesses may change over time (new website, new Groupon listing, ownership change). A monthly re-enrichment pass updates companies that haven't been enriched in 30+ days. This is a lower priority and can be implemented after the core pipeline is proven.

# **6\. Cost Estimates**

## **6.1 Initial Market Snapshot (5–8 metros)**

| Service | Est. Volume | Unit Cost | Est. Total |
| :---- | :---- | :---- | :---- |
| Google Places API | 10,000 calls | $17/1,000 | $170 |
| Yelp Fusion API | 8,000 calls | Free tier | $0 |
| Apify — Groupon Scraper | \~5,000 results | \~$10/1,000 | $50 |
| Apify — Social Scraping | \~5,000 profiles | \~$0.50/1,000 | $3 |
| NamSor (cultural inference) | \~5,000 names | $0.01/name | $50 |
| Email enrichment (Hunter/Snov) | \~5,000 lookups | \~$0.01/lookup | $50 |
| Apollo (existing plan) | Included | Existing | $0 |
| **TOTAL** |  |  | **$323** |

## **6.2 Monthly Ongoing Costs**

| Item | Est. Cost/Month |
| :---- | :---- |
| Hetzner CX22 VPS | \~$5 |
| Supabase (free tier initially) | $0–$25 |
| Net-new detection (weekly discovery re-runs) | $30–60 |
| Re-enrichment of stale records (monthly) | $20–40 |
| NamSor \+ email enrichment (new contacts) | $10–20 |
| **TOTAL** | **$65–$150** |

# **7\. Implementation Roadmap**

## **Phase 1: Infrastructure \+ Discovery (Days 1–3)**

* Provision Hetzner CX22 (Ashburn, VA)

* Deploy Coolify and n8n

* Set up Supabase project with schema from Section 3

* Build Step 1 workflow: Google Places API for one test metro

* Validate dedup logic with test data

* Add Yelp and Groupon sources to Step 1

## **Phase 2: Company Enrichment (Days 4–6)**

* Build Step 2a: website analysis sub-workflow

* Build Step 2b: listing enrichment sub-workflow

* Build Step 2c: social discovery sub-workflow

* Test with \~100 records from Phase 1 output

* Verify data quality in Supabase

## **Phase 3: People \+ Scoring (Days 7–9)**

* Build Step 3a: find people workflow (with solo practitioner detection)

* Build Step 3b: social enrichment workflow

* Build Step 4: people enrichment (email, NamSor, LinkedIn)

* Build Step 5: scoring function (Supabase function or n8n workflow)

* Populate scoring\_rules table with starter rules

## **Phase 4: Output \+ Net-New (Days 10–12)**

* Configure Supabase views and access for non-technical user

* Build Step 6: Apollo sync workflow (if needed)

* Build net-new detection cron workflow

* Run initial full snapshot across all target metros

* Validate end-to-end pipeline with real outreach

## **Phase 5: Optimize (Ongoing)**

* Tune scoring rules based on outreach response rates

* Add/remove discovery sources based on coverage gaps

* Scale to additional metros / Canada

* Build custom dashboard if Supabase Table Editor proves insufficient

# **8\. Key Decisions Log**

Decisions made during architecture planning, preserved for future reference.

| Decision | Choice | Rationale |
| :---- | :---- | :---- |
| Canonical data store | Supabase | Owns the data. Flexible for custom fields, scoring, and multi-destination sync. |
| Primary dedup key | Phone (E.164) | Most stable identifier for small businesses across platforms. |
| Initial scope | 5–8 US metros | Budget-efficient. Prove the system, then scale. |
| Scoring location | Decoupled from enrichment | Rules can be tuned by non-technical staff without touching workflows. |
| Hosting | Hetzner \+ Coolify | Cost-effective. n8n stays stateless; all data in Supabase. |
| Ethnicity/culture signal | NamSor API (name-based) | Cheaper and simpler than image analysis. Stored as 'cultural\_affinity'. |
| Dashboard | Supabase Table Editor (Tier 1\) | Zero frontend code. Upgrade to React dashboard only if needed. |

