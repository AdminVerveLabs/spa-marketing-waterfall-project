# Rural Market Audit & Queue System — Handoff Document
**Date:** 2026-02-25
**Context:** Preparing to analyze SQL query results across 10 rural test metros

---

## Project: VerveLabs Spa Marketing Waterfall

**What it is:** Automated lead generation pipeline for spa/massage businesses. Discovers businesses via Google Places + Yelp, enriches company data (website, booking platform, socials), finds owner contacts (Apollo, solo detection, Hunter.io), and enriches people (NamSor cultural affinity, email/phone/LinkedIn).

**Stack:** n8n workflows on Hetzner VPS (CPX21, 4GB RAM) + Coolify + Supabase + React dashboard (planned).

**Pipeline Steps:**
- Step 1: Discovery (Google Places + Yelp via Apify)
- Step 2: Enrich Companies (website analysis, Google Places Details, social discovery)
- Step 3a: Find People (solo detection, Apollo, website scraping)
- Step 3b: Enrich Socials (SociaVault API)
- Step 4: Enrich People (NamSor cultural affinity, Hunter email, phone normalization)

**Key Schema Fields:**
- `companies.discovery_metro` — the metro that was SEARCHED (e.g., "Price, UT")
- `companies.city` / `companies.state` — where the business ACTUALLY is
- Comparing these two reveals radius blowout

---

## What We Did This Session

### 1. Preliminary Web Research on Rural Markets
Searched for spa/massage businesses in the 10 target small towns. Found:
- **Vernal, UT** has solid coverage (5-7 businesses with websites, Pure Bliss Day Spa has 8 therapists)
- **Scottsbluff, NE** has handful of solo practitioners
- **Durango, CO** is tourist town, probably second strongest
- **Price, UT / Elko / Alice / Lewistown / Clovis / Riverton / Sterling** — expect 2-5 businesses each

Identified three supplementary sources worth adding later:
1. **MassageBook directory** (massagebook.com/search) — 10,000+ businesses, biggest untapped source for solo practitioners
2. **State licensing board databases** — full names + verified status for everyone legally practicing
3. **massagetherapy.com / themassagesource.com** — solo rural practitioners with profiles

### 2. Analyzed 4 Excel Reports (Price UT, Sterling CO, Vernal UT, Riverton WY)

#### Price, UT — Radius blowout into Utah Corridor
- 64 total records but only 12 actually in Price
- Spread across 22 metros (Provo, Orem, SLC, etc.)
- Only 1 contact name (Jeff Manley via solo_detection)
- 0 emails for Price businesses
- False positive: "A Perfect Smile" dental clinic

#### Sterling, CO — Worst radius blowout
- 37 sendable leads but 30 are "Denver Area, CO"
- Zero actual Sterling businesses in sendable leads
- Essentially returned the entire Front Range corridor

#### Vernal, UT — Best rural result
- 21 of 33 sendable leads actually in Vernal
- Found real businesses confirmed by web research (Pure Bliss, Massage Tactics, Vivid Healing)
- This is what a good rural run looks like

#### Riverton, WY — Decent
- 11 of 23 leads actually in Riverton
- Nearby Wyoming towns (Lander, Saratoga, Thermopolis) make sense as same market
- Hunter found 5 emails

### 3. Identified Three Systematic Problems

**Problem A: British Columbia / Ontario Ghost Leads**
Same phantom businesses appear in EVERY report:
- "Against the Grain RMT" (Surrey, BC)
- "Queen's Park Massage Therapy" (New Westminster, BC)
- "Royal Treatment Therapeutics" (Burnaby, BC)
- "AHC Wellness Clinic" (Toronto, ON)
- "Oceana Massage" (Vancouver, BC)

Likely caused by "RMT" (Registered Massage Therapist) being a Canadian search term that's matching somehow. Systematic contamination, not one-off.

**Problem B: Radius Blowout**
When local market is thin, Google Places expands search area until it finds enough results. Sterling→Denver, Price→Utah corridor. Need either:
- Hard radius cap (e.g., 50 miles for rural)
- Post-discovery filtering by distance from target metro centroid

**Problem C: Category/Chain Leakage**
Junk businesses slipping through:
- Categories: Dental Clinic, Mover, Manufacturer, Store, Cosmetics Store, Tanning Salon, Sports Activity Location, Nail Salon (debatable)
- National chains: Ulta Beauty, Sally Beauty, Massage Envy
- Non-spa businesses: Revolution Machine Tools, RMT Equipment, Premier Bone & Joint Centers, Merrell Footlab, Soulful Strides Sanctuary Equine Therapy

