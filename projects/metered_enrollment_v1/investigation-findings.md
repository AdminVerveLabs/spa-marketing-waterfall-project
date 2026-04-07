# Metered Enrollment System — Phase 1 Investigation Findings

**Date:** 2026-03-26
**Status:** Complete

---

## 1. Supabase Investigation

### 1.1 Contacts Table Schema (23 columns)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| company_id | uuid | FK to companies |
| first_name, last_name | text | |
| role | text | Default 'unknown' |
| is_owner | boolean | Default false |
| email_business, email_personal | text | |
| phone_direct | text | |
| linkedin_url | text | |
| location | text | |
| cultural_affinity | text | NamSor origin |
| source | text | apollo, solo_detection, website, hunter, etc. |
| email_status | text | Default 'unverified' |
| email_verified_at | timestamptz | |
| phone_status, phone_line_type, phone_carrier | text | Telnyx verification |
| phone_verified_at | timestamptz | |
| **apollo_contact_id** | text | Apollo CRM record ID |
| **apollo_synced_at** | timestamptz | When synced to Apollo |
| created_at, updated_at | timestamptz | |

### 1.2 Apollo-Related Fields

- `apollo_contact_id` — exists, populated for 4,438 contacts
- `apollo_synced_at` — exists, populated for 4,438 contacts
- `sequence_enrolled_at` — **DOES NOT EXIST** (needs to be added)
- `enrollment_batch` — **DOES NOT EXIST** (needs to be added)

### 1.3 Contact Counts

| Metric | Count |
|--------|-------|
| Total contacts | 5,162 |
| Has apollo_contact_id | 4,438 (86%) |
| No apollo_contact_id | 724 (14%) |
| Synced to Apollo | 4,438 |

### 1.4 Enrollment Eligibility (contacts with apollo_contact_id)

| Metric | Count |
|--------|-------|
| Total eligible | 4,438 |
| At mobile practice companies | 14 |
| At language barrier companies | 45 |
| High-value (company lead_score >= 30) | 70 |
| Clean (no quality flags) | 4,379 |
| Avg company lead_score | 8.6 |

### 1.5 Contact Source Distribution (synced to Apollo)

| Source | Count |
|--------|-------|
| Apollo (People Search) | 2,743 |
| Solo Detection | 1,137 |
| Website Scraping | 355 |
| Hunter | 120 |
| Manual | 52 |
| Google Reviews | 31 |

### 1.6 Quality Flag Impact on Enrollment

The metered enrollment query (`ORDER BY lead_score DESC`) will naturally deprioritize flagged companies:
- Mobile practice: lead_score penalty of -20 → pushed to bottom of queue
- Language barrier: lead_score penalty of -20 → pushed to bottom of queue
- Franchise contacts: 0 remaining (companies deleted by chain_blocklist)

**Recommendation:** No explicit exclusion filter needed for enrollment — the lead_score ordering already handles prioritization. All contacts remain enrollable but high-quality ones go first.

---

## 2. n8n Workflow Investigation

### 2.1 Existing Workflows (16 total)

| Workflow | ID | Active | Relevant |
|----------|----|--------|----------|
| Main Pipeline | yxvQst30sWlNIeZq | Yes | Discovery + enrichment |
| Sub-Workflow | fGm4IP0rWxgHptN8 | Yes | Batch enrichment |
| **Apollo Sync v1** | g9uplPwBAaaVgm4X | **Yes** | Current sync — pushes companies+contacts to Apollo |
| Queue Wrapper | 7Ix8ajJ5Rp9NyYk8 | Yes | Queue processing |
| Report Generator | SL9RrJBYnZjJ8LI6 | Yes | Excel reports |
| Error handlers | various | Yes | Error recovery |

### 2.2 Apollo Sync v1 — Key Patterns to Copy

**Authentication:**
```
Headers:
  Content-Type: application/json
  Cache-Control: no-cache
  x-api-key: {apollo_api_key from $env.APOLLO_API_KEY}
```

**Supabase Connection:**
```
Headers:
  apikey: {$env.SUPABASE_SERVICE_KEY}
  Authorization: Bearer {$env.SUPABASE_SERVICE_KEY}
  Content-Type: application/json
```

