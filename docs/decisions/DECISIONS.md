# Architecture Decision Records

## ADR-001: Use HTTP Request nodes instead of n8n Supabase connector
- **Date:** 2026-02 (pre-repo)
- **Decision:** All Supabase calls use HTTP Request nodes with service key auth
- **Reason:** n8n's Supabase connector has limited functionality. HTTP nodes give full control over headers (especially `Prefer: resolution=merge-duplicates` for upserts).
- **Status:** Active

## ADR-002: Layer 1 validation in Step 3a, Layer 2 verification in Step 4
- **Date:** 2026-02-17
- **Decision:** Format validation happens before insert (Layer 1), deliverability verification happens in enrichment (Layer 2)
- **Reason:** Layer 1 catches obviously bad data before it enters DB. Layer 2 uses paid API credits (Hunter) and should run on cleaner data.
- **Status:** Active

## ADR-003: Map Hunter statuses to 5-value email_status enum
- **Date:** 2026-02-17
- **Decision:** email_status uses: unverified, verified, invalid, risky, accept_all
- **Mapping:** Hunter valid→verified, invalid→invalid, accept_all→accept_all, disposable→invalid, webmail→verified, unknown→risky
- **Reason:** Covers all actionable states for outreach decisions. accept_all kept separate because these emails technically "work" but may not be monitored.
- **Status:** Active

## ADR-004: Invalid emails get nulled in DB
- **Date:** 2026-02-17
- **Decision:** When Hunter returns invalid/disposable, set email_business=NULL but keep email_status='invalid'
- **Reason:** Prevents sending to dead addresses. Status preserved for audit trail.
- **Status:** Active

## ADR-005: Role-based emails routed to company, kept on contact if only email
- **Date:** 2026-02-17 (decided), 2026-02-18 (implemented)
- **Decision:** Instead of blanket-rejecting info@/contact@, route to company.email. Keep on contact if it's the only email. Promote email_personal to email_business when role-based goes to company.
- **Reason:** Solo practitioners' info@ IS their inbox. Rejecting it loses the only contact channel. For multi-person businesses, the role-based email is a company inbox, not a personal contact.
- **Implementation:** Layer 1 (Validate & Clean Contact) flags but keeps role-based emails. Step 4 (Enrich Contacts) detects role-based pattern, checks free webmail exclusion, routes to company.email if company has no email, promotes personal email if available.
- **Status:** Active — deployed Session 10

## ADR-007: Replace Step 4 branching pipeline with single Code node
- **Date:** 2026-02-17
- **Decision:** Remove all 31 nodes in Step 4's email waterfall (IF→HTTP→Parse→Collect chain) and replace with a single `Enrich Contacts` Code node that processes each contact sequentially in a loop.
- **Reason:** The n8n batching bug creates separate execution batches when multiple paths converge on one node. With 7 convergence points in Step 4, only 1 of 13 contacts got verified. Multiple fix attempts (Merge nodes, Collect nodes with `.all()`) all failed because the fundamental issue is architectural: n8n cannot reliably merge items from different execution paths.
- **Alternatives considered:**
  1. Fix the existing convergence with better Merge strategies → Failed in practice
  2. Use n8n's Loop Over Items node → Would still have convergence at the API result parsing stage
  3. Single Code node with inline HTTP requests → **Chosen** — eliminates convergence entirely
- **Trade-offs:** The Code node is 250 lines and harder to debug visually in n8n's UI. But it works correctly, which the branching approach did not.
- **Status:** Active — implemented in `workflows/generated/spa-waterfall-fixed.json`

## ADR-008: Use $getWorkflowStaticData() for cross-batch deduplication
- **Date:** 2026-02-18
- **Decision:** Use n8n's `$getWorkflowStaticData('global')` in `Filter & Merge Contacts` to track which contact IDs have been processed across convergence-induced duplicate batches.
- **Reason:** Steps 1-3 have 13 convergence points that cause 4 execution batches to reach Step 4. Supabase-based dedup (email_status filter) failed because batches overlap and the CHECK constraint doesn't allow custom status values. Static data persists within a single execution and is shared across all batch invocations of the same node.
- **Alternatives considered:**
  1. Supabase email_status filter → Failed: batches overlap + CHECK constraint rejects 'no_email'
  2. Restructure Steps 1-3 convergence → Too large a change for the current milestone
  3. Static data dedup → **Chosen** — minimal code change, works within existing architecture
- **Trade-off:** Static data persists across executions, so `_enrichedContactIds` accumulates. For now this is fine — the IDs are lightweight strings. May need periodic cleanup if execution volume is high.
- **Status:** Active — implemented in execution 100

## ADR-009: Use this.helpers.httpRequest() instead of $http.request() in Code nodes
- **Date:** 2026-02-18
- **Decision:** All HTTP requests inside n8n Code nodes must use `this.helpers.httpRequest()`, not `$http.request()`.
- **Reason:** `$http` is not defined in the n8n Code node sandbox. `this.helpers.httpRequest()` is the correct built-in helper that uses axios internally.
- **Key differences from $http:** Response is returned directly as parsed JSON (no `.body` wrapper). POST body should be a JavaScript object (not `JSON.stringify()`). Always include `json: true` in options.
- **Status:** Active

