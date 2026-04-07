# Apollo Cleanup Debt

**Created:** 2026-03-26 (Session 101)
**Status:** Deferred — execute after Apollo sync system changes

---

## Overview

The Lead Quality Improvements v1 project deleted ~5,998 companies from Supabase. Many of these had already been synced to Apollo. Their Apollo Account + Contact records still exist as orphans. Additionally, some companies still in Supabase have quality flags that should be reflected in Apollo.

This cleanup should be batched with any Apollo sync system changes to avoid doing it twice.

---

## Cleanup Items

### 1. Apollo Orphans — Deleted from Supabase, still in Apollo

**Estimated:** ~3,525 Apollo Accounts + associated Contacts

**What happened:** Companies matching quality filters (chiropractors, PT clinics, car repair, med spas, franchises, etc.) were deleted from Supabase via category_blocklist and chain_blocklist cleanup. CASCADE deleted their Supabase contacts and social_profiles. But their Apollo Account and Contact records were created before the quality filters existed.

**Problem:** These orphaned records pollute Apollo's account list, prospect lists, and search results. Sales may accidentally contact filtered businesses.

**How to identify:** We don't have the exact company IDs (audit log was added after the bulk deletion). Options:
- Search Apollo by category/name patterns matching our filters
- Query Apollo for accounts with no matching Supabase `apollo_account_id`
- Use the `filtered_companies_log` table for FUTURE deletions (logging now active)

**Cleanup approach TBD:** Archive, delete, or tag in Apollo.

### 2. Mobile Practice Records in Apollo

**Count:** 115 companies synced with `is_mobile_practice = true`

**What happened:** Mobile massage businesses were flagged but not deleted (soft scoring). They were synced to Apollo before the flag existed.

**Cleanup:** These Apollo accounts need the mobile practice flag visible. Either:
- Add `Is Mobile Practice` custom field to Apollo Account and update
- Or tag/label them for sales team awareness

### 3. Language Barrier Records in Apollo

**Count:** 711 companies synced with `is_language_barrier_risk = true`

**What happened:** Language barrier risk businesses were flagged with -20 score penalty. They were synced to Apollo before the flag existed.

**Cleanup:** These Apollo accounts need the flag visible. Either:
- Add `Language Barrier Risk` custom field to Apollo Account and update
- Update the Lead Score custom field to reflect the new (lower) score
- Or tag/label them

### 4. Lead Score Updates in Apollo

**Count:** All ~23,617 currently synced companies

**What happened:** Lead scores were recalculated with new scoring rules (mobile -20, language barrier -20). Apollo has stale lead scores.

**Cleanup:** The Apollo Sync workflow currently only syncs NEW companies (`apollo_synced_at IS NULL`). It does NOT re-sync when lead scores change. A bulk update or sync modification is needed.

### 5. Future Prevention — Sync Filters

**Current gap:** Fetch Unsynced query has NO filters for quality flags:
```
WHERE enrichment_status = 'fully_enriched' AND apollo_synced_at IS NULL
```

**Needed:** Add filters so flagged companies either:
- Don't sync at all (hard exclusion for franchises if any survive cleanup)
- Sync with flags visible (mobile + language barrier)

---

## Execution Order

1. Implement Apollo sync system changes (new system TBD)
2. Add new custom fields to Apollo (is_mobile_practice, is_language_barrier_risk, etc.)
3. Bulk-update existing Apollo records with new field values + corrected lead scores
4. Clean up orphaned accounts (deleted from Supabase but still in Apollo)
5. Remove orphaned contacts from prospect lists
6. Verify prospect list integrity

---

## Numbers Summary

| Category | Count | In Apollo? | Action |
|----------|-------|-----------|--------|
| Orphaned (deleted from Supabase) | ~3,525 | Yes | Archive/delete from Apollo |
| Mobile practice (flagged, not deleted) | 115 | Yes | Add flag, update score |
| Language barrier (flagged, not deleted) | 711 | Yes | Add flag, update score |
| Stale lead scores | 23,617 | Yes | Bulk update scores |
| Future: franchise survivors | 0 | N/A | Prevented by chain_blocklist |
