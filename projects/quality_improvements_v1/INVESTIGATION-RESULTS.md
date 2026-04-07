# Lead Quality Improvements v1 — Phase 1 Investigation Results

**Date:** 2026-03-26
**Dataset:** 30,193 companies across ~800 metros
**Method:** Read-only SQL queries against Supabase production data

---

## 1. Pipeline Overview

| Metric | Value |
|--------|-------|
| Total companies | 30,193 |
| Fully enriched | 29,204 (97%) |
| With lead score > 0 | 18,907 (63%) |
| High-value (score >= 30) | 571 (1.9%) |

### What "Fully Enriched" Actually Means

"Fully enriched" means the enrichment workflow completed — NOT that all fields are populated:

| Field | Count | % of Enriched |
|-------|-------|---------------|
| Phone | 28,444 | 97.4% |
| Google Place ID | 22,507 | 77.1% |
| Website detected | 21,086 | 72.2% |
| Domain | 17,549 | 60.1% |
| Booking detected | 9,726 | 33.3% |
| Company email | 9,672 | 33.1% |

Phone is the strongest signal. Only 33% have company emails and 60% have domains — this limits what downstream enrichment (Hunter, Apollo) can do.

---

## 2. Name-Based Filter Impact

Tested proposed filters from the scope doc against company `name` field:

| Filter | Matches | High-Value Affected | % of Pipeline | Recommendation |
|--------|---------|-------------------|---------------|----------------|
| Chiropractic | 859 | 29 | 2.8% | Hard filter + safe-term exemption |
| Med Spa / Aesthetics | 715 | 9 | 2.4% | Hard filter |
| Language Barrier Risk | 669 | 5 | 2.2% | **Soft score only** (not hard filter) |
| Physical Therapy | 633 | 13 | 2.1% | Hard filter + safe-term exemption |
| Franchise | 373 | 20 | 1.2% | Hard filter |
| Acupuncture | 279 | 6 | 0.9% | Hard filter + safe-term exemption |
| Energy Healing | 128 | 3 | 0.4% | Hard filter + safe-term exemption |
| Mobile Practice | 122 | 0 | 0.4% | Hard filter (safest — zero high-value risk) |
| Float/Salt/Biohacking | 80 | 1 | 0.3% | Hard filter + safe-term exemption |

**Total affected (with overlap):** ~3,043 unique companies (10.1% of pipeline)

### Overlap Analysis

| Companies matching N filters | Count |
|-----------------------------|-------|
| Exactly 1 filter | 3,054 |
| Exactly 2 filters | 66 |
| Exactly 3 filters | 1 |

Very low overlap — filters are mostly independent. No compounding false-positive risk.

---

## 3. High-Value Lead Review (86 records manually reviewed)

All 86 high-value leads (score >= 30) matching proposed filters were reviewed. **Zero false positives in hard-filter categories**, with one exception:

### By filter type:

**Chiropractic (29):** All genuinely chiropractic businesses. Some have "Massage Therapy" in Yelp categories — safe-term exemption on category filter protects them correctly. But the name filter correctly identifies them as chiro-primary.

**Franchise (20):** All Massage Heights locations. All share `heightswellnessretreat.com` domain. Zero false positives — no "Elements of Healing" type naming collisions. Safe to filter.

**Physical Therapy (13):** All pure PT/rehab clinics. Zero massage businesses.

**Med Spa / Aesthetics (9):** All med spas, dermatology, aesthetics clinics. One edge case: "Nourished Aesthetics" has Yelp category "Massage Therapy" — safe-term exemption protects it on category filter; name filter would catch it. Acceptable.

**Acupuncture (6):** All acupuncture/TCM clinics. One ("Golden Tiger Acupuncture") has Google category "Massage" — safe-term exemption protects it on category filter. Name filter correctly catches it as acupuncture-primary.

**Language Barrier (5):** Soft score only — no leads lost. All legitimate massage businesses, just deprioritized.

**Energy Healing (3):** All reiki/yoga studios. No massage services. One ("Jasmine Reiki") has category "Massage Therapy, Reiki" — safe-term exemption protects on category filter.

**Float/Salt (1):** **FALSE POSITIVE FOUND.** "Just Be Therapeutic Massage and Float Spa" — this IS a massage business with "Float" in the name. Category is "Massage", has online booking. **Name-based filters need the same safe-term exemption as category filters:** if name contains "Massage", skip the filter.

