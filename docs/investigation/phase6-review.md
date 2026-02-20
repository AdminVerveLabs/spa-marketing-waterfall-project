# Phase 6: Pre-Generation Review

**Date:** 2026-02-17
**Phase:** 6 of 7 (Investigation)

## 1. Cross-Check: Fix Plan vs Issue Registry

| Issue | Addressed? | How |
|-------|-----------|-----|
| ISSUE-001: Step 4 convergence | YES | Entire branching pipeline replaced with single Code node |
| ISSUE-002: Verifier .item.json | YES | No more .item.json — data flows through loop variable |
| ISSUE-003: NamSor .item.json | YES | No more .item.json — data flows through loop variable |
| ISSUE-007: .all() collectors | YES | No more collectors — single node handles everything |
| ISSUE-008: Run Summary4 counts | YES | Run Summary4 reads from direct input, no convergence |
| ISSUE-004: Step 2 .item.json | DEFERRED | Step 2 functional; fix when symptoms appear |
| ISSUE-005: Contact dedup | DEFERRED | Requires schema migration |
| ISSUE-006: Role-based emails | DEFERRED | Requires cross-step validation changes |
| ISSUE-009: 5-path insert | DEFERRED | Step 3a functional |
| ISSUE-010: Booking domains | DEFERRED | Requires domain blocklist |
| ISSUE-011: Company email | DEFERRED | Requires schema migration |
| ISSUE-012: Step 2 risk | DEFERRED | Unconfirmed |
| ISSUE-013: 5x Validate copies | DEFERRED | Cosmetic |
| ISSUE-014: CHECK constraint | DEFERRED | No current breakage |
| ISSUE-015: Bridge nodes | DEFERRED | Cosmetic |

**Result:** All 5 CRITICAL/HIGH Step 4 issues addressed. No contradictions between fixes.

## 2. Data Flow Integrity Check

### Before fix (broken):
```
Filter & Merge Contacts → [13 contacts]
  → Needs Email? → splits into 3+ paths
    → Hunter Found Email? → convergence (2 inputs)
      → Merge Email Results → convergence (3 inputs)
        → Collect Email Results → convergence (3 inputs)
          → ... → 7 total convergence points
            → Run Summary4 → sees only 1 contact
```

### After fix:
```
Filter & Merge Contacts → [13 contacts]
  → Enrich Contacts (Code) → loops through all 13 sequentially
    → each contact: Hunter → Snov.io → Verifier → NamSor → Supabase PATCH
  → [13 enriched contacts with results]
  → Run Summary4 → sees all 13 contacts
```

**Integrity check:** The input to `Enrich Contacts` is identical to what `Needs Email?` received — the same 13 contacts from `Filter & Merge Contacts`. The output contains the same fields as `Collect Updates` would have produced (with `_contact_id`, `_update_payload`, `_has_updates`, etc.). Run Summary4 reads these fields identically.

## 3. Dry-Run: Contact with Email, Domain, and Name

**Contact:** Jane Smith, company domain = `healinghandsspa.com`, no existing email

```
Step 1: Enrich Contacts receives contact
Step 2: needsEmail = true (no email_business)
Step 3: hasDomainAndName = true (domain + first_name)
Step 4: Hunter API call → GET https://api.hunter.io/v2/email-finder?domain=healinghandsspa.com&first_name=Jane&last_name=Smith&api_key=...
Step 5: Hunter returns { data: { email: "jane@healinghandsspa.com", score: 92 } }
Step 6: _hunter_email = "jane@healinghandsspa.com", _email_source = "hunter"
Step 7: Snov.io SKIPPED (Hunter found email)
Step 8: _best_email = "jane@healinghandsspa.com"
Step 9: Verifier API call → GET https://api.hunter.io/v2/email-verifier?email=jane@healinghandsspa.com&api_key=...
Step 10: Verifier returns { data: { status: "valid", score: 95, smtp_check: true } }
Step 11: _email_status = "verified", _email_verified_at = "2026-02-17T..."
Step 12: NamSor API call → GET https://v2.namsor.com/.../origin/Jane/Smith
Step 13: NamSor returns { countryOrigin: "US", regionOrigin: "Northern America" }
Step 14: _cultural_affinity = "Northern America / US"
Step 15: Build update: { email_business: "jane@healinghandsspa.com", email_status: "verified", email_verified_at: "...", cultural_affinity: "Northern America / US" }
Step 16: PATCH to Supabase → contacts?id=eq.{id}
Step 17: Result added to output array
```

**Expected:** Contact fully enriched with email, verification, and NamSor data. All in single Code node execution.

## 4. Dry-Run: Contact with No Email, No Domain (Solo Detection Thin Data)

**Contact:** Source = solo_detection, first_name = "Massage", last_name = null, domain = null

```
Step 1: Enrich Contacts receives contact
Step 2: needsEmail = true (no email_business)
Step 3: hasDomainAndName = false (no domain)
Step 4: Hunter SKIPPED (no domain)
Step 5: Snov.io SKIPPED (no domain)
Step 6: _best_email = null
Step 7: Verifier SKIPPED (no email to verify)
Step 8: NamSor SKIPPED (no last_name)
Step 9: No update payload (nothing to update)
Step 10: _has_updates = false, _update_payload = null
Step 11: No Supabase PATCH call
Step 12: Result added to output array with all nulls
```

