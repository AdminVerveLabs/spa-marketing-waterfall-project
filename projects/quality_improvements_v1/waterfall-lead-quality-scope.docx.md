# **Waterfall Lead Quality Improvements**

*Project Scope Document*  
VerveLabs • March 2026 • v1.0

## **1\. Background**

Analysis of 149 lead outcomes from recent outreach efforts revealed that approximately **67% of failed leads were preventable** through better filtering in the enrichment pipeline. These issues fall into two categories: businesses that should never have entered the pipeline (wrong business type, franchises, mobile practices) and businesses where outreach was ineffective due to communication barriers.

The current pipeline successfully discovers and enriches massage therapy businesses, but lacks filtering logic to exclude adjacent business types that appear in the same search results. Additionally, the pipeline does not account for language/communication factors that affect outreach success rates.

## **2\. Problem Statement**

| Problem | Records | Impact |
| :---- | :---- | :---- |
| Wrong business type entering pipeline | 75 | Wasted enrichment spend, wasted sales time |
| Language/communication barriers | 27 | Failed calls, poor conversion rates |
| Mobile/no brick-and-mortar practices | 7 | Poor product fit, low close rates |
| Franchise/chain locations | 4 | No decision-making authority |
| Contact quality issues | 5 | Unable to reach actual owner |

### **2.1 Wrong Business Type (75 records, 50%)**

Businesses that are adjacent to massage therapy but are not our target market are entering the pipeline. These businesses appear in Google Places and Yelp results for massage-related queries because they share some keywords or categories.

**Observed business types that should be excluded:**

* Physical therapy / rehabilitation clinics (16 records)  
* Chiropractic clinics (14 records)  
* Medical aesthetics / skincare / med spas (14 records)  
* Wellness centers that do not offer massage (7 records)  
* Acupuncture clinics (2 records)  
* Float/salt/biohacking therapy centers (2 records)  
* Energy healing / reiki / spiritual practices (3 records)  
* Other (nail salons, hair salons, cuddling services, hospice, etc.) (17 records)

### **2.2 Language/Communication Barriers (27 records, 18%)**

A significant portion of outreach calls (49% of Orum call failures) ended because the person who answered could not communicate effectively in English. These are legitimate massage businesses and our target market, but outreach is ineffective.

**Observed patterns:**

* Many have Asian-style business names (Thai Massage, Asian Spa, Chinese Massage, etc.)  
* Often specialize in foot massage or reflexology  
* Frequently have no website, or website is not in English  
* Owner/staff cultural background correlates with communication difficulty

**Important:** These businesses should NOT be hard-filtered out of the pipeline. They are legitimate prospects. Instead, they should be deprioritized in lead scoring so that sales efforts focus on higher-probability leads first.

### **2.3 Mobile/No Brick-and-Mortar (7 records, 5%)**

Mobile massage therapists who travel to clients rather than operating from a fixed location are poor fits for the service. They typically have lower revenue capacity, different marketing needs, and less ability to invest.

### **2.4 Franchise/Chain Locations (4 records, 3%)**

Franchise locations (Massage Envy, Hand & Stone, etc.) cannot make independent marketing decisions. Contacting them wastes time because the person on-site has no purchasing authority.

### **2.5 Contact Quality Issues (5 records, 3%)**

Some leads have correct business information but incorrect or unreachable contact data. Issues include: contact listed is not actually the owner, phone number never reaches decision-maker, or contact is an employee at a larger organization (hotel spa therapist listed as owner).

## **3\. Goals**

1. **Reduce wrong-business-type leads by 80%+** by implementing filtering in the discovery and enrichment phases  
2. **Deprioritize language-barrier-risk leads** in scoring so they appear lower in outreach queues (not excluded entirely)  
3. **Filter out mobile massage practices and franchise locations** before they consume enrichment resources  
4. **Preserve all legitimate massage therapy businesses** — filtering should be precise, not aggressive  
5. **Add tracking fields** so we can measure the impact of these changes and tune further

## **4\. Proposed Approach**