### Action required before Phase 2:
- Implement safe-term exemption on name-based filters (not just category filters)
- The existing `cleanup_category_blocklist()` safe-term logic (checks for Massage, Bodywork, Day Spa, Wellness, Therapeutic) must be replicated for name patterns

---

## 4. Category Blocklist Gap Analysis

### Current state: 12 patterns
Physical Therapist, Hair Salon, Nail Salon, Tanning Salon, Dental Clinic, Clothing Store, Cosmetics Store, Corporate Office, Building Materials Store, Manufacturer, Mover, Sports Activity Location

### Missing high-count categories (not currently filtered)

| Category | Count | Decision |
|----------|-------|----------|
| Chiropractor / Chiropractors | 731 | **Add** — with safe-term exemption |
| Medical Clinic | 349 | **Add** — with safe-term exemption |
| Acupuncture | 123+ | **Add** — with safe-term exemption |
| Store | 95 | **Add** |
| Yoga / Pilates / Fitness | 153+ | **Add** |
| Barbers | 79 | **Add** |
| Doulas | 50 | **Add** |
| Sauna | 48 | **Add** — with safe-term exemption (some spa+sauna combos) |
| Gym / Fitness center | 64+ | **Add** |
| IV Hydration | 36 | **Add** |
| Hospice | 35 | **Add** |
| Counseling & Mental Health | 29 | **Add** |
| Resort hotel | 26 | **Add** |
| Body Contouring | 22 | **Add** |
| Medical Spas | 24 | **Add** — with safe-term exemption (some offer massage) |
| Pain Management | 22 | **Add** |
| Skin Care Clinic | 55 | **Skip for now** — too much overlap with spa/esthetics |

### Mixed categories requiring safe-term exemption
These categories contain BOTH a filtered term AND massage — must NOT be filtered:

| Category | Count | Why Keep |
|----------|-------|---------|
| Chiropractors + Massage Therapy | 104 | Offers massage services |
| Physical Therapy + Massage Therapy | 29 | Offers massage services |
| Acupuncture + Massage Therapy | 21 | Offers massage services |
| Massage Therapy + Reiki | 105+ | Offers massage (reiki is secondary) |
| Medical Spas + Massage Therapy | varies | Offers massage services |
| Saunas + Massage Therapy | varies | Offers massage services |

The existing `cleanup_category_blocklist()` function already has safe-term exemption logic (checks for Massage, Bodywork, Day Spa, Wellness, Therapeutic). This pattern should be reused for all new category filters.

### Report-only junk categories — promote to pipeline blocklist
9 categories filtered in `get_lead_report` / `generate-report.js` but NOT in the pipeline:

| Category | Count | Note |
|----------|-------|------|
| Car repair and maintenance service | 622 | Biggest easy win |
| Transportation Service | ? | |
| Corporate Office | ? | Already in category_blocklist |
| Car Rental Agency | ? | |
| Educational Institution | ? | |
| Association / Organization | ? | |
| Storage Facility | ? | |
| Shipping Service | ? | |
| Car Dealer | ? | |

**Recommendation:** Promote all 9 to `category_blocklist` table. Car repair alone is 622 companies.

---

## 5. Cultural Affinity Data Assessment

### Overall reliability
| Metric | Value |
|--------|-------|
| Total contacts | 7,153 |
| Cultural affinity populated | 6,949 (97.1%) |
| Missing affinity | 204 (2.9%) |

**Non-human contact names found:** Only 10 total (Spa: 3, Spathenee: 3, Spa-Tique: 2, Massage: 1, Myzenspa: 1). Negligible impact on data quality.

### Cultural affinity at language-barrier-pattern companies
44 contacts with affinity data at companies matching Thai/Asian/Chinese/foot massage patterns:

| Affinity | Count | Signal? |
|----------|-------|---------|
| GB (British) | 9 | Noise — English names at Asian businesses |
| TH (Thai) | 5 | **Genuine signal** |
| IT (Italian) | 4 | Noise |
| IE (Irish) | 3 | Noise |
| CN (China) | 2 | **Genuine signal** |
| VN (Vietnam) | 2 | **Genuine signal** |
| KH (Cambodia) | 2 | **Genuine signal** |
| HK (Hong Kong) | 1 | **Genuine signal** |
| JP (Japan) | 1 | **Genuine signal** |
| Other European/African | 14 | Noise |

**Conclusion:** Cultural affinity alone is too noisy for language barrier scoring — only ~30% of contacts at these businesses show Asian affinity. The majority show European affinity (likely from English-sounding owner names at businesses with Asian naming).

