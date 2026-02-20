# Investigation Plan — n8n Workflow Analysis & Rebuild

## Overview

This plan has 7 phases. Each phase produces a deliverable document. You MUST complete each phase sequentially and write its output file before proceeding. Do NOT skip phases. Do NOT start generating workflow JSON until Phase 6.

The workflow JSON files are in `workflows/current/`. The full workflow is large. Treat it like auditing a codebase — be thorough, methodical, and document everything.

---

## Phase 1: Node Inventory
**Output:** `docs/investigation/phase1-node-inventory.md`

Read the complete workflow JSON. For EVERY node, record:

```
| # | Node Name | Type | typeVersion | Mode | Position | Notes Field | onError |
```

Group nodes by Step (Step 1, Step 2, Step 3a, Step 4, Bridges/Config).

For each Code node, extract and record:
- The full `jsCode` content
- What upstream nodes it references via `$('NodeName')`
- What fields it reads from input
- What fields it outputs
- Its execution mode (runOnceForEachItem vs runOnceForAllItems)

For each HTTP Request node, record:
- Method (GET/POST/PATCH)
- URL template
- Headers
- Body template (if POST/PATCH)
- Batching settings
- Timeout
- onError setting

For each IF node, record:
- Condition(s) — field, operator, value
- typeValidation setting
- What TRUE routes to
- What FALSE routes to

For each Set node, record:
- All assignments (name, value, type)

**Completion criteria:** Every node in the workflow JSON is documented. Zero gaps.

---

## Phase 2: Connection Map
**Output:** `docs/investigation/phase2-connection-map.md`

Using the `connections` object in the workflow JSON, build the complete flow graph.

For each step, produce:
1. **ASCII flow diagram** showing the full path with branch labels (true/false)
2. **Convergence point registry** — every place where 2+ paths feed into one node
3. **Input count per node** — how many upstream connections each node has

Format for convergence points:
```
CONVERGENCE: [Target Node Name]
  ← Source 1: [Node Name] (via [true/false/main])
  ← Source 2: [Node Name] (via [true/false/main])
  ← Source 3: [Node Name] (via [true/false/main])
  RISK: [HIGH if >1 source, NONE if 1 source]
```

**This is where the batching bugs live.** Every HIGH risk convergence point is a potential item-loss or duplication bug.

**Completion criteria:** Full flow diagrams for all steps. All convergence points identified and risk-rated.

---

## Phase 3: Code Audit
**Output:** `docs/investigation/phase3-code-audit.md`

For every Code node identified in Phase 1, perform a detailed audit:

1. **Data flow analysis:**
   - What data does this node expect to receive?
   - What upstream node(s) does it reference?
   - Does it use `$input.item.json` (per-item) or `$input.all()` (batch)?
   - Does it use `$('NodeName').item.json` for pairing? (⚠️ RISKY at convergence points)

2. **Logic correctness:**
   - Does the code handle null/undefined inputs?
   - Are there edge cases that could fail silently?
   - Is the output schema consistent with what downstream nodes expect?

3. **Pattern violations:**
   - `runOnceForEachItem` returning arrays (should return single object)
   - `runOnceForAllItems` returning single object (should return array)
   - Missing null checks on API response parsing
   - Hardcoded values that should be config

4. **Cross-reference with convergence points from Phase 2:**
   - Is this node downstream of a convergence point?
   - Does it use `$('NodeName').item.json` pairing? If yes AND it's downstream of convergence → **BUG**

**Completion criteria:** Every code node audited. All bugs tagged with severity (CRITICAL/HIGH/MEDIUM/LOW).

---

## Phase 4: Issue Registry
**Output:** `docs/investigation/phase4-issue-registry.md`

Compile ALL issues found in Phases 1-3 into a single registry. Also add known issues from the handoff doc (`docs/architecture/overview.md`).

