# Lead Quality Improvements v1 — Implementation Tracker

## Status: Phase 1 Investigation COMPLETE — Phase 2 Implementation next

**Goal:** Reduce wrong-business-type leads by 80%+, deprioritize language-barrier-risk leads, filter franchises and mobile practices.
**Scope doc:** `waterfall-lead-quality-scope.docx.md`
**Investigation results:** `INVESTIGATION-RESULTS.md`

---

## Phase 1: Investigation (COMPLETE — Session 101, 2026-03-26)

- [x] Write diagnostic SQL queries (`sql/01-investigation-queries.sql`)
- [x] Write follow-up queries (`sql/02-followup-queries.sql`)
- [x] Audit category distribution — 30,193 companies, top 80 categories analyzed
- [x] Test all 9 filter types against existing data (name-based matching)
- [x] Manual review of all 86 high-value leads at risk — **1 false positive (1.2%)**
- [x] Manual review of 20 high-value franchise matches — **0 false positives**
- [x] Assess cultural affinity reliability — 97.1% populated, usable but noisy for language barrier
- [x] Assess "fully enriched" data completeness — 33% email, 60% domain, 97% phone
- [x] Overlap analysis — 3,054 single-filter, 66 double, 1 triple
- [x] Apollo blast radius — 2,915 of 3,043 affected already synced (96%)
- [x] Decision on "Review" categories (Sauna, Skin Care, Med Spa, Resort)
- [x] Document findings in `INVESTIGATION-RESULTS.md`

### Key Findings
- ~3,043 companies (10.1%) match proposed filters
- Current `category_blocklist` has 12 patterns; needs ~16 more
- 9 report-only junk categories not in pipeline blocklist (Car repair = 622 companies!)
- Safe-term exemption pattern works — must apply to name filters too (not just categories)
- Cultural affinity: 97% populated but only 30% signal rate at language-barrier companies — name patterns are primary signal
- `additional_types` from Google Places not persisted to Supabase — future enhancement

---

## Phase 2: Implementation

### Priority 1 — SQL only, no workflow changes (uses existing cleanup infrastructure)

- [x] **2.1 Expand `category_blocklist`** — INSERT ~16 new patterns:
  - Chiropractor, Chiropractors (731 companies)
  - Medical Clinic (349)
  - Acupuncture (123+)
  - Store (95)
  - Yoga, Pilates, Fitness (153+)
  - Barbers (79)
  - Gym, Fitness center (64+)
  - Doulas (50)
  - Sauna (48) — with safe-term exemption
  - IV Hydration (36)
  - Hospice (35)
  - Counseling & Mental Health (29)
  - Resort hotel (26)
  - Medical Spas (24) — with safe-term exemption
  - Body Contouring (22)
  - Pain Management (22)
  - All with existing safe-term exemption (Massage, Bodywork, Day Spa, Wellness, Therapeutic)

- [x] **2.2 Promote 9 report-only junk categories** to `category_blocklist`:
  - Transportation Service, Car repair and maintenance service, Car Rental Agency, Educational Institution, Association / Organization, Storage Facility, Shipping Service, Car Dealer
  - Note: Corporate Office already in blocklist

- [x] **2.3 Add 8 franchise brands** to `chain_blocklist`:
  - Massage Envy, Hand & Stone, Elements Massage, Massage Heights, Massage Luxe / MassageLuXe, LaVida Massage, Spavia Day Spa, Massage Green Spa
  - Domain patterns where known (e.g., `heightswellnessretreat.com`, `massageheights.com`, `massageenvy.com`)