**Recommended approach:** Business name patterns are the primary signal. Cultural affinity is a secondary modifier — adds confidence when it aligns, but don't rely on it alone.

### Website presence at language-barrier companies
These companies are also less likely to have websites/domains, which limits other enrichment:
- Would need to run query 5b to quantify (not yet executed)

---

## 6. Apollo Blast Radius

| Metric | Value |
|--------|-------|
| Companies matching any filter | 3,043 |
| Already synced to Apollo | 2,915 (96%) |

96% of affected records are already in Apollo CRM. Filtering will prevent future waste, but existing Apollo records will need a separate cleanup decision (out of scope per scope doc Section 9).

---

## 7. Key Finding: Google Types Not Persisted

`enrich-companies.js` fetches `additional_types` from Google Places Details API (line 437) but does NOT include it in the Supabase PATCH payload (line 450). This means:
- Rich type data (e.g., `["physiotherapist", "health", "point_of_interest"]`) is available during enrichment but lost
- Category-based filtering relies solely on the `category` field from discovery, which is less granular
- **Recommendation:** Add `additional_types JSONB` column and include in PATCH. This enables much more precise filtering.

---

## 8. Recommendations for Phase 2 Implementation

### Priority 1 — Highest impact, lowest risk
1. **Expand `category_blocklist`** — Add ~16 new patterns (Chiropractor, Acupuncture, Medical Clinic, Gym, Yoga, Fitness, Doulas, Hospice, Sauna, Medical Spas, Resort hotel, etc.). All use existing safe-term exemption logic.
2. **Promote 9 report-only junk categories** to pipeline blocklist (Car repair alone is 622 companies).
3. **Add franchise brands** to `chain_blocklist` (Massage Envy, Hand & Stone, Elements, Massage Heights, Massage Luxe, LaVida, Spavia, Massage Green — 373 companies, 20 high-value confirmed as genuine franchises).

### Priority 2 — Medium impact
4. **Add name-pattern filters** to discovery normalization for: physical therapy, chiropractic, med spa, acupuncture, energy healing, float/salt, mobile practice. **Must include safe-term exemption** (if name contains Massage/Bodywork/Day Spa/Wellness/Therapeutic, skip the filter).
5. **Add mobile practice detection** (safest filter — 122 matches, 0 high-value at risk).
6. **Store `additional_types`** from Google Places in companies table.

### Priority 3 — Soft scoring, no records lost
7. **Language barrier soft scoring** — reduce lead_score by 15-25 points based on:
   - Business name patterns (Thai, Asian, Chinese, Korean, foot massage, reflexology) — primary signal
   - Contact-level cultural affinity (Asian regions: TH, CN, VN, KH, HK, JP, KR) — secondary modifier
   - Missing website/domain as additional signal

### Not recommended
- Retroactive deletion of existing records (flag/score instead)
- DC credential regex (too fragile, chiropractic name filter already catches most)
- Skin Care Clinic category filter (too much overlap with spa/esthetics)
- Relying on cultural affinity alone for language barrier scoring (too noisy at 30% signal rate)

---

## 9. False Positive Summary

| Filter | Records Reviewed | False Positives | Risk Level |
|--------|-----------------|-----------------|------------|
| Chiropractic | 29 high-value | 0 | Low (safe-term handles combos) |
| Physical Therapy | 13 high-value | 0 | Low (safe-term handles combos) |
| Franchise | 20 high-value | 0 | None (all Massage Heights) |
| Med Spa | 9 high-value | 0 | Low |
| Acupuncture | 6 high-value | 0 | Low (safe-term handles combos) |
| Energy Healing | 3 high-value | 0 | Low |
| Float/Salt | 1 high-value | **1** | **Needs safe-term on name filter** |
| Mobile Practice | 0 high-value | 0 | None |
| Language Barrier | 5 high-value | 0 | None (soft score only) |
| **Total** | **86** | **1** | **1.2% false positive rate** |

The single false positive ("Just Be Therapeutic Massage and Float Spa") is addressed by adding safe-term exemption to name-based filters — the same pattern already used in category filters.

---

## 10. Next Steps

1. **Sign off** on filter strategy and category decisions
2. **Phase 2 implementation:** category blocklist expansion → name filters → franchise filter → scoring
3. **Separate concern:** Existing Apollo records cleanup (2,915 records) — defer to Phase 3