## ADR-010: Domain blocklist + PATCH payload scoping
- **Date:** 2026-02-18
- **Decision:** (1) Add a 20-platform booking domain blocklist at all 3 domain extraction points (Normalize Google Results, Normalize Yelp Results, Extract & Patch Domain). (2) Scope the company PATCH payload in `Prepare Company Update` to only include `domain`, `google_place_id`, `google_rating`, `google_review_count` from `_backfill_patch` (not from the item directly).
- **Reason:** (1) Booking platform subdomains (wixsite.com, schedulista.com, etc.) are not real company domains. Using them wastes Hunter Finder API credits and returns no results. (2) Including `domain` in every company PATCH causes 409 unique constraint violations when duplicate company rows exist (BUG-002). Scoping to `_backfill_patch` ensures domain is only PATCHed when it was actually discovered via the backfill path.
- **Blocklist (20 platforms):** wixsite.com, wix.com, setmore.com, schedulista.com, glossgenius.com, square.site, genbook.com, jane.app, acuityscheduling.com, mindbodyonline.com, mindbody.io, vagaro.com, fresha.com, schedulicity.com, booksy.com, massagebook.com, noterro.com, clinicsense.com, calendly.com, squarespace.com
- **Matching logic:** Exact match OR `.endsWith('.' + blocked)` to catch subdomains (e.g., `calmspa.wixsite.com` matches `wixsite.com`).
- **When blocked:** `domain=''`, `has_website=false` (at discovery), `_domain_blocked=true`, `_domain_blocked_platform=<platform>`. In backfill: domain excluded from `_backfill_patch`.
- **Additional fix:** `Merge Website Results` needed `_backfill_patch` pass-through — it was constructing the output object explicitly and dropping backfill data.
- **Trade-offs:** Squarespace/Wix sites could be real business websites, not just booking platforms. However, domain-based email search (Hunter Finder) won't work with these shared hosting domains. If needed, individual Wix site URLs can be allowlisted later.
- **Status:** Active

## ADR-011: Supabase RPC for lead scoring
- **Date:** 2026-02-19
- **Decision:** Lead scoring implemented as a Supabase PL/pgSQL function (`calculate_lead_scores()`) called via RPC from n8n, rather than scoring logic in an n8n Code node.
- **Reason:** Scoring rules live in a `scoring_rules` table — configurable without workflow changes. The function loops through active rules and applies each as a dynamic UPDATE. This keeps scoring logic in the database where it can also be called from the dashboard, cron jobs, or manual SQL.
- **Alternatives considered:**
  1. n8n Code node with hardcoded scoring logic → Would require workflow deploy for every rule change
  2. Supabase Edge Function → Overkill for simple rule application; PL/pgSQL is faster for row-level updates
  3. Supabase trigger on scoring_rules changes → Unnecessary; next pipeline run recalculates everything
- **Implementation:** `SECURITY DEFINER` (bypasses RLS) + `WHERE TRUE` on reset UPDATE (Supabase PostgREST requires WHERE clause). Called via HTTP POST to `/rest/v1/rpc/calculate_lead_scores`. `neverError: true` on the HTTP node so scoring failure doesn't break the enrichment pipeline.
- **Status:** Active — deployed Session 15

## ADR-012: Business type blocklist for discovery normalization
- **Date:** 2026-02-19
- **Decision:** Add a keyword-based blocklist to `Normalize Google Results` and `Normalize Yelp Results` that filters out non-target businesses (massage schools, professional associations, regulatory bodies, training institutes) BEFORE they enter Supabase.
- **Keywords (10):** school, college, university, association, federation, union, board of, institute, academy, program
- **Matching:** Case-insensitive partial match on business name OR category. If any keyword is found in either field, the business is excluded from results.
- **Reason:** Austin data inspection (Session 9) found 5 non-target businesses: massage schools, AMTA (professional association), a UK trade union, and regulatory bodies. These waste API credits in downstream enrichment and pollute lead data.
- **Implementation:**
  - Google: `BUSINESS_TYPE_BLOCKLIST.some(kw => nameLower.includes(kw) || catLower.includes(kw))` → return null, then `.filter(Boolean)` at end of `.map()`
  - Yelp: Same check → `continue` inside the for loop
- **Trade-offs:** Partial match on "union" could catch legitimate businesses (e.g., "Union Square Massage"). However, for the massage therapy vertical, "union" almost exclusively means trade unions. Can be refined if false positives appear.
- **Status:** Active — deployed Session 16

## ADR-006: Add email + email_status columns to companies table
- **Date:** 2026-02-17 (decided), 2026-02-18 (implemented)
- **Decision:** `companies.email` = general business address (TEXT), `companies.email_status` = verification status (same CHECK constraint as contacts: unverified/verified/invalid/risky/accept_all). No DEFAULT — stays NULL until populated.
- **Reason:** Separates business addresses from personal addresses. Enables role-based email handling (ADR-005). Two sources: website HTML scraping (Step 2) and role-based email routing (Step 4).
- **First-write-wins rule:** Website scrape (Step 2) writes first. Step 4 routing only writes if company.email is still null. No overwrites between sources.
- **Verification:** Company emails verified inline in Step 4 via Hunter Verifier (1 credit per unique company per execution). Dedup guard prevents duplicate verification calls.
- **Status:** Active — deployed Session 10

