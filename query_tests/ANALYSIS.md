# Supabase Data Inspection — Analysis

**Date:** 2026-02-18 (Session 9)
**Scope:** All data in companies and contacts tables after 11 pipeline executions

---

## Query 1: Companies Overview (97 total)

### Summary

| Metric | Count | % |
|--------|-------|---|
| Total companies | 97 | — |
| Has phone | 93 | 96% |
| Has domain | 84 | 87% |
| Has website | 86 | 89% |

### Geographic Distribution
- **Majority:** Austin, TX area (including New Braunfels, Waco, San Antonio)
- **Canadian:** Surrey BC, Mississauga ON, Windsor ON — discovered via "RMT" keyword overlap
- **UK:** RMT Trade Union (+442073874771) — false positive from search

### Enrichment Status
- Most companies are `partially_enriched` — have basic data from Google/Yelp but haven't been fully enriched
- A few are `discovered` only (e.g., AUSTINDEEP has no domain)
- Google ratings mostly 4.5-5.0 — high quality businesses

### Data Quality Issues Found

**Booking platform domains (BUG-003 confirmed, 7 instances):**

| Company | Domain Stored | Platform |
|---------|--------------|----------|
| Calm Spa | `calmspa.wixsite.com` | Wix |
| Massage Envy | `locations.massageenvy.com` | Franchise subdomain |
| Oasis Spa - Austin | `nonamecs4b.setmore.com` | Setmore |
| Riverstone Massage Therapy | `riverstonemassagetherapy.schedulista.com` | Schedulista |
| Moonlight Head Spa | `moonlightheadspa.glossgenius.com` | GlossGenius |
| Supreme Massage Spa | `supreme-massage-spa.square.site` | Square |
| Susanna Reffner LMT | `escape-massage-and-spa.genbook.com` | Genbook |

These break Hunter Finder email lookup since they're not real company domains. Need domain validation in Step 2.

**Companies with no domain (13):** Including AUSTINDEEP, Colleen Basler, Creek Spa, Dana Strickland, Harris Gayla, Heavenly Touch, inTouch with Nadine, Kathy Massage, Sandy Jones. Most are small solo practitioners without websites.

**Non-target businesses (5):**

| Company | Issue |
|---------|-------|
| RMT Trade Union | UK trade union, not a massage business |
| Registered Massage Therapists' Association of Ontario | Professional association |
| The College of Massage Therapists of Ontario (CMTO) | Regulatory body |
| Academy For Massage Therapy Training | School, not spa |
| The Lauterstein-Conway Massage School & Clinic | School/clinic |

These were found via "massage therapy" or "RMT" search terms. Need business-type filtering.

**Hotel/chain spas (6):** Fairmont, Four Seasons, Hotel ZaZa, Marriott/JW, Proper Hotel, Massage Envy — may not be ideal small-business targets depending on marketing strategy.

---

## Query 2: All Contacts (58 total)

### Source Breakdown

| Source | Count | Has Name | Has Email | Has Cultural Affinity |
|--------|-------|----------|-----------|----------------------|
| apollo | 36 | 36 (100%) | 20 (56%) | 30 (83%) |
| solo_detection | 22 | 7 (32%) | 0 (0%) | 3 (14%) |
| **Total** | **58** | **43 (74%)** | **20 (34%)** | **33 (57%)** |

### Key Observations

**Apollo contacts are much richer:** All 36 have at least first names, most have full names, 20 have emails, 30 have NamSor cultural affinity set.

**Solo detection contacts are sparse:** Only 7 of 22 have first names (extracted from company name like "Massage By Kristen" → "Kristen"). None have emails. None have last names. Most are just the company phone copied to phone_direct.

### Email-Domain Mismatches (NEW ISSUE)

| Contact | Email | Company Domain | Problem |
|---------|-------|----------------|---------|
| Laura Candelaria | `laura.candelaria@g.austincc.edu` | `austindeep.com` | College email, not business |
| Felix | `felix@schedulista.com` | `riverstonemassagetherapy.schedulista.com` | Scheduling platform email |
| David Lauterstein | `davidl@tlcschool.com` | `tlcmassageschool.com` | Close but different domain |
| Kerry Coyle | `kerrycoyle@thetox.com` | `thetoxtechnique.com` | Different brand domain |