Format:
```
### ISSUE-001: [Title]
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **Category:** batching-bug / logic-error / data-quality / missing-feature / schema-gap
- **Location:** [Step] → [Node Name(s)]
- **Description:** What's wrong
- **Evidence:** What was observed / how it was found
- **Impact:** What breaks or degrades
- **Proposed Fix:** How to fix it
- **Dependencies:** Other issues that must be fixed first
```

Include these known issues at minimum:
- Multi-path convergence batching bugs (all locations)
- Contact deduplication gap
- Missing company email column
- Booking platform domains stored as company domain
- Role-based email over-rejection
- Contacts source CHECK constraint missing 'solo_detection'

**Completion criteria:** Comprehensive issue list. No issue from Phases 1-3 is missing. Each issue has a proposed fix.

---

## Phase 5: Fix Plan
**Output:** `docs/investigation/phase5-fix-plan.md`

Using the Issue Registry, create a prioritized implementation plan.

1. **Dependency graph:** Which fixes depend on others?
2. **Fix groups:** Bundle related fixes that should be done together
3. **Implementation order:** Numbered sequence of fix groups
4. **For each fix group:**
   - Which issues it addresses (by ID)
   - Which nodes are modified/added/removed
   - Which connections change
   - Schema migrations needed (if any)
   - Risk assessment
   - Test plan (how to verify the fix works)

5. **Validation strategy:**
   - How to test the complete workflow end-to-end
   - SQL queries to verify data integrity
   - Expected output for a batch of 10 contacts

**Completion criteria:** Clear, actionable plan that could be followed step-by-step. Every issue from Phase 4 is addressed.

---

## Phase 6: Pre-Generation Review
**Output:** `docs/investigation/phase6-review.md`

Before generating any workflow JSON, do a final review:

1. **Re-read all Phase 1-5 outputs** in order
2. **Cross-check:** Does the fix plan address every issue?
3. **Cross-check:** Are there any contradictions between fixes?
4. **Cross-check:** Do the proposed node changes maintain data flow integrity?
5. **Dry-run the logic:** For a sample contact (has email, has domain, needs NamSor), trace the complete path through the proposed fixed workflow. Write out what happens at each node.
6. **Dry-run edge cases:**
   - Contact with no email, no domain, no name (solo_detection thin data)
   - Contact with email that verifies as invalid
   - Contact where Hunter Finder returns no result
   - Contact where all APIs are skipped (all toggles = true)
7. **Schema migration script:** Write the complete SQL migration

**Completion criteria:** All cross-checks pass. Dry-runs produce expected results. No contradictions.

---

## Phase 7: Generate Fixed Workflow
**Output:** `workflows/generated/spa-waterfall-fixed.json`

NOW generate the complete fixed workflow JSON.

Rules:
1. **Start from the current workflow** — copy `workflows/current/` to `workflows/backups/` with timestamp
2. **Apply fixes group by group** from the Phase 5 plan
3. **After each fix group:** Validate the JSON structure using `scripts/validate-workflow.js`
4. **Maintain node positioning:** Keep nodes visually organized (don't stack everything at 0,0)
5. **Preserve all node IDs** for nodes that aren't being replaced
6. **Generate new UUIDs** only for genuinely new nodes
7. **Update connections** carefully — this is where most generation errors occur
8. **Final validation:** Run the complete validation script

After generation:
1. Write a summary of all changes in `tracking/CHANGELOG.md`
2. Update `tracking/PROGRESS.md`
3. Update `tracking/TODO.md` with testing tasks
4. Document any remaining concerns

**Completion criteria:** Valid workflow JSON that addresses all issues. All tracking files updated.

---

## Important Notes

- **Do NOT rush.** Thoroughness in Phases 1-3 prevents bugs in Phase 7.
- **When in doubt, document the uncertainty** rather than guessing.
- **Each phase may take a full session.** That's fine — tracking files maintain continuity.
- **The workflow JSON is large.** Read it systematically, not all at once.
- **Test with skip toggles first.** Zero API credits for structural testing.