## ADR-013: Metro-scoped pipeline execution
- **Date:** 2026-02-19
- **Decision:** Add `discovery_metro` filter to all Supabase fetch nodes in Steps 3a and 4 so each pipeline run only processes companies and contacts belonging to the current metro.
- **Nodes modified:**
  1. `Fetch Companies` (Step 3a): Added `&discovery_metro=eq.{{ $('Metro Config').first().json.metro_name }}` to URL
  2. `Fetch Companies1` (Step 4): Same metro filter added to URL
  3. `Filter & Merge Contacts` (Step 4): Added `.filter(c => companyMap[c.company_id])` to exclude contacts from non-metro companies. Since companyMap is built from the now-metro-scoped Fetch Companies1, this implicitly filters contacts by metro.
- **Reason:** Exec #121 (Denver) revealed that Steps 3a and 4 had no metro filtering — they processed ALL companies/contacts globally. Step 4 processed 37 Austin contacts instead of Denver ones, resulting in `has_updates = false` for everything (already enriched). This is cross-metro data contamination.
- **Deferred:** `Fetch Existing Contacts` (Step 3a) still has no metro filter. It fetches ALL contacts globally for the dedup check. Not causing data corruption (Filter & Parse Batch handles the logic). With ~200 contacts, query takes 661ms — revisit when contacts table reaches thousands.
- **Deferred:** `Fetch Contacts` (Step 4) still has no metro filter. It fetches all unverified contacts globally. The downstream `Filter & Merge Contacts` node now filters these to only metro-matching ones via the companyMap check.
- **Status:** Active — deployed Session 17

## ADR-015: Static data lifecycle — clear companyEmailsSet at execution start
- **Date:** 2026-02-19
- **Decision:** Clear ALL keys from `$getWorkflowStaticData('global')._companyEmailsSet` at the start of each Enrich Contacts execution, before processing any contacts.
- **Reason:** `$getWorkflowStaticData('global')` persists across workflow EXECUTIONS, not just batches within an execution. This caused BUG-F019: company phone verification was permanently blocked because `_phone_verified` keys from exec #129 persisted into all future runs. The same issue affects email dedup guards and company email routing guards — any key set in `companyEmailsSet` during one execution would permanently block that operation in future executions.
- **Why clear ALL keys (not just _phone_verified):** The `companyEmailsSet` object is used for 3 types of dedup guards: (1) `companyId + '_phone_verified'` — company phone verification, (2) `companyId` — company email routing, (3) `companyId + '_email_verified'` — company email verification. All of these are per-execution dedup guards — they prevent duplicate API calls within a single run. Clearing only `_phone_verified` keys (v1) would leave the other keys as ticking time bombs. Clearing everything is safe because keys are rebuilt from scratch as contacts are processed within each execution.
- **Alternatives considered:**
  1. Clear only `_phone_verified` keys → v1 approach, incomplete fix (other key types still persist)
  2. Use a different data structure per execution (e.g., keyed by execution ID) → More complex, unnecessary
  3. Don't use static data at all → Would require restructuring the dedup mechanism (currently relied on for cross-batch dedup within an execution)
- **Trade-off:** Clearing everything means the first contact in each batch within an execution might re-do a company operation that a previous batch already handled. However, the company PATCH/verify operations are idempotent, so this only costs a few extra API calls per execution — negligible.
- **Status:** Active — deployed Session 22

## ADR-016: Prepare for Supabase field whitelisting audit
- **Date:** 2026-02-19
- **Decision:** Add `discovery_metro` to the Prepare for Supabase Code node's explicit field whitelist. Establish a rule: when adding a new field to the pipeline, audit ALL nodes in the insert chain (Normalize → Deduplicate → Prepare for Supabase → Insert to Supabase → Insert Flagged).
- **Reason:** Session 17 added `discovery_metro` to the Normalize nodes, Insert to Supabase, and Insert Flagged, but missed Prepare for Supabase. This node explicitly constructs the INSERT payload with named fields — any field not listed is silently dropped. The result: 121 Phoenix companies inserted with `discovery_metro = NULL`, making them invisible to all metro-scoped fetch nodes.
- **Context:** The Insert Node Field Whitelisting pattern (documented in MEMORY.md) identified the Insert nodes as the whitelist gate, but Prepare for Supabase is an upstream transform that ALSO whitelists fields. It was missed because Deduplicate Records uses `{...item}` spread (passes everything through), creating a false sense that fields flow transparently to the Insert nodes.
- **Insert chain audit checklist:**
  1. `Normalize Google Results` / `Normalize Yelp Results` — field must be set
  2. `Deduplicate Records` — uses spread operator, passes through (OK)
  3. `Prepare for Supabase` — **MUST explicitly include field** (this was the gap)
  4. `Insert to Supabase` / `Insert Flagged (Needs Review)` — HTTP body from upstream (OK if step 3 passes it)
