# Phase 4: Issue Registry

**Workflow:** Step 4 (isolated) - with Layer 2 Verification
**Date:** 2026-02-17
**Phase:** 4 of 7 (Investigation)

All issues compiled from Phases 1-3 audit plus known bugs from handoff documentation.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 5 |
| MEDIUM | 4 |
| LOW | 2 |
| **TOTAL** | **15** |

---

## CRITICAL Issues

### ISSUE-001: Step 4 Email Waterfall — Multi-Path Convergence Batching Bug
- **Severity:** CRITICAL
- **Category:** batching-bug
- **Location:** Step 4 → `Needs Email?` through `Collect Email Results` (7 convergence points in chain)
- **Description:** When contacts split across the email waterfall (Hunter → Snov.io → skip paths), each path creates a separate execution batch. Downstream nodes receive only one batch's items, causing 12 of 13 contacts to never reach email verification.
- **Evidence:**
  - Hunter.io dashboard shows only 1 API call instead of 13
  - Phase 2 identified 7 convergence points in unbroken Step 4 chain
  - Phase 3 confirmed 3 CRITICAL `.item.json` pairing bugs (Parse Hunter Response, Parse Snov.io Response, Parse Verifier Response)
  - `Collect Email Results` receives 3 separate batches; each batch's `.all()` only sees its own items
- **Impact:** Only 1 of 13 contacts gets email verification. The entire Step 4 enrichment pipeline is effectively broken.
- **Proposed Fix:** Eliminate all convergence in Step 4 by converting the email/verification/NamSor waterfall into a **single Code node** that processes each contact in a loop:
  1. Replace the entire IF→HTTP→Parse→IF→HTTP→Parse→Collect chain with one Code node
  2. The Code node loops through all contacts, makes HTTP requests inline using n8n's `$http` helper, and returns fully enriched contacts
  3. No branching = no convergence = no batching bug
  4. Keep config toggles (skip_hunter, skip_snovio, etc.) as input from Step 4 Config
- **Dependencies:** None — this is the root issue

### ISSUE-002: Step 4 Verification Path — `.item.json` Pairing at Convergence
- **Severity:** CRITICAL
- **Category:** batching-bug
- **Location:** Step 4 → `Parse Verifier Response` uses `$('Has Email to Verify?').item.json`
- **Description:** `Parse Verifier Response` uses `.item.json` to pair with the item from `Has Email to Verify?`, but it's downstream of `Collect Email Results` (3-input convergence) and `Collect Verified Results` (2-input convergence). Items pair by index within batch, not by contact ID.
- **Evidence:** Phase 3 CRITICAL finding — convergence ancestors: Collect Email Results, Skip Verification, Collect Verified Results
- **Impact:** Verifier response paired with wrong contact's data, corrupting verification results.
- **Proposed Fix:** Addressed by ISSUE-001 fix (eliminate convergence).
- **Dependencies:** ISSUE-001

### ISSUE-003: Step 4 NamSor Path — `.item.json` Pairing at Convergence
- **Severity:** CRITICAL
- **Category:** batching-bug
- **Location:** Step 4 → `Parse NamSor Response` uses `$('Needs NamSor?').item.json`
- **Description:** Same class of bug as ISSUE-002. `Parse NamSor Response` pairs with `Needs NamSor?` item by index, but is downstream of 5 convergence points.
- **Evidence:** Phase 3 CRITICAL finding — convergence ancestors: Collect Email Results, Skip Verification, Collect Verified Results, Collect NamSor Results
- **Impact:** NamSor cultural affinity data paired with wrong contact.
- **Proposed Fix:** Addressed by ISSUE-001 fix.
- **Dependencies:** ISSUE-001