**Expected:** Contact passes through cleanly. No API calls. No errors. No data corruption.

## 5. Dry-Run: Contact with Email That Verifies as Invalid

**Contact:** John Doe, existing email_business = "john@olddomain.com", needs verification

```
Step 1: Enrich Contacts receives contact
Step 2: needsEmail = false (has email_business)
Step 3: _best_email = "john@olddomain.com", _email_source = "existing"
Step 4: Hunter Finder SKIPPED (already has email)
Step 5: Snov.io SKIPPED (already has email)
Step 6: Verifier API call → email-verifier?email=john@olddomain.com
Step 7: Verifier returns { data: { status: "invalid" } }
Step 8: _email_status = "invalid"
Step 9: Update payload: { email_status: "invalid", email_verified_at: "...", email_business: null }
Step 10: NamSor API call (if cultural_affinity missing)
Step 11: PATCH to Supabase — sets email_business to null (removes invalid email)
```

**Expected:** Invalid email is nulled out. Contact marked as invalid. Data stays clean.

## 6. Dry-Run: All APIs Skipped (All Toggles = true)

**Contact:** Any contact, all skip toggles = true

```
Step 1: Enrich Contacts receives contact
Step 2: config.skip_hunter = 'true' → Hunter SKIPPED
Step 3: config.skip_snovio = 'true' → Snov.io SKIPPED
Step 4: _best_email = existing email_business or null
Step 5: config.skip_hunter_verifier = 'true' → Verifier SKIPPED
Step 6: _email_status = 'unverified' (if has email) or null
Step 7: config.skip_namsor = 'true' → NamSor SKIPPED
Step 8: Update payload depends on existing data vs enrichment results
Step 9: If no new data → _has_updates = false → no PATCH call
```

**Expected:** Zero API calls. Zero credits consumed. Contacts pass through with existing data only. This is the safe test mode.

## 7. Dry-Run: Hunter Finder Returns No Result, Snov.io Finds Email

**Contact:** Maria Chen, domain = "zenmasssage.com"

```
Step 1: needsEmail = true, hasDomainAndName = true
Step 2: Hunter API call → returns no result (score < 50 or no email)
Step 3: _hunter_email = null
Step 4: Snov.io API call → returns { emails: [{ email: "maria@zenmassage.com", emailStatus: "valid" }] }
Step 5: _snovio_email = "maria@zenmassage.com", _email_source = "snovio"
Step 6: _best_email = "maria@zenmassage.com"
Step 7: Verifier → verifies the Snov.io email
Step 8: NamSor → processes Maria Chen
Step 9: PATCH to Supabase with all enrichment data
```

**Expected:** Waterfall fallback works correctly. Snov.io email used when Hunter fails.

## 8. Node Changes Summary

### Nodes Removed (31):
All nodes between `Needs Email?` and old `Run Summary4`:
1. Needs Email?
2. Has Domain & Name?
3. Hunter Enabled?
4. Hunter Email Finder
5. Parse Hunter Response
6. Skip Hunter
7. Hunter Found Email?
8. Snov.io Enabled?
9. Snov.io Email Finder
10. Parse Snov.io Response
11. Skip Snov.io
12. Merge Email Results
13. Collect Email Results
14. Skip Email - Pass Through
15. No Domain - Skip Email
16. Has Email to Verify?
17. Hunter Verifier Enabled?
18. Hunter Email Verifier
19. Parse Verifier Response
20. Skip Verification
21. Collect Verified Results
22. Needs NamSor?
23. NamSor Origin
24. Parse NamSor Response
25. Skip NamSor
26. Collect NamSor Results
27. Prepare Contact Update
28. Has Updates?
29. Update Contact in Supabase
30. Collect Updates
31. Run Summary4

### Nodes Added (2):
1. **Enrich Contacts** — Code node (runOnceForAllItems), Position [18432, 240]
2. **Run Summary4** — Code node (runOnceForAllItems), Position [18880, 240]

### Nodes Unchanged (8):
1. Bridge to 4
2. Step 4 Config
3. Fetch Contacts
4. Collapse to Single
5. Fetch Companies1
6. Filter & Merge Contacts
7. Batch Empty?3
8. No Records - Done3

### Connections Changed:
- **Removed:** All 47 connections within the old Step 4 branching pipeline
- **Added:**
  - `Batch Empty?3` output[1] (FALSE) → `Enrich Contacts`
  - `Enrich Contacts` → `Run Summary4`
- **Kept:**
  - `Bridge to 4` → `Step 4 Config` → `Fetch Contacts` → `Collapse to Single` → `Fetch Companies1` → `Filter & Merge Contacts` → `Batch Empty?3`
  - `Batch Empty?3` output[0] (TRUE) → `No Records - Done3`

## 9. No Contradictions Found

- Fix addresses all 5 CRITICAL/HIGH Step 4 issues
- Zero convergence in new design
- Data flow preserved: same inputs, same output schema
- Config toggles preserved: all skip flags work as before
- API patterns preserved: same URLs, headers, auth
- Error handling preserved: try/catch around each API call
- Rate limiting added: delays between calls

## 10. Ready for Phase 7

All cross-checks pass. All dry-runs produce expected results. No contradictions found.
Proceed to generate the fixed workflow JSON.