- **Status:** Active — deployed Session 24

## ADR-014: Telnyx phone verification (Level 2)
- **Date:** 2026-02-18
- **Decision:** Add phone number verification via Telnyx Number Lookup API ($0.003/lookup) to Step 4, verifying both contact phones and company phones. Controlled by `skip_phone_verifier` toggle (starts disabled).
- **Schema:** `phone_status` (valid/invalid/disconnected/voip), `phone_verified_at`, `phone_line_type` (mobile/landline/voip/toll_free), `phone_carrier` on contacts. `phone_status`, `phone_line_type` on companies. `phone_status` defaults to NULL (not 'unverified') — lesson from BUG-F010.
- **Nodes modified (6):**
  1. `Step 4 Config`: Added `skip_phone_verifier="true"` toggle
  2. `Fetch Contacts`: Expanded filter to `or=(email_status.is.null,email_status.eq.unverified,and(phone_direct.not.is.null,phone_status.is.null))` — catches contacts with verified email but unverified phone. Added `phone_status,phone_line_type,phone_carrier` to select.
  3. `Fetch Companies1`: Added `phone_status,phone_line_type` to select
  4. `Filter & Merge Contacts`: Added `phoneNeedsVerification` to enrichment filter, passes through `_company_phone_status` and `_company_phone_line_type`
  5. `Enrich Contacts`: Added `verifyPhone()` helper (mirrors `verifyEmail()` pattern). Contact phone block + company phone block with dedup guard. Invalid/disconnected phones → `phone_direct = null` (keep status for audit).
  6. `Run Summary4`: Added `phone_verification` section with valid/invalid/voip/disconnected/company counts
- **Alternatives considered:**
  1. Twilio Lookup v2 ($0.015/lookup) → 5x more expensive, no HLR
  2. Vonage Insight Advanced ($0.03/lookup) → Most detailed but 10x Telnyx price
  3. NumVerify (free-$0.003) → Cheap but less reliable, no HLR
- **Trade-offs:** First run after enabling will re-fetch contacts with verified email + unverified phone (one-time catch-up). VoIP numbers are kept (not rejected) because many small businesses use Google Voice/Grasshopper.
- **Status:** Active — deployed Session 20, starts disabled (skip_phone_verifier="true")

## ADR-018: Scaled search configuration
- **Date:** 2026-02-19
- **Decision:** Scale up discovery parameters: 12 search queries per metro (was 5), Yelp searchLimit 100 (was 20), per-metro radius (15-25km instead of fixed 15km), batch_size 1000 (was 100→300→1000).
- **Search queries (12):** massage therapy, massage clinic, RMT, spa massage, massage therapist, therapeutic massage, deep tissue massage, sports massage, prenatal massage, massage near me, licensed massage therapist, bodywork
- **Reason:** Initial 5-query, 20-limit config yielded ~60-80 unique businesses per metro. Massage therapy is a dense vertical — larger metros have 200+ businesses that we were missing. The 12 queries provide better coverage across specialties.
- **Per-metro radius:** Boise uses 25km (sparse market), others use 15km (dense markets). Configured in METROS lookup table.
- **batch_size at 1000:** With 12 queries yielding 300-400 unique companies per metro, 1000 provides ample headroom. No API cost increase — batch_size only affects how many companies are fetched from Supabase per step.
- **Trade-offs:** More Apify API calls (12 Yelp scrapes × ~$0.01 each = ~$0.12/metro). One Boise run hit Apify memory limits with searchLimit=100 — may need to reduce for very large metros.
- **Status:** Active — deployed Session 26

## ADR-019: Company phone as primary outreach channel
- **Date:** 2026-02-19
- **Decision:** Recognize that for local massage therapy businesses, the company phone number (from Google Places) is the primary outreach channel, not personal email.
- **Reason:** After running 6 metros (Austin, Denver, Phoenix, Toronto, San Diego, Boise), Apollo consistently returns ~0% contacts for massage therapy businesses. These are small/solo businesses that don't have LinkedIn profiles or corporate email addresses. The enrichment waterfall (Apollo → Hunter → NamSor) adds minimal value. The pipeline's real value is: (1) Google Places discovery → company phone, (2) website scraping → company email, (3) solo practitioner detection → owner name.
- **Implications:**
  - Lead scoring should weight company phone + company email more heavily than personal contact data
  - Outreach strategy should focus on phone calls and general email, not personalized email
  - Apollo API credits may be better spent on other verticals (if we expand beyond massage therapy)
- **Status:** Active — informational, no code changes required