### ISSUE-004: Step 2 Company Enrichment — `.item.json` Pairing at Convergence
- **Severity:** CRITICAL
- **Category:** batching-bug
- **Location:** Step 2 → `Analyze Website HTML` (uses `$('Has Website?').item.json`), `Parse Google Details` (uses `$('Has Google Place ID?').item.json`), `Prepare Social Processing` (uses `$('Prepare Company Update').item.json`)
- **Description:** Three Code nodes in Step 2 use `.item.json` pairing downstream of convergence points (`Merge Backfill`, `Merge Website Results`, `Prepare Company Update`). Items can pair with wrong company data.
- **Evidence:** Phase 3 identified 3 CRITICAL bugs in Step 2 Code nodes
- **Impact:** Company enrichment data (website analysis, Google details, social profiles) may be attached to wrong companies. Less visible than Step 4 because Step 2 hasn't been reported as broken — but theoretically vulnerable.
- **Proposed Fix:** Carry company data through the pipeline via `$input.item.json` instead of referencing upstream IF nodes. Each Code node should receive its company data from the direct input, not from a distant upstream node.
- **Dependencies:** None — independent of Step 4 fixes

---

## HIGH Issues

### ISSUE-005: No Contact Deduplication
- **Severity:** HIGH
- **Category:** data-quality
- **Location:** Step 3a → `Insert Contact to Supabase`
- **Description:** No unique constraint on the contacts table. Re-running the same metro creates duplicate contact rows with identical names/emails.
- **Evidence:** Known bug BUG-002 from handoff documentation
- **Impact:** Duplicate contacts waste API credits on enrichment and produce confusing data.
- **Proposed Fix:**
  1. Add unique index on `(company_id, email_business)` or `(company_id, first_name, last_name)`
  2. Change `Insert Contact to Supabase` from POST to UPSERT with `Prefer: resolution=merge-duplicates`
  3. Add `ON CONFLICT` clause to handle re-runs gracefully
- **Dependencies:** Schema migration needed

### ISSUE-006: Role-Based Email Over-Rejection
- **Severity:** HIGH
- **Category:** logic-error
- **Location:** Step 3a → `Validate & Clean Contact` (5 copies)
- **Description:** Layer 1 validation blanket-rejects role-based emails (info@, contact@, hello@). For solo practitioners, this IS their business email and the only one available.
- **Evidence:** Known issue from handoff. Solo practitioner contacts lose their only email.
- **Impact:** Solo practitioners (estimated 30-40% of massage therapy businesses) have email_business set to null after validation, making email verification impossible.
- **Proposed Fix:** Add solo practitioner detection flag. If `source = 'solo_detection'` or company `estimated_size = 'solo'`, allow role-based emails. Only reject role-based emails for multi-person businesses.
- **Dependencies:** Solo practitioner flag must be available in contact data

### ISSUE-007: `.all()` at Step 4 Collector Nodes — Duplication Risk
- **Severity:** HIGH
- **Category:** batching-bug
- **Location:** Step 4 → `Collect Email Results`, `Collect Verified Results`, `Collect NamSor Results`, `Collect Updates`
- **Description:** These nodes use `$('NodeName').all()` to gather items from multiple paths, but `.all()` returns per-batch items. When the node runs multiple times (once per batch), it accumulates stale/duplicate items.
- **Evidence:** Phase 3 identified 9 HIGH `.all()` at convergence findings in Step 4
- **Impact:** Items may be duplicated or processed with stale data. Combined with ISSUE-001, this is part of the core batching failure.
- **Proposed Fix:** Addressed by ISSUE-001 fix (eliminate convergence). The collector pattern is fundamentally broken with multi-path convergence.
- **Dependencies:** ISSUE-001

### ISSUE-008: `.all()` at Run Summary Nodes — Metrics Duplication
- **Severity:** HIGH
- **Category:** batching-bug
- **Location:** Steps 1-4 → `Run Summary`, `Run Summary1`, `Run Summary2`, `Run Summary3`, `Run Summary4`
- **Description:** Run Summary nodes use `.all()` to count items for metrics. When downstream of convergence, they run per-batch and report duplicated/incorrect counts.
- **Evidence:** Phase 3 identified HIGH `.all()` issues in all 5 Run Summary nodes
- **Impact:** Workflow run summaries show incorrect counts. Not a data corruption issue but hides the true scope of the batching bug.
- **Proposed Fix:** Move Run Summary to after all convergence is resolved (or fix convergence). The ISSUE-001 fix for Step 4 eliminates convergence before Run Summary4. Other steps' Run Summary nodes may need similar treatment if their steps are fixed.
- **Dependencies:** ISSUE-001 for Step 4; ISSUE-004 for Step 2

