# Handoff: Fix NamSor Cultural Affinity + Nashville Test

**Created:** 2026-02-20
**Status:** Completed (Session 46) — Code fix deployed, Nashville SUCCESS, NamSor API failure discovered (BUG-040)
**Goal:** Fix IMP-014 (NamSor guard too strict) and verify with Nashville, TN pipeline run

## What's Wrong

**IMP-014: NamSor cultural_affinity guard too strict**

In `scripts/nodes/enrich-contacts.js` line 448, the NamSor guard requires both `first_name` AND `last_name`:

```javascript
if (!contact.cultural_affinity && contact.first_name && (contact.last_name || '').length > 0 && config.skip_namsor !== 'true')
```

This blocks NamSor for ~90% of contacts because:
- Most contacts are solo-detected with `first_name` only (no `last_name`)
- Apollo returns ~0% contacts for local massage businesses, so the old full-name path rarely fires
- Line 450 already handles missing last_name by sending `'Unknown'` to NamSor: `encodeURIComponent(contact.last_name || 'Unknown')`
- The guard is just too strict — the fallback already exists but never runs

**Evidence:** San Diego exec #213 — 0 contacts got `cultural_affinity` across all batches. Every contact had `_namsor_country: null`.

In early sessions (Session 6-8), NamSor worked because Apollo returned full-name contacts. Apollo now returns ~0% for massage businesses, so effectively all contacts are solo-detected with first_name only.

## Fix

Single code change + deploy.

**File:** `scripts/nodes/enrich-contacts.js` line 448

**Before:**
```javascript
if (!contact.cultural_affinity && contact.first_name && (contact.last_name || '').length > 0 && config.skip_namsor !== 'true') {
```

**After:**
```javascript
if (!contact.cultural_affinity && contact.first_name && config.skip_namsor !== 'true') {
```

**Steps:**
1. Edit `scripts/nodes/enrich-contacts.js` — remove `&& (contact.last_name || '').length > 0` from line 448
2. Read the full updated file to get the complete `jsCode`
3. Deploy via MCP `n8n_update_partial_workflow` on sub-workflow `fGm4IP0rWxgHptN8`:
   - Operation: `updateNode`
   - Node name: `Enrich Contacts`
   - Replace full `jsCode` parameter with the updated code
4. Verify the deployed node contains the fix

## Nashville Test

Nashville is already configured (8th metro, coords 36.1627/-86.7816, 15km radius). It has prior data from exec #160/#161 (Session 36) — some companies already exist in Supabase.

### Pre-flight check (Rule 12)
1. List recent main workflow executions: `n8n_executions` action=list, workflowId=`yxvQst30sWlNIeZq`, limit=5
2. List recent sub-workflow executions: `n8n_executions` action=list, workflowId=`fGm4IP0rWxgHptN8`, limit=10
3. Confirm nothing running or recently started (within last 15 minutes)
4. If unsure, wait 5 minutes and re-check

### Trigger
```
GET http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io/webhook/001b878c-b5af-4c3c-8b78-d41e526049f4?metro_name=Nashville,%20TN
```

Expected: ~6-7 min for main workflow, then sub-workflows process batches.

### Monitor
- Check main workflow execution status via MCP: `n8n_executions` action=list, workflowId=`yxvQst30sWlNIeZq`, limit=3
- Wait for status=success
- List sub-workflow executions: `n8n_executions` action=list, workflowId=`fGm4IP0rWxgHptN8`, limit=15
- Confirm all SUCCESS

### Verify NamSor fix
- Spot-check 1-2 sub-workflow batch executions
- Look for contacts with `first_name` but no `last_name` that now have `_namsor_country` populated
- This was impossible before the fix — any such contact confirms IMP-014 is resolved
- Also verify contacts with both first+last name still get cultural_affinity (no regression)

## Success Criteria

- [x] Code change deployed to sub-workflow `fGm4IP0rWxgHptN8` — Session 46, verified old guard removed
- [x] Nashville pipeline triggered and completed successfully — Exec #227: 156 companies, 13/13 sub-workflows SUCCESS
- [ ] ~~At least 1 contact with first_name only has `cultural_affinity` populated~~ — **BLOCKED by BUG-040:** NamSor API returning null for ALL contacts (even full-name ones). Code fix correct but unverifiable.
- [ ] ~~No regressions — contacts with both first+last name still get cultural_affinity~~ — **BLOCKED by BUG-040**
- [x] Digital signals populated (booking platforms, Google ratings, paid ads) — confirmed in spot-checks
- [x] Tracking files updated (PROGRESS.md, CHANGELOG.md, BUGS.md) — Session 46

## Key Reference

| Item | Value |
|------|-------|
| Main workflow | `yxvQst30sWlNIeZq` (22 nodes) |
| Sub-workflow | `fGm4IP0rWxgHptN8` (6 nodes) |
| Main webhook | `GET /webhook/001b878c-b5af-4c3c-8b78-d41e526049f4` |
| Sub webhook | `POST /webhook/batch-enrichment-v1` |
| Code file | `scripts/nodes/enrich-contacts.js` (line 448) |
| n8n API base | `http://n8n-xw00wok0wk4gg0kc8000gwwg.5.161.95.57.sslip.io` |
| Nashville metro | 36.1627/-86.7816, 15km radius |
| Prior Nashville execs | #160, #161 (Session 36) |
