# Session 101 Retrospective — 2026-03-26

**Duration:** Single extended session
**Scope:** Queue emergency fix, lead quality improvements, metered enrollment system

This document is a comprehensive record of everything done in Session 101 so that any developer picking this up can understand the current state, what changed, and why.

---

## 1. What We Started With

### System State at Session Start
- **Pipeline:** 23-node main workflow + 7-node sub-workflow, processing metros via queue
- **Queue Wrapper:** Active but failing in a loop (BUG-057) — Apify monthly quota exceeded
- **Data:** 30,193 companies, 7,153 contacts across ~800 metros
- **Apollo Sync:** Running every 15 min, syncing companies/contacts to Apollo CRM
- **Known issues:** Telnyx 403, Hunter out of credits, Google Reviews 0% yield, Yelp Owner 403

---

## 2. Queue Wrapper Emergency (BUG-057)

### Problem
The Queue Wrapper had been running in a failure loop for 2+ days. The Schedule Trigger was marked `disabled: true` in the n8n node, but the cron job was still registered from when the workflow was activated. Every 30 minutes it claimed a pending metro, triggered the pipeline, and the pipeline failed because Apify's monthly usage limit was exceeded (403 error). The error handler correctly retried 3x per metro, then permanently marked it `failed`. Over 2+ days, 150 metros were burned through.

### Root Cause
**n8n bug:** Disabling a Schedule Trigger node does NOT unregister the cron job. The trigger was registered when the workflow was activated. To stop it, you must **deactivate the entire workflow**, not just disable the trigger node.