### ISSUE-009: Step 3a Insert Contact — 5-Path Convergence
- **Severity:** HIGH
- **Category:** batching-bug
- **Location:** Step 3a → `Insert Contact to Supabase` (5 inputs from 5 Validate & Clean Contact copies)
- **Description:** `Insert Contact to Supabase` receives contacts from 5 different Validate & Clean Contact nodes. This creates up to 5 separate batches, each of which triggers the HTTP insert independently.
- **Evidence:** Phase 2 convergence registry: 5 sources → `Insert Contact to Supabase`
- **Impact:** In theory works because each batch has different contacts (one per source type). But Run Summary3 downstream gets multiple batch runs with incorrect counts. Also contributes to code duplication (ISSUE-013).
- **Proposed Fix:** Replace 5 Validate & Clean Contact copies with a single validation node. Route all contact paths to it via a Merge (Append), then to a single insert. This also fixes ISSUE-013.
- **Dependencies:** ISSUE-005 (deduplication mitigates any race conditions)

---

## MEDIUM Issues

### ISSUE-010: Booking Platform Domains Stored as Company Domain
- **Severity:** MEDIUM
- **Category:** data-quality
- **Location:** Step 2 → domain extraction
- **Description:** Some companies have booking platform URLs (setmore.com, square.site, vagaro.com) stored as their primary domain. Hunter Email Finder can't find emails at these domains.
- **Evidence:** Known bug BUG-003. Example: Oasis Spa Austin has `nonamecs4b.setmore.com` as domain.
- **Impact:** Email finder fails for companies with booking platform domains (~10-15% of spas).
- **Proposed Fix:** Add domain validation in Step 2. Maintain a blocklist of known booking/platform domains (setmore.com, square.site, vagaro.com, wix.com, squarespace.com, etc.). When detected, null out the domain and flag for manual review.
- **Dependencies:** None

### ISSUE-011: Missing Company Email Column
- **Severity:** MEDIUM
- **Category:** schema-gap
- **Location:** Database schema / Step 2
- **Description:** No `email` field on the companies table. Role-based emails (info@company.com) that are useful at the company level get rejected because they're validated as contact emails.
- **Evidence:** Known issue from handoff documentation
- **Impact:** Company-level contact information lost. Role-based emails could be stored as company emails instead of being rejected.
- **Proposed Fix:**
  1. Add `email` column to companies table
  2. In Step 2 enrichment, if a role-based email is found during website analysis, store it as company email
  3. Update Validate & Clean Contact to route role-based emails to company record
- **Dependencies:** Schema migration, ISSUE-006 (role-based email handling)

### ISSUE-012: Step 2 `.item.json` Pairing Risk (Practical Impact Unconfirmed)
- **Severity:** MEDIUM
- **Category:** batching-bug
- **Location:** Step 2 → `Analyze Website HTML`, `Parse Google Details`, `Prepare Social Processing`
- **Description:** Same class as ISSUE-004 but practical impact is unconfirmed. Step 2 hasn't been reported as broken, suggesting either (a) items maintain order across the Merge Backfill convergence, or (b) bugs exist but haven't been noticed yet.
- **Evidence:** Phase 3 flagged 3 CRITICAL `.item.json` patterns, but Step 2 functionally works
- **Impact:** Potentially wrong company enrichment data. Needs investigation.
- **Proposed Fix:** Same as ISSUE-004 — carry data through pipeline. Lower priority than Step 4.
- **Dependencies:** None, but should be fixed alongside ISSUE-004