- [x] **2.4 Write SQL file** (`sql/03-expand-blocklists.sql`) with all INSERTs — Session 101
- [x] **2.5 Write dry-run preview** (`sql/04-preview-new-filters.sql`) — SELECT-only preview — Session 101
- [x] **2.6 Run dry-run, review results** — 3,795 category + 397 franchise = ~4,192 estimated. Safe-term exemption keeps 1,406.
- [x] **2.7 Execute blocklist expansion in Supabase** — 26 category patterns + 9 chain entries INSERTed — Session 101
- [x] **2.8 Run cleanup on all metros** — Single-metro test (Oxford city: 18/69 deleted, exact match). Full pipeline: 4,741 companies + 1,579 contacts + 7,253 social_profiles deleted. Sanity check: 0 pure chiro/car repair/franchise remaining, 393 chiro+massage combos correctly kept.

### Priority 2 — Workflow changes

- [x] **2.9 Add name-pattern filters** to discovery normalization step — deployed to both Normalize Google Results + Normalize Yelp Results via MCP. 22 exclusion patterns + 5 safe terms. Local snapshot updated.
  - Physical therapy, chiropractic, med spa, acupuncture, energy healing, float/salt, mobile practice
  - **Must include safe-term exemption** on name (if name contains Massage/Bodywork/Day Spa/Wellness/Therapeutic → skip filter)
  - Location: `Normalize Google Results` and `Normalize Yelp Results` Code nodes in main workflow

- [x] **2.10 Add mobile practice detection** — `is_mobile_practice` column added, 122 companies flagged, scoring rule added (-20 pts), lead scores recalculated. (122 matches, 0 high-value risk — safest filter)

- [x] **2.11 Store `additional_types` from Google Places** — Column added to companies table. `enrich-companies.js` updated locally (line ~458). Needs n8n deployment (manual paste — file too large for MCP).
  - Add `additional_types JSONB` column to `companies` table
  - Update `enrich-companies.js` PATCH payload (line ~450) to include it
  - Deploy via MCP or manual paste

### Priority 3 — Scoring changes

- [x] **2.12 Language barrier soft scoring** — `is_language_barrier_risk` column added, 740 companies flagged, scoring rule (-20 pts) added, lead scores recalculated. Cleanup function updated to flag future metros automatically.

- [x] **2.13 Update lead scoring RPC** — RPC reads scoring_rules dynamically, picks up both new rules (mobile -20, language barrier -20) automatically.

- [x] **2.14 Add `is_franchise` flag** — column added. Chain cleanup function flags companies as franchise before deletion.

- [x] **2.15 Add `filtered_companies_log` audit table** — logs company_id, name, category, metro, filter_type, filter_reason, lead_score, apollo_synced_at, filtered_at for every deletion. Both category and chain cleanup functions updated to log before deleting.

---

### Pre-Implementation: Downstream Impact Assessment

Before ANY changes, verify no unintended consequences across:

- [x] **2.0a Map all consumers of `companies` table** — What reads from it?
  - Apollo Sync workflow (`g9uplPwBAaaVgm4X`) — fetches unsynced companies
  - Report Generator (`SL9RrJBYnZjJ8LI6`) — fetches companies by metro for xlsx
  - Dashboard — reads companies for display
  - Lead scoring RPC — reads companies for scoring
  - Sub-workflow enrichment — reads company_ids from batch dispatcher
  - Batch Dispatcher — queries companies by discovery_metro

- [x] **2.0b Verify cleanup function behavior** — `run_post_discovery_cleanup()` DELETEs from companies with CASCADE to contacts + social_profiles. Confirm:
  - Apollo Sync: does it handle companies that disappear between sync runs? (apollo_synced_at set but company deleted)
  - Report Generator: does it handle fewer companies than expected?
  - Dashboard: does it handle missing companies gracefully?

- [x] **2.0c Verify blocklist expansion is additive only** — New INSERTs to category_blocklist/chain_blocklist tables. No function changes, no schema changes. Existing cleanup function reads these tables dynamically.

- [x] **2.0d Test cleanup on ONE metro first** — Run `run_post_discovery_cleanup()` on a single small metro, verify only expected companies are removed, check that contacts and social_profiles cascade correctly.