### 4. Proposed Queue System for Mass Rural Processing

**Core insight:** Instead of fighting for 60 leads from one hard metro, run 500+ easy metros at 8-15 leads each = 40,000-75,000 businesses.

**Architecture:**
- `pipeline_queue` table in Supabase: `metro_name, state, population, status (pending/running/complete/failed), leads_found`
- n8n wrapper: cron/schedule trigger → fetch next `pending` → set `running` → execute Steps 1-4 → mark `complete`
- One metro at a time, no VPS overload
- Metro seed list from Census data (~5,000 towns with pop 5,000-50,000)

**Estimated dev time:** 6-8 hours total (was 10-14 before Zack correctly noted Supabase↔n8n connection is already battle-tested)

**Prerequisites before queue works well:**
1. Fix radius blowout (geo-filter post-discovery) — ~1.5 hrs
2. Fix category/chain blocklist — ~0.5 hrs
3. Build queue table + wrapper workflow — ~3-4 hrs
4. Source metro seed list — ~1-2 hrs

---

## What Happens Next

### Immediate: Analyze SQL Query Results
Zack ran the pipeline for all 10 test metros:
- Price, UT (39.5994, -110.8107)
- Sterling, CO (40.6255, -103.2078)
- Vernal, UT (40.4555, -109.5287)
- Riverton, WY (42.8616, -108.3801)
- Scottsbluff, NE (41.8666, -103.6672)
- Lewistown, MT (47.0494, -109.4281)
- Alice, TX (27.7523, -98.0697)
- Elko, NV (40.8324, -115.7631)
- Durango, CO (37.2753, -107.8801)
- Clovis, NM (34.4048, -103.2052)

13 SQL audit queries were created (`rural-audit-queries.sql`) to analyze results across all 10 metros. Key queries:
- **Q11:** On-Target Rate — which metros have the worst radius blowout
- **Q3:** Country Contamination — BC/ON ghost lead count
- **Q5:** Suspect Categories — full blocklist needed
- **Q13:** Quick Summary Card — one row per metro dashboard

Zack will paste/upload query results for analysis. From that we'll:
1. Finalize the blocklist (categories + chains + countries)
2. Determine radius cap parameters
3. Confirm the queue system design is viable
4. Hand off to Claude Code for implementation

### After Analysis: Implementation Order
1. Radius geo-filter in Step 1 or post-Step 1
2. Category + chain blocklist
3. `pipeline_queue` table + metro seed list
4. n8n queue wrapper workflow
5. Test with 10-20 small towns
6. Scale to full run

### Future Enhancements (not blocking queue)
- MassageBook scraper as supplementary Step 1 source (+4-6 hrs)
- State licensing board scrapers
- Hunter Email Verifier integration in Step 4
- Layer 1 validation node (email/phone/name cleaning)
- React dashboard for monitoring queue progress
- Sub-workflow architecture for 500+ company metros

---

## Key Files & Resources

| Resource | Location |
|---|---|
| Architecture doc | `/mnt/project/spa-waterfall-architecture__1_.docx` |
| Supabase schema | `/mnt/project/supabase-schema.sql` |
| Steps 1-3a workflow | `/mnt/project/Spa_Marketing_Step_3a_-_Find_People.json` |
| Step 4 workflow | `/mnt/user-data/outputs/step4-enrich-people.json` |
| SQL audit queries | `/mnt/user-data/outputs/rural-audit-queries.sql` |
| Previous transcript (Step 4 build) | `/mnt/transcripts/2026-02-25-01-34-16-step4-enrich-people-implementation-runner-fixes.txt` |
| Previous transcript (Step 4 planning) | `/mnt/transcripts/2026-02-19-23-33-57-spa-step4-people-enrichment-planning.txt` |
| Validation design | `/mnt/user-data/uploads/layer1-validate-clean-contact.md` |

---

## Important n8n Patterns (for Claude Code)

- `runOnceForEachItem`: uses `$input.item.json`, returns `{json:...}` not `[{json:...}]`
- `runOnceForAllItems`: uses `$input.all()`, returns array of `{json:...}`
- IF nodes need `typeValidation=loose`
- HTTP fullResponse returns data in `.data` not `.body`
- Supabase upsert needs `Prefer: resolution=merge-duplicates` header
- Error handling: `onError: continueRegularOutput` prevents single failures from breaking batches
- Task runner limit: ~150-200 companies per execution after runner fix
- Bridge nodes between steps: collapse multi-item outputs to single trigger item