The implementation should add filtering logic at appropriate points in the existing pipeline. The exact implementation approach is left to engineering judgment, but the filtering should happen as early as possible to avoid wasting enrichment API calls on businesses that will be filtered out.

### **4.1 Wrong Business Type Filtering**

**Objective:** Prevent non-massage businesses from entering the pipeline.

**Available signals:**

* **Google Places category/type data:** The API returns category information that can distinguish physical therapists, chiropractors, acupuncturists, etc.  
* **Business name patterns:** Many excluded business types have distinctive naming patterns (e.g., "Physical Therapy" in name, "DC" suffix for chiropractors, "Med Spa", etc.)  
* **Website content (if available):** Service descriptions on the homepage can confirm or contradict the business type

**Recommended filtering point:** Discovery phase (Step 1\) and/or deduplication before Supabase insert. Category-based filtering should happen immediately on API response; name-based filtering can happen at insert time.

**Handling edge cases:** Some businesses offer multiple services (e.g., "Chiropractic & Massage Center"). The filtering should be precise — exclude only when the primary business type is clearly not massage therapy. When uncertain, let the lead through and flag for review rather than over-filtering.

### **4.2 Language Barrier Risk Scoring**

**Objective:** Identify leads with higher probability of communication barriers and deprioritize them in scoring (NOT filter them out).

**Available signals:**

* **Business name patterns:** Names containing region/ethnicity indicators (Thai, Asian, Oriental, Chinese, Korean, Vietnamese, etc.)  
* **Service type indicators:** "Foot massage", "Reflexology", "Body work" in business name  
* **Website presence/language:** No website, or website not in English  
* **NamSor cultural affinity:** Already captured for contacts — could inform company-level scoring

**Implementation:** Add a flag or score modifier in the scoring system. This should be a soft signal that reduces lead\_score, not a hard filter. The business remains in the pipeline and can still be contacted — just lower in the queue.

**Sensitivity note:** This scoring adjustment is based on observed outreach outcomes, not assumptions. The goal is sales efficiency, not discrimination. All businesses remain contactable.

### **4.3 Mobile Practice Filtering**

**Objective:** Filter out massage therapists who operate mobile-only practices without a physical location.

**Available signals:**

* **Business name patterns:** "Mobile", "House Call", "In-Home", "Traveling", "On-Site", "Outcall"  
* **Google Places address data:** Missing physical address or address type indicating approximate/service-area only  
* **Website content:** Indicators like "we come to you", "mobile massage", "outcall only"

### **4.4 Franchise/Chain Filtering**

**Objective:** Filter out known franchise locations that cannot make independent marketing decisions.

**Available signals:**

* **Known franchise brand names:** Massage Envy, Hand & Stone, Elements Massage, Massage Heights, Massage Luxe, LaVida Massage, Spavia, Massage Green, etc.  
* **Chain detection heuristic:** Multiple locations with identical or near-identical names in the same metro could indicate a chain (lower confidence signal)

## **5\. Phase 1: Investigation**

**Before implementing any filtering, we need to validate that the proposed filters will not inadvertently exclude legitimate massage therapy businesses.**

### **5.1 Audit Current Data**

* Query existing companies table to understand the distribution of Google Places categories  
* Identify how many existing "good" leads would be affected by each proposed filter  
* Sample businesses that match proposed exclusion patterns and manually verify they should be excluded  
* Identify any legitimate massage businesses that might be caught by name pattern filters (false positives)

### **5.2 Test Filter Logic in Isolation**

* Run proposed filters against existing data in read-only mode  
* Generate a report of what WOULD be filtered, grouped by filter type  
* Manually review a sample from each filter category to validate accuracy  
* Adjust filter criteria based on false positive findings

### **5.3 Document Findings**

* Create a summary of filter accuracy rates  
* Document any edge cases or businesses that need special handling  
* Get sign-off before proceeding to implementation

## **6\. Phase 2: Implementation**

Implementation details are left to engineering judgment. The following are requirements and constraints, not prescriptive solutions.

### **6.1 Schema Changes**

Add fields to track filter decisions and enable measurement:

* A way to flag businesses as mobile practices  
* A way to flag businesses as franchises  
* A way to flag businesses with language barrier risk  
* A way to track why a business was excluded (if we exclude rather than just flag)  
* Website language detection result (if implemented)