## ADR-020: Resilient enrichment fetch — include partially_enriched companies
- **Date:** 2026-02-19
- **Decision:** Change `Fetch Batch from Supabase` (Step 2) URL filter from `enrichment_status=eq.discovered` to `enrichment_status=in.(discovered,partially_enriched)`.
- **Reason:** Boise exec #146 discovered 174 companies but Step 2 only enriched 50. Prior failed runs (#143 Apify memory, #144 task runner timeout) left 124 companies at `partially_enriched` status. The original `eq.discovered` filter excluded them, creating an enrichment gap that required manual SQL intervention.
- **Why this is safe:** The enrichment pipeline is idempotent. Website scraping checks for existing data before fetching. Google Details doesn't overwrite existing data. Social profile insertion uses conflict resolution. Re-enriching a `partially_enriched` company just fills in whatever was missed during the failed run.
- **Alternatives considered:**
  1. Reset `enrichment_status` to `discovered` in the Insert to Supabase upsert (Step 1) → Risky: would reset genuinely completed enrichments if the company is rediscovered
  2. Add a separate "retry failed companies" step → Overcomplicated for a simple filter change
  3. Manual SQL reset before each re-run → Not sustainable, requires human intervention
- **Also deployed:** batch_size raised from 300 to 1000 in all 3 config nodes, providing headroom for metros with 300-400 unique companies.
- **Status:** Active — deployed Session 26

## ADR-021: REVERTED — Inline HTTP fetch in Filter & Parse Batch
- **Date:** 2026-02-19
- **Decision:** REVERTED in Session 28. The change was based on false premises.
- **Original claim:** `Fetch Existing Contacts` returned 147,195 items causing 1h+ execution times.
- **Actual facts:** Supabase has ~197 contacts. In exec #141, the node returned 9,322 items in 661ms. Boise failures (#142-146) were caused by Apify memory limits and n8n worker instability, not slow queries.
- **Lesson:** Always verify claims against actual execution data before deploying fixes. The "147,195" number was hallucinated.
- **Status:** REVERTED — Session 28

## ADR-017: Dynamic Metro Config (webhook-driven metro selection)
- **Date:** 2026-02-19
- **Decision:** Replace the static Metro Config Set node (which required manual MCP updates for each metro) with a dynamic Code node that reads `metro_name` from the webhook query parameter and looks up coordinates from a built-in `METROS` lookup table.
- **Reason:** Running a new metro previously required updating 6 fields in the Set node via MCP before each run. This was error-prone, required a session to be active, and blocked autonomous metro switching. With the dynamic approach, any supported metro can be triggered via `?metro_name=City, ST` without any workflow changes.
- **Implementation:**
  - Node type changed from `n8n-nodes-base.set` (typeVersion 3.4) to `n8n-nodes-base.code` (typeVersion 2)
  - Same node name "Metro Config", same position [-10960, 192] — connections unchanged
  - `METROS` lookup object contains all supported metros with lat/lng/yelp_location
  - Shared defaults: `radius_meters: "15000"`, `search_queries: "massage therapy,massage clinic,RMT,spa massage,massage therapist"`
  - Throws descriptive error if metro_name is missing or unknown
  - Output shape identical to previous Set node: `{ metro_name, latitude, longitude, radius_meters, search_queries, yelp_location }`
- **Initial metros:** Austin TX, Denver CO, Phoenix AZ, Toronto ON, San Diego CA
- **Adding new metros:** Edit the METROS object in the Metro Config Code node — add a new key with lat/lng/yelp_location
- **Also removed:** Disconnected "When clicking 'Execute workflow'" manual trigger node (124 nodes, down from 125)
- **Alternatives considered:**
  1. Keep Set node, update via MCP before each run → Too manual, requires active session
  2. External config table in Supabase → Overkill; metro list is small and rarely changes
  3. Accept any lat/lng via query params → Unsafe; could target arbitrary locations outside our market
- **Status:** Active — deployed Session 25

## ADR-024: Convergence batch suppression via static data guards
- **Date:** 2026-02-20
- **Decision:** Add `$getWorkflowStaticData('global')` guards to `Collapse to Single2` and `Collapse to Single1` so they fire exactly once per execution. Add per-contact dedup in `Enrich Contacts` for remaining unsuppressed convergence batches. Clear all flags in `Metro Config` at execution start.
- **Reason:** n8n's multi-path convergence creates separate execution batches per upstream path. When 7 paths converge on Collapse to Single1, it fires 7 times, multiplying all downstream steps. This caused ~9x redundant Step 4 execution, ~404 enrichment API calls for ~91 actual contacts, and execution timeouts/runner instability.
- **Implementation:**
  - `Collapse to Single2`: Checks `staticData._collapse2_fired` — returns `[]` if already fired, sets flag and returns trigger item on first call
  - `Collapse to Single1`: Same pattern with `staticData._collapse1_fired`
  - `Enrich Contacts`: Tracks `staticData._enriched_contact_ids[contactId]` — skips contacts already enriched in earlier batches
  - `Metro Config`: Deletes `_collapse1_fired`, `_collapse2_fired`, `_enriched_contact_ids` at execution start
- **Why NOT suppress Collapse to Single3 and Collapse to Single:**
  - `Collapse to Single3` feeds into Step 4 contact enrichment. Contacts from slower paths (Apollo, About Page) may not be in Supabase yet when first batch fires. Suppression = data loss.
  - `Collapse to Single` feeds `Fetch Companies1` which must pair with `Fetch Contacts`. Suppression breaks the merge.
  - Both safe because per-contact dedup in Enrich Contacts prevents redundant API calls.