- [x] **2.0e Document Apollo Sync interaction** — When companies are deleted by cleanup:
  - Already-synced companies (apollo_synced_at IS NOT NULL) will have Apollo Account/Contact records with no Supabase source
  - Apollo Sync's "Fetch Unsynced" query (`apollo_synced_at IS NULL`) won't touch them
  - But they become orphaned in Apollo — need cleanup plan

---

## Phase 2.5: Apollo Cleanup

After blocklist expansion removes filtered companies from Supabase:

- [ ] **2.5a Quantify Apollo orphans** — Query: companies that were synced to Apollo AND match new filters (already know ~2,915 from investigation)
- [ ] **2.5b Decide cleanup approach:**
  - Option A: Archive/delete from Apollo via API (accounts + contacts)
  - Option B: Tag in Apollo with "filtered" label for manual review
  - Option C: Leave in Apollo but remove from prospect lists
- [ ] **2.5c Write Apollo cleanup script** — based on chosen approach
- [ ] **2.5d Execute Apollo cleanup** — after Supabase cleanup verified
- [ ] **2.5e Verify prospect list integrity** — ensure filtered contacts removed from active prospect lists

---

## Phase 3: Validation (after Phase 2 + 2.5 complete)

- [ ] **3.1 Run pipeline on one metro** with new filters active
- [ ] **3.2 Compare results** to a previous run of the same metro
- [ ] **3.3 Verify no legitimate massage businesses filtered**
- [ ] **3.4 Check filter counts** — how many caught per filter type
- [ ] **3.5 Review lead score distribution** changes
- [ ] **3.6 Verify Apollo Sync still works** — run a sync cycle, confirm no errors from deleted companies
- [ ] **3.7 Verify Report Generator still works** — generate a report for a cleaned metro
- [ ] **3.8 Verify Queue Wrapper still works** — next metro processes without issues
- [ ] **3.9 Document validation results**

---

## Decisions Log

| # | Decision | Reasoning | Date |
|---|----------|-----------|------|
| D1 | Safe-term exemption on ALL filters (category + name) | "Just Be Therapeutic Massage and Float Spa" false positive — name contains "Massage" but matched "Float" filter. Exemption prevents this. | 2026-03-26 |
| D2 | Language barrier = soft score only, NOT hard filter | These are legitimate massage businesses. Deprioritize, don't exclude. | 2026-03-26 |
| D3 | Franchise brands → hard filter | Scope doc: franchise locations can't make independent marketing decisions. All 20 high-value matches confirmed as genuine franchises (Massage Heights). | 2026-03-26 |
| D4 | Skip Skin Care Clinic category filter | Too much overlap with spa/esthetics. Revisit in v2 if needed. | 2026-03-26 |
| D5 | Skip DC credential regex | Too fragile (matches "Washington, DC" addresses). Chiropractic name filter already catches most. | 2026-03-26 |
| D6 | Do NOT retroactively delete existing records | Flag/score instead. Existing Apollo records (2,915) are a separate Phase 3 concern. | 2026-03-26 |
| D7 | Cultural affinity = secondary signal for language barrier | Only 30% signal rate at language-barrier companies. Business name patterns are primary. | 2026-03-26 |
| D8 | "Fully enriched" ≠ all fields populated | Status set after workflow completes, regardless of data captured (33% email, 60% domain). Not a quality issue — just how the pipeline works. | 2026-03-26 |
| D9 | Promote report-only junk categories to pipeline blocklist | Car repair alone is 622 companies. No reason to discover+enrich then hide in reports. | 2026-03-26 |
| D10 | Massage franchises now blocked (reverses Queuing v1 D4) | Queuing v1 kept Massage Envy/Elements. Scope doc analysis shows franchise locations waste sales time — no purchasing authority. | 2026-03-26 |
| D11 | Pre-implementation downstream impact assessment required | Cleanup DELETEs cascade to contacts + social_profiles. Must verify Apollo Sync, Report Generator, Dashboard, Queue Wrapper all handle deleted records gracefully. | 2026-03-26 |
| D12 | Apollo cleanup is in scope (Phase 2.5) | ~2,915 companies already synced to Apollo match filters. These become orphaned after Supabase cleanup. Need explicit cleanup/archive in Apollo. | 2026-03-26 |
| D13 | Add `is_franchise` flag before deletion | Franchises are hard-deleted by chain cleanup, but flagging before deletion enables Apollo cleanup to identify which orphans are franchises. | 2026-03-26 |
| D14 | Add `filtered_companies_log` audit table | Every deletion is logged with company details, filter type, reason, lead_score, and apollo_synced_at. Enables impact measurement and false positive review per scope doc Section 7.2. | 2026-03-26 |