**Rate Limiting:** 700ms delay between Apollo API calls

**Batch Processing:** Split In Batches, batch size 25

**Error Handling:** try/catch per item, log errors, continue processing

**Environment Variables Already Available:**
- `APOLLO_API_KEY` — already set in n8n
- `SUPABASE_URL` — already set
- `SUPABASE_SERVICE_KEY` — already set

**Environment Variables NEEDED (new):**
- `APOLLO_NET_NEW_SEQUENCE_ID` — after creating sequence in Apollo
- `APOLLO_FOLLOWUP_SEQUENCE_ID` — after creating sequence
- `APOLLO_CALLBACK_SEQUENCE_ID` — after creating sequence
- `APOLLO_ACTIVE_STAGE_ID` — after creating stage

### 2.3 Apollo Sync v1 — Current Flow

1. Schedule Trigger (every 15 min)
2. Setup Custom Fields (idempotent)
3. Fetch Unsynced: `WHERE enrichment_status = 'fully_enriched' AND apollo_synced_at IS NULL LIMIT 30`
4. Upsert Account (search by domain → create/update)
5. Upsert Contacts (per company → create/update with run_dedupe)
6. Assign to Prospect List (1000-cap rotation)
7. Mark Synced (PATCH apollo_account_id + apollo_synced_at)

**Key gap:** Apollo Sync currently has NO quality filters. It syncs ALL fully_enriched companies including mobile practices and language barrier companies. The metered enrollment system should filter at the enrollment stage, not the sync stage.

---

## 3. Apollo Configuration Investigation

### 3.1 API Calls Needed (cannot run from CLI)

The following need to be checked in Apollo UI or via API calls:

- `GET /api/v1/emailer_campaigns/search` — List existing sequences
- `GET /api/v1/contact_stages` — List existing contact stages
- `GET /api/v1/typed_custom_fields` — List existing custom fields (we know 21 exist from Apollo Sync)

**Action needed:** Zack to check in Apollo UI or provide API access:
- Are there any existing sequences?
- Are there any existing contact stages?
- Any existing Plays configured?

### 3.2 Known Custom Fields (from Apollo Sync v1)

**Account fields (13):** Lead Score, Has Website, Has Online Booking, Booking Platform, Has Paid Ads, On Groupon, On Yelp, Google Review Count, Google Rating, Estimated Size, Enrichment Status, Category, VerveLabs Run Tag

**Contact fields (8):** Cultural Affinity, Is Owner, Meridian Role, Contact Source, Email Personal, Email Status, Phone Status, VerveLabs Run Tag

**New fields needed for metered enrollment:** None — the enrollment system uses Apollo's built-in sequence/stage features, not custom fields.

---

## 4. Key Findings & Recommendations

### 4.1 Enrollment Pool
- 4,438 contacts have `apollo_contact_id` and are eligible for enrollment
- With a cap of 500 active, this is ~9 days of enrollment at full capacity
- Lead score ordering will naturally prioritize best leads first

### 4.2 Relationship to Apollo Sync
The metered enrollment workflow is **separate from** the Apollo Sync workflow:
- **Apollo Sync** creates Account + Contact records in Apollo (runs every 15 min)
- **Metered Enrollment** adds existing Apollo contacts to call sequences (runs daily at 6am)
- Both can run independently — enrollment only works with contacts that have `apollo_contact_id`

### 4.3 Schema Changes Required
Minimal — just 2 new columns + 2 indexes on contacts table:
- `sequence_enrolled_at TIMESTAMPTZ`
- `enrollment_batch TEXT`

### 4.4 Apollo Manual Setup Required
Before the n8n workflow can work, these must be created in Apollo UI:
- 6 Contact Stages (New, Active, Callback, Meeting Booked, Disqualified, Exhausted)
- 3 Sequences (Net New, Follow-up, Callback)
- 7 Plays (state transition automations)

---

## 5. Questions Before Proceeding

1. Are there any existing sequences/stages/plays in Apollo already? (Need to check UI)
2. Should the optional webhook logging (Play 7 + call_activity table) be implemented?
3. Should mobile practice and language barrier contacts be enrollable at all, or excluded entirely?
4. Is the APOLLO_API_KEY env var already set in n8n/Coolify?