- **Data loss analysis:** Zero for all critical data. Minor: some social profiles may miss SociaVault engagement metrics on first pass.
- **Results:** Exec #154 — first clean `status: success` in project history. 17m 7s, 92 nodes, 0 runner crashes.
- **Status:** Active — deployed Session 30

## ADR-025: Stabilization polling in Collapse to Single2 (Step 1→2 timing fix)
- **Date:** 2026-02-20
- **Decision:** Replace the simple fire-once guard in `Collapse to Single2` with a stabilization polling loop that waits for all Step 1 inserts to complete before triggering Step 2.
- **Reason:** After ADR-024 convergence batch suppression, Collapse to Single2 fires on the first batch (Google results, ~5s) and suppresses subsequent batches (Yelp results, 60-120s). This means Step 2 starts before Yelp companies are in Supabase, leaving them stuck in `discovered` status permanently. In Austin TX, 119 of 219 companies were never enriched.
- **Root cause:** `Merge All Sources` (typeVersion 3, Append mode) fires per-input. Google results flow through Insert → Collapse to Single2 (fires, sets ADR-024 flag) → Step 2 starts. Yelp results arrive 60-120s later → Insert → Collapse to Single2 (suppressed by flag) → those companies never fetched by Step 2.
- **Why only Collapse to Single2:** This is the only transition where data arrives via fundamentally different timing (Google fast vs Yelp slow). After Step 2, all companies are updated to `partially_enriched` before the social processing split, so Steps 3a+ always get all companies.
- **Implementation:** After setting the ADR-024 suppression flag, the node enters a polling loop:
  - Polls Supabase every 15s: `SELECT id FROM companies WHERE enrichment_status='discovered' AND discovery_metro=<metro>`
  - When count is stable for 2 consecutive checks (30s), all inserts are done
  - Max wait: 10 × 15s = 150s (enough for Apify which typically takes 60-90s)
  - Uses `this.helpers.httpRequest()` for Supabase queries (ADR-009 pattern)
- **Results:** Exec #155 (Austin TX) — Collapse to Single2 took ~45s (3 poll cycles). Detected `_discovered_count: 118`. Step 2 fetched and enriched 216 companies (118 discovered + 98 partially_enriched). All 5 steps succeeded. 0 errors.
- **Trade-offs:** Adds 30-45s of latency to pipeline start (waiting for count stability). Acceptable given Yelp/Apify already takes 60-120s.
- **BUG-028 amendment (Session 32):** Added `count > 0` guard to prevent stabilization at 0. Exec #156 (San Diego) revealed that when n8n task runner schedules Insert to Supabase AFTER the polling loop (due to contention), polling stabilizes at 0 discovered companies. Also increased max iterations from 10 to 30 (450s max) for safety margin under heavy load.
- **Also updated:** `scripts/actionable-leads.sql` — removed `enrichment_status` filter to show all companies with any outreach channel regardless of enrichment status.
- **Status:** Active — deployed Session 31

## ADR-026: Stabilization polling in Collapse to Single1 (Step 2→3 timing fix)
- **Date:** 2026-02-20
- **Decision:** Replace the simple fire-once guard in `Collapse to Single1` with a stabilization polling loop that waits for Step 2 to finish enriching ALL companies before triggering Step 3a.
- **Reason:** Collapse to Single1 has 7 input paths (all Step 2 exit points). With the ADR-024 fire-once guard, it triggers on the FIRST company to exit Step 2. But Step 2 processes companies sequentially (~5s each), so processing ~200 companies takes ~17 minutes. Step 3a's `Fetch Companies` queries `enrichment_status=in.(partially_enriched,fully_enriched)` and only sees the handful that finished Step 2 before the query — typically 5-10 of ~200 companies (~95% missed).
- **Why existing metros worked:** They had leftover `partially_enriched`/`fully_enriched` companies from prior runs, so Fetch Companies returned a full set regardless of Step 2 timing. Only brand-new cities are affected.
- **Implementation:** Same stabilization polling pattern as ADR-025 (Collapse to Single2), but inverted:
  - Polls Supabase every 15s: `SELECT id FROM companies WHERE enrichment_status='discovered' AND discovery_metro=<metro>`
  - When `discovered` count reaches **0** and stays at 0 for 2 consecutive polls (30s), all companies have been enriched by Step 2
  - Max wait: 80 × 15s = 20 min (Step 2 processes ~200 companies at ~5s each = ~17 min)
  - No `count > 0` guard needed (unlike ADR-025/BUG-028) because by the time Collapse to Single1 fires, at least one company has already exited Step 2