Laura Candelaria's email is a community college address — likely not a valid business contact. Felix's email is from the scheduling platform. These represent data quality issues from Apollo's data.

### Phone Number Issue

David Lauterstein has phone `+1512374922214` (14 digits) — too long for a North American number. Likely a data entry error from Apollo.

### Contacts Without Last Names (8 Apollo + 15 solo_detection = 23 total)

NamSor requires first+last name for cultural affinity classification. Hunter Finder requires first+last name for email lookup. These 23 contacts are stuck at their current enrichment level unless names can be sourced elsewhere.

---

## Query 3: Data Quality Summary

**Note:** The SQL query used generic column aliases. Actual mappings for contacts:

| Column in JSON | Companies Meaning | Contacts Meaning |
|----------------|-------------------|------------------|
| `has_phone` | has phone (93) | has email (20) |
| `has_domain` | has domain (84) | has phone (58) |
| `has_website` | has website (86) | has name (43) |

### Corrected Summary

| Table | Total | Metric 1 | Metric 2 | Metric 3 |
|-------|-------|----------|----------|----------|
| Companies | 97 | Phone: 93 (96%) | Domain: 84 (87%) | Website: 86 (89%) |
| Contacts | 58 | Email: 20 (34%) | Phone: 58 (100%) | Name: 43 (74%) |

### Gaps
- **13 companies** missing domain — Hunter Finder can't find emails without domain
- **38 contacts** missing email — primary enrichment target
- **15 contacts** missing name — can't use NamSor or Hunter Finder

---

## Query 4: Email Status Breakdown

| Status | Count | Has Email | Has Name | Interpretation |
|--------|-------|-----------|----------|----------------|
| NULL | 28 | 0 | 14 | Never processed by Hunter (solo_detection or recent Apollo without emails) |
| verified | 15 | 15 | 15 | **Actionable leads** — email confirmed deliverable |
| unverified | 6 | 0 | 5 | No email to verify (DEFAULT value from Supabase) |
| accept_all | 4 | 4 | 4 | Server accepts all addresses — email probably works but unconfirmed |
| invalid | 4 | 0 | 4 | Apollo found email → Hunter Verifier rejected → email cleared |
| risky | 1 | 1 | 1 | David Lauterstein — low confidence email |

### Email Funnel

```
58 total contacts
 └─ 20 have email (34%)
     └─ 15 verified (75% of emails)     ← ACTIONABLE
     └─ 4 accept_all (20%)              ← PROBABLY GOOD
     └─ 1 risky (5%)                    ← LOW CONFIDENCE
 └─ 38 no email (66%)
     └─ 28 NULL status (never checked)
     └─ 6 unverified (no email to check)
     └─ 4 invalid (email was removed)
```

### Lead Quality Assessment
- **15 verified emails** — ready for outreach
- **4 accept_all** — can attempt outreach (Massage Envy, Zen Deep, NOW Massage, Marriott)
- **1 risky** — David Lauterstein with mismatched domain, skip
- **38 no email** — need Hunter Finder (requires name + domain) or Snov.io

---

## Query 5: Duplicate Check

**Result: 0 duplicates found** by (company_id, first_name, last_name, source).

The `$getWorkflowStaticData('global')` dedup fix (ADR-008) is working correctly. Multiple pipeline executions have not created duplicate contacts.

---

## Actionable Recommendations

### Immediate (no code changes)
1. **15 verified + 4 accept_all = 19 contacts ready for outreach** as-is
2. Enable Snov.io when available — can find emails for the 15 named contacts without emails

### Short-term (workflow changes)
3. **NEW ISSUE — Domain validation:** Add booking platform domain detection (wixsite.com, setmore.com, schedulista.com, glossgenius.com, square.site, genbook.com) to prevent Hunter Finder from wasting credits on invalid domains
4. **NEW ISSUE — Email-domain mismatch detection:** Flag contacts where email domain doesn't match company domain
5. **NEW ISSUE — Phone length validation:** Reject phone numbers > 12 digits
6. **NEW ISSUE — Business type filtering:** Consider excluding schools, associations, regulatory bodies, and hotel chains from outreach

### Medium-term (scaling)
7. Fix BUG-002 (contact deduplication) before adding new metros
8. Improve solo_detection name extraction — currently only extracts from company name patterns, misses most cases
9. Add new metro areas to increase lead volume (currently Austin-centric)