---

## Files Created / Modified

| File | Status | Purpose |
|------|--------|---------|
| `projects/quality_improvements_v1/waterfall-lead-quality-scope.docx.md` | Existing | Project scope (from Claude Chat) |
| `projects/quality_improvements_v1/INVESTIGATION-RESULTS.md` | Created Session 101 | Phase 1 findings |
| `projects/quality_improvements_v1/TRACKER.md` | Created Session 101 | This file |
| `projects/quality_improvements_v1/sql/01-investigation-queries.sql` | Created Session 101 | 30 diagnostic queries |
| `projects/quality_improvements_v1/sql/02-followup-queries.sql` | Created Session 101 | 6 follow-up queries |
| `projects/quality_improvements_v1/sql/03-expand-blocklists.sql` | TODO | Blocklist INSERT statements |
| `projects/quality_improvements_v1/sql/04-preview-new-filters.sql` | TODO | Dry-run preview |
| `docs/enrichment-pipeline-catalogue.md` | Created Session 101 | Full enrichment source catalogue |
| `docs/decisions/DECISIONS.md` | Modified Session 101 | ADR-041 (circuit breaker), ADR-042 (cooldown requeue), ADR-043 (searchLimit) |

### Pipeline files that will be modified in Phase 2:
| File | Change | Risk |
|------|--------|------|
| `category_blocklist` table (Supabase) | +16 new patterns | Low — uses existing safe-term exemption |
| `chain_blocklist` table (Supabase) | +8 franchise brands | Low — name/domain matching only |
| Main workflow normalization nodes | Name-pattern filters | Medium — touches discovery pipeline |
| `enrich-companies.js` | Store additional_types | Low — adds field to PATCH, no logic change |
| Lead scoring RPC | Language barrier scoring rules | Low — additive scoring, no leads removed |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-filtering removes good leads | High | Safe-term exemption on all filters; 1.2% false positive rate validated |
| Name patterns too broad | Medium | Tested against 30K companies; safe-term exemption catches edge cases |
| Breaking existing cleanup functions | High | New patterns use same mechanism (INSERT to existing table); no function changes |
| Franchise filter catches non-franchise | Low | All 20 high-value matches reviewed — 0 false positives |
| Language barrier scoring too aggressive | Low | Soft score only (-15 to -25 pts); all leads remain contactable |
| Discovery normalization changes break pipeline | Medium | Test on one metro before full deployment; name filters are additive (filter out, don't modify) |
| Cascade DELETE removes contacts/social_profiles unexpectedly | High | Test on single metro first; verify CASCADE behavior; check that enrichment data isn't lost for companies we want to keep |
| Apollo Sync errors on deleted companies | Medium | Apollo Sync queries by `apollo_synced_at IS NULL` — deleted companies won't appear. But existing Apollo records become orphaned. Phase 2.5 cleanup addresses this. |
| Orphaned Apollo records corrupt prospect lists | Medium | Phase 2.5 must remove filtered contacts from active prospect lists before or during cleanup |
| Report Generator fails on metro with fewer companies | Low | Report queries by discovery_metro — fewer companies just means smaller report. No structural failure expected. |