### ISSUE-013: Validate & Clean Contact — 5 Identical Copies
- **Severity:** MEDIUM
- **Category:** logic-error
- **Location:** Step 3a → Validate & Clean Contact, Contact1, Contact2, Contact3, Contact4
- **Description:** The same 322-line validation code is duplicated across 5 nodes. This makes maintenance difficult and contributes to the 5-path convergence at `Insert Contact to Supabase` (ISSUE-009).
- **Evidence:** Phase 1 identified this duplicate group
- **Impact:** Maintenance burden. Risk of copies drifting out of sync. Contributes to convergence bug.
- **Proposed Fix:** Replace all 5 copies with a single Validate & Clean Contact node. Route all contact sources through it.
- **Dependencies:** ISSUE-009

---

## LOW Issues

### ISSUE-014: contacts.source CHECK Constraint Missing 'solo_detection'
- **Severity:** LOW
- **Category:** schema-gap
- **Location:** Database schema
- **Description:** The CHECK constraint on `contacts.source` doesn't include 'solo_detection' as a valid value.
- **Evidence:** Known bug BUG-004
- **Impact:** Could cause insert failures if constraint enforcement changes.
- **Proposed Fix:** `ALTER TABLE contacts DROP CONSTRAINT contacts_source_check; ALTER TABLE contacts ADD CONSTRAINT contacts_source_check CHECK (source IN ('apollo_search', 'apollo_enrich', 'website_about', 'solo_detection', 'no_domain_fallback'));`
- **Dependencies:** None

### ISSUE-015: Bridge Nodes — 3 Identical Code Copies
- **Severity:** LOW
- **Category:** logic-error
- **Location:** Bridge to 3b, Bridge to 3a, Bridge to 4
- **Description:** Three identical bridge nodes that just pass data through.
- **Evidence:** Phase 1 identified 3-node duplicate group
- **Impact:** Minimal — cosmetic/maintenance issue.
- **Proposed Fix:** Keep as-is. Bridge nodes provide visual clarity in n8n. Low priority.
- **Dependencies:** None

---

## Issue Dependency Graph

```
ISSUE-001 (Step 4 convergence) ─── ROOT FIX
  ├── ISSUE-002 (Verifier .item.json) — resolved by 001
  ├── ISSUE-003 (NamSor .item.json) — resolved by 001
  ├── ISSUE-007 (.all() collectors) — resolved by 001
  └── ISSUE-008 (Run Summary4 counts) — resolved by 001

ISSUE-004 (Step 2 .item.json) ─── INDEPENDENT
  └── ISSUE-012 (Step 2 risk assessment) — same fix

ISSUE-005 (Contact dedup) ─── INDEPENDENT
  └── ISSUE-009 (5-path convergence) — dedup helps

ISSUE-006 (Role-based emails) ─── INDEPENDENT
  └── ISSUE-011 (Company email column) — complementary

ISSUE-009 (5 Validate copies convergence)
  └── ISSUE-013 (Code duplication) — same fix

ISSUE-010 (Booking domains) ─── INDEPENDENT
ISSUE-014 (CHECK constraint) ─── INDEPENDENT
ISSUE-015 (Bridge nodes) ─── NO FIX NEEDED
```

---

## Completeness Check

- [x] Multi-path convergence batching bugs (all locations) — ISSUE-001, 002, 003, 004, 007, 009, 012
- [x] Contact deduplication gap — ISSUE-005
- [x] Missing company email column — ISSUE-011
- [x] Booking platform domains stored as company domain — ISSUE-010
- [x] Role-based email over-rejection — ISSUE-006
- [x] Contacts source CHECK constraint missing 'solo_detection' — ISSUE-014
- [x] All Phase 3 CRITICAL bugs included — 6 findings mapped to ISSUE-001 through ISSUE-004
- [x] All Phase 3 HIGH bugs included — `.all()` issues mapped to ISSUE-007, 008, 009
- [x] Run Summary accuracy — ISSUE-008
- [x] Code duplication — ISSUE-013, ISSUE-015
- [x] Every issue has a proposed fix
- [x] Every issue has severity, category, and dependencies