### Fix Applied
1. **Deactivated Queue Wrapper** via MCP (workaround: enableNode → deactivateWorkflow → disableNode, because MCP deactivation fails when the only trigger is disabled)
2. **Circuit breaker (ADR-041):** Added to `Fetch Next Pending` node. Queries `pipeline_runs` for 3+ consecutive queue_wrapper failures in last 3 hours with no successes. Returns `hasMetro: false` to halt the queue.
3. **Cooldown requeue (ADR-042):** Updated Queue Error Handler with 3-tier retry: fast retry (3x) → cooldown requeue (24h delay, up to 3 cycles) → permanent fail (after 12 total attempts)
4. **SQL migration:** Added `retry_after` TIMESTAMPTZ + `cooldown_count` INT columns to `pipeline_queue`
5. **Requeued 154 damaged metros** (150 failed + 4 stuck running)
6. **Reactivated Queue Wrapper** — circuit breaker confirmed working (exec #8963, status: success)

### Key Files Changed
- `scripts/nodes/fetch-next-pending.js` — circuit breaker logic
- `projects/queueing-system-v1/n8n/queue-wrapper-workflow.json` — local snapshot
- `projects/queueing-system-v1/n8n/queue-error-handler-workflow.json` — cooldown requeue
- `projects/queueing-system-v1/sql/10-deploy-cooldown-requeue.sql` — schema + requeue

### How It Works Now
The queue is **self-managing**:
- Successful metros complete normally
- Failed metros get 3 fast retries, then 24h cooldown, up to 3 cooldown cycles (12 total attempts)
- Systemic failures (Apify quota, service outage) trip the circuit breaker after 3 consecutive failures
- Queue auto-resumes when the circuit breaker window clears (~3 hours)
- No manual intervention needed

---

## 3. Cost Optimization

### Yelp Apify searchLimit (ADR-043)
Reduced from 100 to 20 results per query. At 12 queries per metro, this cuts raw results from 1,200 to 240 per metro. Estimated ~80% cost reduction ($70/day → ~$14/day). Deployed via MCP to main workflow's "Start Apify Run" HTTP Request node.

### Google Places Radius Fix
744 queue metros had `radius_meters` between 50,000-80,000. Google Places API rejects radius > 50,000 (400 error). Fixed: `UPDATE pipeline_queue SET radius_meters = 49999 WHERE radius_meters >= 50000`.

---

## 4. API Audit & Enrichment Fixes

### APIs Checked
| API | Status | Action |
|-----|--------|--------|
| Telnyx Phone Verification | 403 (expired/over-limit) | Identified, not fixed (separate concern) |
| Hunter (all products) | Out of credits | Identified, needs renewal |
| Google Reviews | 0% yield | **Disabled** (`SKIP_GOOGLE_REVIEWS=true`) — was duplicating solo detection logic; BUG-045 means API doesn't expose owner reply data |
| Yelp Owner | 0% yield (403 blocked) | Identified — Yelp returns 403 on all HTTP requests (bot detection). Needs headless browser. |
| NamSor | Working | 97% cultural affinity populated |
| Apollo | Working | Sync running every 15 min |

### Enrichment Pipeline Catalogue
Created `docs/enrichment-pipeline-catalogue.md` — comprehensive documentation of all 16+ enrichment sources across the pipeline (discovery, company enrichment, contact finding, contact enrichment). Documents what each source does, its API, current status, and known issues.

---

## 5. Lead Quality Improvements v1 (ADR-044)

### Problem
Analysis of 149 lead outcomes showed 67% of outreach failures were preventable. Non-massage businesses (chiropractors, PT clinics, car repair shops, med spas, franchises) were entering the pipeline through search overlap.

### Investigation (Phase 1)
- Audited 30,193 companies across ~800 metros
- Tested 9 filter types against existing data
- Manually reviewed all 86 high-value leads (score >= 30) at risk — 1 false positive (1.2%)
- Assessed cultural affinity reliability (97% populated but only 30% signal for language barrier)
- Documented in `projects/quality_improvements_v1/INVESTIGATION-RESULTS.md`

### Filters Implemented (Phase 2)

#### Priority 1: Category + Chain Blocklist (SQL only)
- Expanded `category_blocklist` from 12 to 39 patterns (Chiropractor, Acupuncture, Medical Clinic, Gym, Fitness, Doulas, Hospice, IV Hydration, Body Contouring, Pain Management, Sauna, Medical Spa, Resort hotel, Car repair, Transportation, etc.)
- Promoted 9 report-only junk categories to pipeline blocklist
- Added 9 franchise entries to `chain_blocklist` (Massage Envy, Hand & Stone, Elements, Massage Heights, Massage Luxe, LaVida, Spavia, Massage Green)
- All filters use **safe-term exemption**: if category contains Massage, Bodywork, Day Spa, Wellness, or Therapeutic → business is kept
- **Result:** 4,741 companies deleted (15.7% of pipeline)

#### Priority 2: Name-Pattern Filters + Mobile + additional_types (Workflow changes)
- Added 22 name-exclusion patterns to both Normalize Google Results and Normalize Yelp Results nodes (physical therapy, chiropractic, med spa, acupuncture, energy healing, float/salt)
- Name filters also use safe-term exemption on the name itself
- SQL cleanup on existing data: 793 more companies
- `is_mobile_practice` BOOLEAN column: 122 companies flagged, scoring rule (-20 pts)
- `additional_types` JSONB column: stores Google Places type arrays for richer future filtering
- Both `enrich-companies.js` (23K chars via MCP) and `find-contacts.js` (48K chars via deploy script) deployed to n8n

#### Priority 3: Language Barrier Scoring
- `is_language_barrier_risk` BOOLEAN column: 740 companies flagged via name patterns (Thai/Asian/Chinese/Korean massage, foot massage, reflexology)
- Scoring rule (-20 pts) — soft signal, NOT hard filter
- `run_post_discovery_cleanup()` function updated to auto-flag language barrier + mobile practice on future metros

#### Audit Infrastructure
- `is_franchise` BOOLEAN column: companies flagged before chain deletion
- `filtered_companies_log` table: every deletion logged with company details, filter type, reason, lead_score, apollo_synced_at
- Both cleanup functions (category + chain) updated to log before deleting

### Final Numbers
| Table | Before | After | Deleted | % |
|-------|--------|-------|---------|---|
| Companies | 30,193 | 24,195 | 5,998 | 19.9% |
| Contacts | 7,153 | 5,134 | 2,019 | 28.2% |
| Social profiles | 29,389 | 20,001 | 9,388 | 32.0% |

### Test Run
Social Circle city, GA: 119 discovered → 111 after cleanup (8 filtered: 6 category + 2 chain). `additional_types` populated on 104/111 (94%). 29 contacts found. All systems working.

### Key Files
- `projects/quality_improvements_v1/TRACKER.md` — full project tracker with 14 decisions
- `projects/quality_improvements_v1/INVESTIGATION-RESULTS.md` — investigation findings
- `projects/quality_improvements_v1/sql/01-investigation-queries.sql` — diagnostic queries
- `projects/quality_improvements_v1/sql/02-followup-queries.sql` — follow-up queries
- `projects/quality_improvements_v1/sql/03-expand-blocklists.sql` — blocklist INSERTs
- `projects/quality_improvements_v1/APOLLO-CLEANUP-DEBT.md` — deferred Apollo cleanup

---

## 6. Metered Enrollment System

### Problem
The previous system enrolled contacts into Apollo sequences in batches of ~1,000, creating task backlog. Rep capacity is ~150 calls/day. Sequence timing became meaningless, callbacks didn't sync reliably, and there was no visibility into actively-worked contacts.

### Architecture
```
Supabase (pending contacts)
    → n8n Daily Enrollment (6am, cap 500)
        → Apollo Net New Sequence (1 call task)
            → Apollo Plays handle all transitions:
                No answer → Follow-up Sequence (4 calls: immed, +2d, +2d, +2d)
                Callback → Callback Sequence (due date)
                Meeting Booked → stage update
                Disqualified → stage update
                Follow-up exhausted → No Response stage
```

### What Was Built

#### Supabase Schema
- `sequence_enrolled_at` TIMESTAMPTZ on contacts
- `enrollment_batch` TEXT on contacts
- `call_activity` table (webhook logging)
- `get_pending_enrollment(p_limit)` RPC function (JOIN contacts + companies for lead_score ordering)

#### n8n Workflows
- **Daily Enrollment** (`mEcwH3Q3fR63ib6g`, 11 nodes, ACTIVE):
  Schedule Trigger (6am) → Set Config → Get Active Count (Apollo API) → Calculate Slots → IF Has Slots → Get Pending Contacts (Supabase RPC) → Split In Batches (25) → Add to Net New (Apollo API) → Mark Enrolled (Supabase PATCH) → Log Summary
- **Call Activity Webhook** (`kgtvLxRsgfd8iuCL`, 4 nodes, ACTIVE):
  Webhook POST → Parse Payload → Insert Call Activity → Respond 200

#### Apollo Configuration (done by Zack in UI)
- 6 Contact Stages: New, Active, Callback, Meeting Booked, Disqualified, No Response
- 3 Sequences: Net New (1 call), Follow-up (4 calls), Callback (1 call, due date)
- 7 Plays: state transitions on call dispositions + webhook to n8n

#### Apollo Sync Changes
- "Assign to Prospect List" node **disabled** (redundant with metered enrollment)
- Apollo Sync still runs every 15 min creating Account + Contact records (needed for enrollment)

### Enrollment Flow
1. Apollo Sync creates contacts in Apollo → writes `apollo_contact_id` to Supabase
2. Daily Enrollment (6am) queries contacts WHERE `apollo_contact_id IS NOT NULL AND sequence_enrolled_at IS NULL AND phone_direct IS NOT NULL`
3. Orders by `lead_score DESC` (via RPC JOIN to companies table)
4. Enrolls top N contacts where N = 500 - current_active_count
5. Marks enrolled in Supabase (`sequence_enrolled_at`, `enrollment_batch`)
6. Apollo Plays handle all subsequent state transitions

### Test Results
- 5-contact test: passed
- 381-contact production batch: passed (9 minutes)
- 134 pre-existing actioned contacts excluded from enrollment
- 3,814 contacts remaining for future daily enrollment

### Key Files
- `projects/metered_enrollment_v1/metered-enrollment-scope.md` — full scope doc
- `projects/metered_enrollment_v1/investigation-findings.md` — Phase 1 findings
- `projects/metered_enrollment_v1/apollo-setup-checklist.md` — Apollo UI setup
- `projects/metered_enrollment_v1/CONFIGURATION.md` — all Apollo IDs and config reference

---

## 7. Outstanding / Deferred Items

### Apollo Cleanup Debt (`APOLLO-CLEANUP-DEBT.md`)
- ~3,525 orphaned Apollo accounts (deleted from Supabase by quality filters, still in Apollo)
- 115 mobile practice contacts need flag in Apollo
- 711 language barrier contacts need flag in Apollo
- 23,617 stale lead scores in Apollo
- **Decision:** Defer until after metered enrollment stabilizes

### API Issues (not addressed this session)
- Telnyx phone verification: 403 error, needs API key check
- Hunter.io: out of credits, needs renewal
- Yelp Owner scraping: 403 bot detection, needs headless browser
- Snov.io: no API key/account

### Future Enhancements
- Refine search queries (12 → 6-8 per metro) for additional Apify savings
- Website language detection for better language barrier scoring
- Enable Facebook Page scraping (SKIP_FACEBOOK=true)
- `additional_types` based filtering (column now populated, logic not yet built)

---

## 8. System Architecture — Current State

### Active Workflows (n8n)
| Workflow | ID | Schedule | Purpose |
|----------|----|----------|---------|
| Main Pipeline | yxvQst30sWlNIeZq | Webhook (queue-triggered) | Discovery + normalization + insert |
| Sub-Workflow | fGm4IP0rWxgHptN8 | Webhook (batch dispatched) | Enrichment + contacts + scoring |
| Queue Wrapper | 7Ix8ajJ5Rp9NyYk8 | Every 30 min | Claims metros, triggers pipeline, polls completion |
| Apollo Sync | g9uplPwBAaaVgm4X | Every 15 min | Syncs companies/contacts to Apollo CRM |
| **Daily Enrollment** | mEcwH3Q3fR63ib6g | **Daily 6am** | **Enrolls contacts into Net New sequence** |
| **Call Activity Webhook** | kgtvLxRsgfd8iuCL | **Webhook** | **Logs call dispositions from Apollo** |
| Queue Error Handler | Qdwt8jW18uRslMtT | Error trigger | Retries/cooldown for queue failures |
| Pipeline Error Handler | ovArmKkj1bs5Af3G | Error trigger | Marks pipeline runs as failed |
| Report Generator | SL9RrJBYnZjJ8LI6 | Webhook | Generates xlsx reports (no longer actively used) |
| Workflow Controller | R28WPY4aopfaIw4O | Webhook | Dashboard workflow management |

### Data Pipeline Flow
```
Queue (3,046 pending metros)
    → Queue Wrapper (every 30 min, circuit breaker + cooldown requeue)
        → Main Pipeline (discovery: Google Places + Yelp/Apify)
            → Normalization (name-pattern filters + safe-term exemption)
                → Dedup + Supabase Insert
                    → Post-Discovery Cleanup (category blocklist + chain blocklist + flag mobile/language barrier)
                        → Batch Dispatcher (batches of 25)
                            → Sub-Workflow (enrich companies + find contacts + enrich contacts)
                                → Lead Scoring (with -20 penalties for mobile + language barrier)

Apollo Sync (every 15 min)
    → Fetch unsynced companies + contacts → Create in Apollo CRM

Daily Enrollment (6am)
    → Check capacity (cap 500) → Enroll top contacts by lead_score into Net New sequence
        → Apollo Plays handle all state transitions
```

### Database Tables (key ones)
| Table | Records | Purpose |
|-------|---------|---------|
| companies | 24,195 | Enriched business data |
| contacts | 5,162 | People at companies |
| social_profiles | 20,001 | Social media URLs |
| pipeline_queue | ~3,997 | Metro processing queue |
| pipeline_runs | varies | Pipeline execution tracking |
| category_blocklist | 39 | Category-based quality filters |
| chain_blocklist | 14 | Chain/franchise filters |
| scoring_rules | 8 | Lead scoring rules (including -20 penalties) |
| filtered_companies_log | grows | Audit trail of deleted companies |
| call_activity | grows | Call disposition logging from Apollo webhook |
| pipeline_config | varies | System configuration (active prospect list, etc.) |

---

## 9. How to Diagnose Issues

### Queue not processing metros
1. Check Queue Wrapper executions: `n8n_executions list workflowId=7Ix8ajJ5Rp9NyYk8`
2. If status=success with quick execution → circuit breaker is tripping. Check `pipeline_runs` for recent failures.
3. If status=error → check the error message. Common: Apify quota, Google Places 400, timeout.
4. Check `pipeline_queue` for stuck `running` items: `SELECT * FROM pipeline_queue WHERE status = 'running'`

### Enrollment not working
1. Check Daily Enrollment executions: `n8n_executions list workflowId=mEcwH3Q3fR63ib6g`
2. If not running → Schedule Trigger may be disabled. Check workflow active state.
3. If running but 0 enrolled → Active count may be at 500. Check Apollo contacts in Active stage.
4. If errors → Check Apollo API response. Common: 422 (bad request), 429 (rate limit).
5. Check pending contacts: `SELECT COUNT(*) FROM contacts WHERE apollo_contact_id IS NOT NULL AND sequence_enrolled_at IS NULL AND phone_direct IS NOT NULL`

### Companies being incorrectly filtered
1. Check `filtered_companies_log` for the metro: `SELECT * FROM filtered_companies_log WHERE discovery_metro = 'Metro Name'`
2. Check if the company matched a category pattern or chain pattern
3. Verify safe-term exemption: does the category contain Massage/Bodywork/Day Spa/Wellness/Therapeutic?
4. To add a company back: INSERT it back to companies table and re-run enrichment

### Apollo Sync issues
1. Check Apollo Sync executions: `n8n_executions list workflowId=g9uplPwBAaaVgm4X`
2. If erroring → check Apollo API key in Coolify env vars
3. The "Assign to Prospect List" node is **disabled** — this is intentional (replaced by metered enrollment)

---

## 10. Key Decisions Made This Session

| # | Decision | Why |
|---|----------|-----|
| ADR-041 | Circuit breaker in queue wrapper | Prevent systemic failures from burning through queue |
| ADR-042 | Cooldown requeue (24h delay, 3 cycles) | Self-managing queue without manual intervention |
| ADR-043 | Yelp searchLimit 100→20 | 80% cost reduction, adequate for small metros |
| ADR-044 | Lead quality filters (39 categories + 9 chains + 22 name patterns) | 20% of pipeline was non-massage junk |
| D1-D14 | Quality improvement decisions | See `projects/quality_improvements_v1/TRACKER.md` |
| — | Metered enrollment replaces batch enrollment | Cap 500 active, daily enrollment, Apollo Plays for state transitions |
| — | Apollo Sync prospect list disabled | Redundant with metered enrollment |
| — | Google Reviews disabled | 0% yield, duplicates solo detection |
| — | Apollo cleanup deferred | Batch with future Apollo changes |