- **Results:** Pending Portland, OR verification run (exec #158).
- **Trade-offs:** Adds up to 20 min of latency for new cities (waiting for Step 2 to finish). Eliminates the need to run every new city twice. Existing metros unaffected (count immediately 0).
- **Status:** Superseded by ADR-027 — Collapse to Single1 removed in pipeline simplification

## ADR-028: Convert companies domain/phone unique indexes to non-unique
- **Date:** 2026-02-20
- **Decision:** Drop `idx_companies_domain` (UNIQUE) and `idx_companies_phone` (UNIQUE) and recreate them as regular (non-unique) indexes. Keep `idx_companies_google_place_id` as the only unique constraint (besides the primary key).
- **Reason:** Franchise chains (The Now Massage, Massage Envy, Elements Massage) have multiple physical locations sharing the same domain and sometimes the same phone number. Each location has a unique `google_place_id`, which is the correct upsert conflict key. The unique constraints on domain/phone were causing 409 errors that silently broke the entire pipeline — Portland OR execs #158/#159 both failed because Insert to Supabase's `onError: continueRegularOutput` swallowed the 409, leading to 0 discovered companies for downstream steps.
- **Impact:** The `on_conflict=google_place_id` upsert only handles google_place_id conflicts. When a new location has the same domain as an existing location (but a different google_place_id), the INSERT fails with a domain uniqueness violation. Since the node continues on error, no companies get inserted, and the rest of the pipeline processes nothing.
- **Alternatives considered:**
  1. Add `on_conflict=domain` to Insert to Supabase → Wrong: domain is not the primary key, and different locations with the same domain are different companies
  2. Pre-check for domain conflicts and skip → Over-engineering; the domain just isn't unique
  3. Drop unique constraint, keep regular index → **Chosen**: query performance preserved, franchise chains no longer blocked
- **Trade-offs:** Removes a data quality safety net (duplicate domains won't be caught at DB level). However, the `Deduplicate Records` Code node already handles within-run deduplication by phone + name similarity. Cross-run duplicates are handled by the `google_place_id` unique constraint. Domain uniqueness was a false assumption for this industry.
- **Status:** Pending user SQL execution

## ADR-027: Collapse Steps 2 & 3a into single Code nodes (Pipeline Simplification)
- **Date:** 2026-02-20
- **Decision:** Replace the entire branching pipeline for Steps 2, 3a, and 3b with two self-contained Code nodes (`Enrich Companies` and `Find Contacts`). Reduce workflow from 127 to 27 nodes.
- **Reason:** The architecture was too complex. Parallel paths + convergence + polling = fragile. We spent 2+ days patching Collapse nodes with polling loops that fought the n8n task runner timeout (300s). The latest failure: Portland OR exec #158 — Collapse to Single2's polling exceeded the 300s timeout. The root cause is architectural: n8n's batching model creates separate execution batches when multiple paths converge, and no amount of polling/suppression can reliably fix this.
- **Implementation:**
  - `Enrich Companies` (~540 lines): For each discovered company, does domain backfill (Google Places), website scrape, Google Details, company PATCH, social profiles insert. All via `this.helpers.httpRequest()` in a single loop.
  - `Find Contacts` (~615 lines): For each company without contacts, does solo detection, Apollo search/enrich, about page scraping, name extraction, validation, contact insert. All inline.
  - `Enrich Contacts` modified: Added inline Supabase fetch for contacts + companies, plus Filter & Merge logic. Embedded Step 4 Config values.
  - `Run Summary4` modified: Embedded config values (no Step 4 Config reference).
  - `Metro Config` modified: Removed stale collapse flag cleanup for deleted nodes.
- **Eliminated:** ~100 nodes including 3 Collapse nodes (Single1, Single3, Single), 3 Bridge nodes, 4 Config Set nodes, 2 intermediate Run Summaries, all branching IF/HTTP/Code nodes from Steps 2-3.
- **Kept:** Step 1 discovery (21 nodes), Collapse to Single2 (stabilization polling still needed for discovery), Calculate Lead Scores, Run Summary5.
- **Pipeline:** Webhook → Metro Config → [Discovery ~20 nodes] → Collapse to Single2 → Enrich Companies → Find Contacts → Enrich Contacts → Run Summary4 → Calculate Lead Scores → Run Summary5
- **Prerequisite:** `N8N_RUNNERS_TASK_TIMEOUT=1800` in Coolify (default 300s too low for Enrich Companies at ~17 min for 200 companies).
- **Trade-offs:**
  - Pros: Eliminates all convergence bugs, all polling complexity, all timing issues. Simple linear pipeline. Each Code node is self-contained with try/catch per company.
  - Cons: Config values embedded in code (not configurable from n8n UI). Large Code nodes (~500-600 lines each). Requires higher task runner timeout.
- **Alternatives considered:**
  1. Continue patching Collapse nodes with more polling — rejected (fragile, timeout-limited)
  2. Sub-workflows — rejected (adds complexity, n8n sub-workflow execution has its own quirks)
  3. External orchestrator — rejected (over-engineering for this use case)
- **Status:** Superseded by ADR-029 — Collapse to Single2 removed, replaced by Batch Dispatcher

## ADR-029: Parallelized Batch Enrichment Architecture
- **Date:** 2026-02-20
- **Decision:** Split the monolithic pipeline into a main workflow (discovery + batch dispatch + lead scoring) and a sub-workflow (batch enrichment of 25 companies at a time, triggered via webhook). The main workflow's Batch Dispatcher replaces Collapse to Single2, Run Summary, and the entire enrichment chain.
- **Reason:** Nashville TN test (exec #160/#161) exposed two bugs:
  1. **BUG-031:** Collapse to Single2's `$('Metro Config').first().json.metro_name` reference resolves incorrectly in the convergence batch context, returning 0 discovered companies after 7.5 min of polling. The stabilization polling worked for existing metros (which already had data) but failed on first-run cities.
  2. **BUG-032:** Find Contacts only processed 27 of 161 companies — the monolithic enrichment of 161 companies exceeded the 300s task runner hard cap, timing out mid-enrichment.
- **Implementation:**
  - **Main workflow** (22 nodes): Webhook → Metro Config → [Discovery ~19 nodes] → Insert to Supabase / Insert Flagged → Batch Dispatcher → Calculate Lead Scores → Run Summary5
  - **Sub-workflow** (6 nodes, ID `fGm4IP0rWxgHptN8`): Webhook (POST) → Respond to Webhook (200 OK immediately) → Enrich Companies → Find Contacts → Enrich Contacts → Mark Fully Enriched
  - **Batch Dispatcher** (~197 lines): Convergence guard, discovery polling (15s intervals, 30 max), fetch all company IDs, split into batches of 25, dispatch via `Promise.all()` to sub-workflow webhook, poll for completion (30s intervals)
  - **Mark Fully Enriched** (~42 lines): PATCHes all batch companies to `enrichment_status = 'fully_enriched'`
  - All 3 enrichment Code nodes modified: read `metro` + `company_ids` from input item (not `$('Metro Config')` reference), support batch-mode queries
  - Sub-workflow uses `Respond to Webhook` for fire-and-forget pattern — main workflow doesn't block
  - Batch-mode Enrich Contacts uses local object for dedup (not static data) to avoid race conditions between parallel sub-workflow executions
- **Key design:**
  - Batch size: 25 companies. Each Code node runs ~125-200s per batch — safely under 300s hard cap.
  - For 161 Nashville companies: 7 parallel batches → ~5 min total (vs ~15 min sequential)
  - Metro name flows through item data, NOT via `$('Metro Config')` reference (root cause of BUG-031)
  - Sub-workflow webhook URL: `$env.BATCH_ENRICHMENT_WEBHOOK_URL` (set in Coolify)
- **Trade-offs:**
  - Pros: Fixes both BUG-031 and BUG-032. Each batch safely under timeout. Parallel execution = faster. No convergence bugs.
  - Cons: Two workflows to manage. Requires `BATCH_ENRICHMENT_WEBHOOK_URL` env var. Parallel sub-workflows may hit API rate limits at high concurrency (mitigated by existing per-API delays).
- **Alternatives considered:**
  1. Fix `$('Metro Config')` reference in convergence context — fragile, doesn't fix timeout issue
  2. Increase timeout to 1800s for monolithic enrichment — masks the real problem, still slow
  3. Sequential sub-workflows (no parallelism) — fixes timeout but no speed improvement
- **Status:** Active — deployed Session 36

## ADR-030: Remove Insert Flagged → Batch Dispatcher connection + Phase 4 removal
- **Date:** 2026-02-20
- **Decision:** (1) Remove the `Insert Flagged (Needs Review)` → `Batch Dispatcher` connection. Batch Dispatcher now receives input only from `Insert to Supabase`. (2) Remove Phase 4 completion polling from Batch Dispatcher. (3) Reduce Phase 1 discovery polling from 30 to 20 max iterations.
- **Reason:**
  - **(1) Convergence ordering bug (BUG-035):** Both Insert to Supabase (127 items) and Insert Flagged (2 items) connected to Batch Dispatcher. Insert Flagged processes fewer items and completes first, triggering Batch Dispatcher. The ADR-024 convergence guard blocks the second trigger from Insert to Supabase. Since n8n serializes execution within a branch, Insert to Supabase doesn't run until AFTER Batch Dispatcher completes — so companies are not yet in Supabase when Batch Dispatcher polls. Result: Sedona exec #167 dispatched 0 batches after 438s of polling.
  - **(2) Phase 4 wasteful:** Sub-workflows are fire-and-forget (return 200 immediately via Respond to Webhook). Lead scoring (`calculate_lead_scores()`) recalculates ALL company scores from current Supabase data. Polling for completion wastes 15+ min per run.
  - **(3) Phase 1 reduced:** With only one input path (Insert to Supabase), the companies are guaranteed to be in Supabase before Batch Dispatcher starts. Phase 1 is still needed because upstream Merge All Sources convergence can split Insert to Supabase into multiple batches, but 20 iterations (300s) is sufficient.
- **Impact:** Batch Dispatcher went from 438s (0 batches) to 32s (8 batches) on Sedona AZ exec #170.
- **Alternatives considered:**
  1. Keep both connections, remove convergence guard → Would cause duplicate batch dispatch (one per input path)
  2. Add Insert Flagged data to Insert to Supabase output → Architectural change, flagged items intentionally separate
  3. Remove convergence guard, rely on Phase 1 polling → Dangerous, Phase 1 would run twice in parallel
- **Status:** Active — deployed Session 38