### **6.2 Filtering Logic**

* Implement hard filters for: wrong business type (category \+ name patterns), franchise brands, mobile practices  
* Implement soft scoring adjustments for: language barrier risk signals  
* Filtering should happen as early in the pipeline as the required data is available  
* Filtered records should either be excluded entirely OR marked and skipped in downstream processing (engineering decision based on debugging/audit needs)

### **6.3 Scoring Rules**

* Add scoring rules to the scoring\_rules table for new filter flags  
* Language barrier risk should subtract points (suggested: \-15 to \-25) but not exclude  
* Mobile practice and franchise flags could either hard-filter or apply large negative scores (engineering judgment)

## **7\. Phase 3: Validation**

### **7.1 Test Run**

* Run the updated pipeline against one metro area  
* Compare results to a previous run of the same metro  
* Verify that filtered businesses are genuinely not our target market  
* Verify that no legitimate massage businesses were incorrectly filtered

### **7.2 Metrics to Track**

* Number of businesses filtered by each filter type  
* False positive rate (legitimate businesses incorrectly filtered)  
* Enrichment cost savings (API calls avoided)  
* Lead score distribution changes  
* Outreach success rates (tracked over time after deployment)

## **8\. Success Criteria**

| Metric | Target |
| :---- | :---- |
| Wrong business type in pipeline | \< 10% of current rate |
| False positive rate (good leads filtered) | \< 2% |
| Language barrier calls in top 50% of leads | \< 10% (down from \~25%) |
| Franchise/chain leads | 0% |
| Mobile practice leads | \< 2% |

## **9\. Out of Scope**

* Retroactively filtering/removing existing records (focus on new discoveries)  
* Building a UI for managing filter rules (use Supabase Table Editor for now)  
* Automated outreach skipping based on filters (Apollo sync continues as-is; filtering affects what enters the pipeline)  
* Phone verification improvements (Telnyx 403 issue is a separate concern)  
* Hunter.io credit renewal (separate operational issue)

## **10\. Risks and Mitigations**

| Risk | Mitigation |
| :---- | :---- |
| Over-filtering removes good leads | Investigation phase validates filters before deployment; start with conservative patterns |
| Name patterns are too broad | Test against existing data; use word boundaries in regex; combine with other signals |
| Google category data is inconsistent | Use category as one signal among several; don't rely on it exclusively |
| Language barrier scoring is too aggressive | It's a soft score reduction only; affected leads remain contactable |
| New franchise brands emerge | Franchise list is maintainable in config; periodic review of filtered data |

## **Appendix: Reference Data**

*The following lists are starting points based on observed data. Engineering should validate and adjust during the investigation phase.*

### **A. Business Types Observed in Bad Leads**

Physical Therapy (16), Chiropractor (14), Medical Aesthetics/Skincare (14), Wellness Center no massage (7), Mobile Massage (6), Energy Healing/Reiki/Spiritual (3), Nail/Hair Salon (3), Senior Care/Hospice (3), Mental Health (2), Acupuncture (2), Float/Salt Therapy (2), Cuddling/Intimacy (4), Franchise (4), Bath House/Sauna (1), Lymphatic-only (2), Foot Massage only (1), Herbal/Aromatherapy retail (2), Birth/Doula (1), Resort employee (2), Wrong business entirely (7)

### **B. Known Franchise Brands**

Massage Envy, Hand & Stone, Elements Massage, Massage Heights, Massage Luxe, MassageLuXe, LaVida Massage, Spavia Day Spa, Massage Green Spa

### **C. Language Barrier Indicator Examples (from Orum calls)**

Business names: Katie Spa, Mi Mi Asian Massage, Yan Spa Massage, Ifeet Foot Massage, Arawan Thai Massage, H & W Spa, Dadada Spa, Chi Harmony Massage, Green Leaf Massage Spa, Bina Massage Therapy, Thai Herbal Bodywork, Sunny Massage Spa, Laguna Spa, J Wellness Massage Spa, Smiling Feet, Relaxation Day Spa