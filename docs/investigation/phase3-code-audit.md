# Phase 3: Code Audit

**Workflow:** Step 4 (isolated) - with Layer 2 Verification
**Code Nodes Audited:** 72 (72 total, 66 unique)
**Date:** 2026-02-17
**Phase:** 3 of 7 (Investigation)

## 1. Audit Summary

### Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 6 | Batching bugs — `.item.json` pairing at convergence points |
| HIGH | 9 | `.all()` at convergence, possible wrong return types |
| MEDIUM | 6 | Missing null checks, possible wrong return types |
| LOW | 1 | Missing empty checks, hardcoded values |
| OK | 50 | No issues found |
| **TOTAL** | **72** | |

### Critical Bugs (Batching)

| # | Node | Step | Bug | Detail |
|---|------|------|-----|--------|
| 1 | Analyze Website HTML | Step 2: Company Enrichment | BATCHING BUG: .item.json pairing downstream of convergence | Uses $('Has Website?').item.json but is downstream of convergence point(s): Merge Backfill. Items wi |
| 2 | Parse Google Details | Step 2: Company Enrichment | BATCHING BUG: .item.json pairing downstream of convergence | Uses $('Has Google Place ID?').item.json but is downstream of convergence point(s): Merge Website Re |
| 3 | Prepare Social Processing | Step 2: Company Enrichment | BATCHING BUG: .item.json pairing downstream of convergence | Uses $('Prepare Company Update').item.json but is downstream of convergence point(s): Prepare Compan |
| 4 | Parse Snov.io Response | Step 4: Enrich People | BATCHING BUG: .item.json pairing downstream of convergence | Uses $('Hunter Found Email?').item.json but is downstream of convergence point(s): Hunter Found Emai |
| 5 | Parse Verifier Response | Step 4: Enrich People | BATCHING BUG: .item.json pairing downstream of convergence | Uses $('Has Email to Verify?').item.json but is downstream of convergence point(s): Collect Email Re |
| 6 | Parse NamSor Response | Step 4: Enrich People | BATCHING BUG: .item.json pairing downstream of convergence | Uses $('Needs NamSor?').item.json but is downstream of convergence point(s): Collect Verified Result |

### High Severity Issues

| # | Node | Step | Issue | Detail |
|---|------|------|-------|--------|
| 1 | Run Summary | Step 1: Discovery | .all() at convergence point — duplication risk | Uses $('Deduplicate Records').all at/downstream of convergence. .all() returns items per-batch, may cause duplication wh |
| 2 | Run Summary1 | Step 2: Company Enrichment | .all() at convergence point — duplication risk | Uses $('Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node  |
| 3 | Run Summary1 | Step 2: Company Enrichment | .all() at convergence point — duplication risk | Uses $('Analyze Website HTML').all at/downstream of convergence. .all() returns items per-batch, may cause duplication w |
| 4 | Run Summary2 | Step 3b: Social Enrichment | .all() at convergence point — duplication risk | Uses $('Build SociaVault Request').all at/downstream of convergence. .all() returns items per-batch, may cause duplicati |
| 5 | Run Summary2 | Step 3b: Social Enrichment | .all() at convergence point — duplication risk | Uses $('Parse SociaVault Response').all at/downstream of convergence. .all() returns items per-batch, may cause duplicat |
| 6 | Run Summary3 | Step 3a: Find People | .all() at convergence point — duplication risk | Uses $('Filter & Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may cause duplication w |
| 7 | Run Summary3 | Step 3a: Find People | .all() at convergence point — duplication risk | Uses $('Prepare Solo Contact').all at/downstream of convergence. .all() returns items per-batch, may cause duplication w |
| 8 | Run Summary3 | Step 3a: Find People | .all() at convergence point — duplication risk | Uses $('Parse Apollo Search').all at/downstream of convergence. .all() returns items per-batch, may cause duplication wh |
| 9 | Run Summary3 | Step 3a: Find People | .all() at convergence point — duplication risk | Uses $('Parse Apollo Enrich').all at/downstream of convergence. .all() returns items per-batch, may cause duplication wh |
| 10 | Run Summary3 | Step 3a: Find People | .all() at convergence point — duplication risk | Uses $('Apollo Search Only Contact').all at/downstream of convergence. .all() returns items per-batch, may cause duplica |
| 11 | Run Summary3 | Step 3a: Find People | .all() at convergence point — duplication risk | Uses $('Parse About Page').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when  |
| 12 | Run Summary3 | Step 3a: Find People | .all() at convergence point — duplication risk | Uses $('No Domain Fallback').all at/downstream of convergence. .all() returns items per-batch, may cause duplication whe |
| 13 | Collect Email Results | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Merge Email Results').all at/downstream of convergence. .all() returns items per-batch, may cause duplication wh |
| 14 | Collect Email Results | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Skip Email - Pass Through').all at/downstream of convergence. .all() returns items per-batch, may cause duplicat |
| 15 | Collect Email Results | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('No Domain - Skip Email').all at/downstream of convergence. .all() returns items per-batch, may cause duplication |
| 16 | Collect Verified Results | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Parse Verifier Response').all at/downstream of convergence. .all() returns items per-batch, may cause duplicatio |
| 17 | Collect Verified Results | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Skip Verification').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when |
| 18 | Collect NamSor Results | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Parse NamSor Response').all at/downstream of convergence. .all() returns items per-batch, may cause duplication  |
| 19 | Collect NamSor Results | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Skip NamSor').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node  |
| 20 | Collect Updates | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Update Contact in Supabase').all at/downstream of convergence. .all() returns items per-batch, may cause duplica |
| 21 | Collect Updates | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Has Updates?').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node |
| 22 | Run Summary4 | Step 4: Enrich People | .all() at convergence point — duplication risk | Uses $('Prepare Contact Update').all at/downstream of convergence. .all() returns items per-batch, may cause duplication |

---

## 2. Detailed Audit by Step

### Step 1: Discovery

**8 Code nodes**

#### Split Search Queries — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 12

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Issues:** None found

#### Extract Run ID — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 14

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Issues:** None found

#### Parse Status — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 27

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Extract Run ID').first`, `$('Parse Status').first`

**Convergence Risk:**

- **Downstream of:** Wait 30s

**Issues:** None found

#### Normalize Google Results — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 54

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Metro Config').first`

**Issues:** None found

#### Normalize Yelp Results — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 52

**Data Flow:**

- Upstream `.first()`: `$('Metro Config').first`, `$('Split Search Queries').first`

**Convergence Risk:**

- **Downstream of:** Wait 30s

**Issues:** None found

#### Deduplicate Records — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 74

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Convergence Risk:**

- **Downstream of:** Merge All Sources, Wait 30s

**Issues:** None found

#### Prepare for Supabase — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 19

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Convergence Risk:**

- **Downstream of:** Merge All Sources, Wait 30s

**Issues:** None found

#### Run Summary — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 18

**Data Flow:**

- Upstream `.all()`: `$('Deduplicate Records').all`
- Upstream `.first()`: `$('Metro Config').first`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Run Summary, Merge All Sources, Wait 30s

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Deduplicate Records').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

### Step 2: Company Enrichment

**21 Code nodes**

#### Parse Batch — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 24

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Issues:** None found

#### No Records - Done — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**Data Flow:**

- No upstream references (self-contained)

**Issues:** None found

#### Extract & Patch Domain — 🟡 MEDIUM

- **Mode:** `runOnceForEachItem`
- **Lines:** 68

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Needs Backfill?').item.json`

**Issues Found:**

- **[MEDIUM]** No error handling for API response parsing: Receives HTTP response but doesn't check for error status

#### Analyze Website HTML — 🔴 CRITICAL

- **Mode:** `runOnceForEachItem`
- **Lines:** 193

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Has Website?').item.json`

**Convergence Risk:**

- **Downstream of:** Merge Backfill
- **🔴 BATCHING BUG CONFIRMED** — `.item.json` pairing will break across batches

**Issues Found:**

- **[CRITICAL]** BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Has Website?').item.json but is downstream of convergence point(s): Merge Backfill. Items will pair incorrectly across batches.

#### Skip - No Website — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 50

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **Downstream of:** Merge Backfill

**Issues:** None found

#### Merge Website Results — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 41

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.first()`: `$('Enrichment Config').first`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Merge Website Results, Merge Backfill

**Issues:** None found

#### Skip Google Details — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 15

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **Downstream of:** Merge Website Results, Merge Backfill

**Issues:** None found

#### Parse Google Details — 🔴 CRITICAL

- **Mode:** `runOnceForEachItem`
- **Lines:** 39

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Has Google Place ID?').item.json`

**Convergence Risk:**

- **Downstream of:** Merge Website Results, Merge Backfill
- **🔴 BATCHING BUG CONFIRMED** — `.item.json` pairing will break across batches

**Issues Found:**

- **[CRITICAL]** BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Has Google Place ID?').item.json but is downstream of convergence point(s): Merge Website Results, Merge Backfill. Items will pair incorrectly across batches.

#### Prepare Company Update — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 28

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Prepare Social Processing — 🔴 CRITICAL

- **Mode:** `runOnceForEachItem`
- **Lines:** 21

**Data Flow:**

- Upstream `.item.json`: `$('Prepare Company Update').item.json`
- Upstream `.first()`: `$('Enrichment Config').first`

**Convergence Risk:**

- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill
- **🔴 BATCHING BUG CONFIRMED** — `.item.json` pairing will break across batches

**Issues Found:**

- **[CRITICAL]** BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Prepare Company Update').item.json but is downstream of convergence point(s): Prepare Company Update, Merge Website Results, Merge Backfill. Items will pair incorrectly across batches.
- **[MEDIUM]** No null/undefined checks on upstream data access: Accesses upstream nodes but has no null/undefined guards

#### Build Social Discovery Batch — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 34

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Convergence Risk:**

- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Prepare FB Search Input — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 26

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Convergence Risk:**

- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Prepare IG Search Input — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 35

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Convergence Risk:**

- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Extract FB Run ID — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 16

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Prepare FB Search Input').first`

**Convergence Risk:**

- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Extract IG Run ID — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 23

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Prepare IG Search Input').first`

**Convergence Risk:**

- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Parse FB Status — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 25

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Extract FB Run ID').first`, `$('Parse FB Status').first`

**Convergence Risk:**

- **Downstream of:** Wait FB 30s, Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Parse IG Status — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 24

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Extract IG Run ID').first`, `$('Parse IG Status').first`

**Convergence Risk:**

- **Downstream of:** Wait IG 30s, Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Match FB Results to Companies — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 79

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Extract FB Run ID').first`

**Convergence Risk:**

- **Downstream of:** Wait FB 30s, Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Match IG Results to Companies — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 81

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.first()`: `$('Extract IG Run ID').first`

**Convergence Risk:**

- **Downstream of:** Wait IG 30s, Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Prepare Social Profiles Insert — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 30

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **Downstream of:** Prepare Company Update, Merge Website Results, Merge Backfill

**Issues:** None found

#### Run Summary1 — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 61

**Data Flow:**

- Upstream `.all()`: `$('Parse Batch').all`, `$('Analyze Website HTML').all`
- Upstream `.first()`: `$('Enrichment Config').first`, `$('Match FB Results to Companies').first`, `$('Match IG Results to Companies').first`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Run Summary1, Prepare Company Update, Wait FB 30s, Wait IG 30s, Merge Website Results, Merge Backfill

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Analyze Website HTML').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

### Step 3b: Social Enrichment

**6 Code nodes**

#### Bridge to 3b — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 2

**Data Flow:**

- No upstream references (self-contained)

**Issues:** None found

#### Parse Batch1 — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 15

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)

**Issues:** None found

#### No Records - Done1 — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**Data Flow:**

- No upstream references (self-contained)

**Issues:** None found

#### Build SociaVault Request — 🔵 LOW

- **Mode:** `runOnceForEachItem`
- **Lines:** 90

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.first()`: `$('Step 3b Config').first`

**Issues Found:**

- **[LOW]** Hardcoded API URL: URL in code: https://api.sociavault.com/v1/scrape...

#### Parse SociaVault Response — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 72

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Should Enrich?').item.json`

**Issues:** None found

#### Run Summary2 — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 43

**Data Flow:**

- Upstream `.all()`: `$('Build SociaVault Request').all`, `$('Parse SociaVault Response').all`
- Upstream `.first()`: `$('Step 3b Config').first`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Run Summary2

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Build SociaVault Request').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Parse SociaVault Response').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

### Step 3a: Find People

**16 Code nodes**

#### Bridge to 3a — ✅ OK

> **DUPLICATE** of **Bridge to 3b** — see that node for full audit.
> Same convergence/severity analysis applies.


#### Filter & Parse Batch — 🟡 MEDIUM

- **Mode:** `runOnceForAllItems`
- **Lines:** 34

**Data Flow:**

- `$input.all()` or `$input.first()` (batch)
- Upstream `.all()`: `$('Fetch Companies').all`

**Issues Found:**

- **[MEDIUM]** No null/undefined checks on upstream data access: Accesses upstream nodes but has no null/undefined guards

#### No Records - Done2 — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**Data Flow:**

- No upstream references (self-contained)

**Issues:** None found

#### Solo Practitioner Check — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 176

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Parse Apollo Search — 🟡 MEDIUM

- **Mode:** `runOnceForEachItem`
- **Lines:** 54

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Solo Practitioner Check').item.json`

**Issues Found:**

- **[MEDIUM]** No error handling for API response parsing: Receives HTTP response but doesn't check for error status

#### No Domain Fallback — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 141

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Prepare Solo Contact — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 23

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Parse About Page — 🟡 MEDIUM

- **Mode:** `runOnceForEachItem`
- **Lines:** 128

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Solo Practitioner Check').item.json`

**Issues Found:**

- **[MEDIUM]** No error handling for API response parsing: Receives HTTP response but doesn't check for error status

#### Apollo Search Only Contact — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 24

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Parse Apollo Enrich — 🟡 MEDIUM

- **Mode:** `runOnceForEachItem`
- **Lines:** 71

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Parse Apollo Search').item.json`

**Issues Found:**

- **[MEDIUM]** No error handling for API response parsing: Receives HTTP response but doesn't check for error status

#### Validate & Clean Contact3 — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 322

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Validate & Clean Contact4 — ✅ OK

> **DUPLICATE** of **Validate & Clean Contact3** — see that node for full audit.
> Same convergence/severity analysis applies.


#### Validate & Clean Contact2 — ✅ OK

> **DUPLICATE** of **Validate & Clean Contact3** — see that node for full audit.
> Same convergence/severity analysis applies.


#### Validate & Clean Contact1 — ✅ OK

> **DUPLICATE** of **Validate & Clean Contact3** — see that node for full audit.
> Same convergence/severity analysis applies.


#### Validate & Clean Contact — ✅ OK

> **DUPLICATE** of **Validate & Clean Contact3** — see that node for full audit.
> Same convergence/severity analysis applies.


#### Run Summary3 — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 128

**Data Flow:**

- Upstream `.all()`: `$('Filter & Parse Batch').all`, `$('Prepare Solo Contact').all`, `$('Parse Apollo Search').all`, `$('Parse Apollo Enrich').all`, `$('Apollo Search Only Contact').all`, `$('Parse About Page').all`, `$('No Domain Fallback').all`
- Upstream `.first()`: `$('Step 3a Config').first`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Run Summary3, Insert Contact to Supabase

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Filter & Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Prepare Solo Contact').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Parse Apollo Search').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Parse Apollo Enrich').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Apollo Search Only Contact').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Parse About Page').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('No Domain Fallback').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

### Step 4: Enrich People

**21 Code nodes**

#### Bridge to 4 — ✅ OK

> **DUPLICATE** of **Bridge to 3b** — see that node for full audit.
> Same convergence/severity analysis applies.


#### Collapse to Single — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 2

**Data Flow:**

- No upstream references (self-contained)

**Issues:** None found

#### Filter & Merge Contacts — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 71

**Data Flow:**

- Upstream `.all()`: `$('Fetch Contacts').all`, `$('Fetch Companies1').all`

**Issues:** None found

#### No Records - Done3 — ✅ OK

- **Mode:** `runOnceForAllItems`
- **Lines:** 1

**Data Flow:**

- No upstream references (self-contained)

**Issues:** None found

#### Skip Hunter — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 13

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Parse Hunter Response — 🟡 MEDIUM

- **Mode:** `runOnceForEachItem`
- **Lines:** 32

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Has Domain & Name?').item.json`

**Issues Found:**

- **[MEDIUM]** No error handling for API response parsing: Receives HTTP response but doesn't check for error status

#### Skip Email - Pass Through — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 12

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Skip Snov.io — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 9

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **Downstream of:** Hunter Found Email?

**Issues:** None found

#### Parse Snov.io Response — 🔴 CRITICAL

- **Mode:** `runOnceForEachItem`
- **Lines:** 26

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Hunter Found Email?').item.json`

**Convergence Risk:**

- **Downstream of:** Hunter Found Email?
- **🔴 BATCHING BUG CONFIRMED** — `.item.json` pairing will break across batches

**Issues Found:**

- **[CRITICAL]** BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Hunter Found Email?').item.json but is downstream of convergence point(s): Hunter Found Email?. Items will pair incorrectly across batches.

#### Merge Email Results — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 21

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Merge Email Results, Hunter Found Email?

**Issues:** None found

#### No Domain - Skip Email — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 12

**Data Flow:**

- `$input.item.json` (per-item)

**Issues:** None found

#### Collect Email Results — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 18

**Data Flow:**

- Upstream `.all()`: `$('Merge Email Results').all`, `$('Skip Email - Pass Through').all`, `$('No Domain - Skip Email').all`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Merge Email Results').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Skip Email - Pass Through').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('No Domain - Skip Email').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

#### Skip Verification — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 13

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues:** None found

#### Parse Verifier Response — 🔴 CRITICAL

- **Mode:** `runOnceForEachItem`
- **Lines:** 53

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Has Email to Verify?').item.json`

**Convergence Risk:**

- **Downstream of:** Collect Email Results, Merge Email Results, Hunter Found Email?
- **🔴 BATCHING BUG CONFIRMED** — `.item.json` pairing will break across batches

**Issues Found:**

- **[CRITICAL]** BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Has Email to Verify?').item.json but is downstream of convergence point(s): Collect Email Results, Merge Email Results, Hunter Found Email?. Items will pair incorrectly across batches.

#### Collect Verified Results — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 17

**Data Flow:**

- Upstream `.all()`: `$('Parse Verifier Response').all`, `$('Skip Verification').all`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Parse Verifier Response').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Skip Verification').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

#### Parse NamSor Response — 🔴 CRITICAL

- **Mode:** `runOnceForEachItem`
- **Lines:** 34

**Data Flow:**

- `$input.item.json` (per-item)
- Upstream `.item.json`: `$('Needs NamSor?').item.json`

**Convergence Risk:**

- **Downstream of:** Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?
- **🔴 BATCHING BUG CONFIRMED** — `.item.json` pairing will break across batches

**Issues Found:**

- **[CRITICAL]** BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Needs NamSor?').item.json but is downstream of convergence point(s): Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?. Items will pair incorrectly across batches.
- **[MEDIUM]** No error handling for API response parsing: Receives HTTP response but doesn't check for error status

#### Skip NamSor — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 12

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **Downstream of:** Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues:** None found

#### Collect NamSor Results — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 17

**Data Flow:**

- Upstream `.all()`: `$('Parse NamSor Response').all`, `$('Skip NamSor').all`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Collect NamSor Results, Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Parse NamSor Response').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Skip NamSor').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

#### Prepare Contact Update — ✅ OK

- **Mode:** `runOnceForEachItem`
- **Lines:** 97

**Data Flow:**

- `$input.item.json` (per-item)

**Convergence Risk:**

- **Downstream of:** Collect NamSor Results, Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues:** None found

#### Collect Updates — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 16

**Data Flow:**

- Upstream `.all()`: `$('Update Contact in Supabase').all`, `$('Has Updates?').all`

**Convergence Risk:**

- **AT convergence point** — receives multiple input batches
- **Downstream of:** Collect Updates, Collect NamSor Results, Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Update Contact in Supabase').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.
- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Has Updates?').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

#### Run Summary4 — 🟠 HIGH

- **Mode:** `runOnceForAllItems`
- **Lines:** 100

**Data Flow:**

- Upstream `.all()`: `$('Prepare Contact Update').all`
- Upstream `.first()`: `$('Step 4 Config').first`

**Convergence Risk:**

- **Downstream of:** Collect Updates, Collect NamSor Results, Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?

**Issues Found:**

- **[HIGH]** .all() at convergence point — duplication risk: Uses $('Prepare Contact Update').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node runs once per batch.

---

## 3. Convergence Bug Deep Analysis — Step 4

This section provides the detailed analysis of how the batching bug manifests in Step 4.

### 3.1 The Item Pairing Problem

When `$('NodeName').item.json` is used, n8n pairs the current item with the item at the
**same index** in the referenced node's output. In a single-path flow, this works because
item 0 in node A corresponds to item 0 in node B. But at convergence points:

- Items arrive in **separate batches** (one per upstream path)
- Each batch has its own item indices starting from 0
- `$('NodeName').item.json` references the item at the CURRENT batch's index in the REFERENCED node
- If the referenced node was in a different batch, the pairing is **wrong or fails**

### 3.2 Affected Nodes in Step 4

The following nodes use `.item.json` pairing and are downstream of convergence:

#### Parse Snov.io Response

- **References:** `$("Hunter Found Email?").item.json`
- **Convergence ancestors:** Hunter Found Email?
- **What breaks:** The item from `Hunter Found Email?` is paired by index, but the current
  item may be in a different batch than the referenced item. Items get paired with the wrong
  contact's data.

#### Parse Verifier Response

- **References:** `$("Has Email to Verify?").item.json`
- **Convergence ancestors:** Collect Email Results, Merge Email Results, Hunter Found Email?
- **What breaks:** The item from `Has Email to Verify?` is paired by index, but the current
  item may be in a different batch than the referenced item. Items get paired with the wrong
  contact's data.

#### Parse NamSor Response

- **References:** `$("Needs NamSor?").item.json`
- **Convergence ancestors:** Collect Verified Results, Skip Verification, Collect Email Results, Merge Email Results, Hunter Found Email?
- **What breaks:** The item from `Needs NamSor?` is paired by index, but the current
  item may be in a different batch than the referenced item. Items get paired with the wrong
  contact's data.

### 3.3 The `.all()` Collector Problem

Step 4 uses `Collect *` nodes with `runOnceForAllItems` mode that try to gather items
from multiple upstream paths using `.all()`. The issue:

```
// This pattern appears in Collect Email Results, Collect Verified Results, etc.
const items = [];
try { items.push(...$('Path A').all()); } catch(e) {}
try { items.push(...$('Path B').all()); } catch(e) {}
try { items.push(...$('Path C').all()); } catch(e) {}

// Problem: This node runs ONCE PER BATCH.
// In batch 1: $('Path A').all() returns Path A's items
//              $('Path B').all() returns Path B's items (from a PREVIOUS run)
//              $('Path C').all() returns Path C's items (from a PREVIOUS run)
// In batch 2: Same thing but items may be duplicated or stale
```

The `try/catch` pattern prevents errors but also **hides the bug** — when a path hasn't
run in the current batch, `.all()` either returns stale items from a previous batch or
throws an error that's silently caught.

### 3.4 Collector Nodes Analysis

#### Collect Email Results

- **Inputs:** 3 sources: Skip Email - Pass Through (main), Merge Email Results (main), No Domain - Skip Email (main)
- **Mode:** runOnceForAllItems
- **Uses deduplication:** yes (by id)
- **Uses try/catch:** yes

- **Collects from:** `Merge Email Results`, `Skip Email - Pass Through`, `No Domain - Skip Email`

- **[HIGH]** .all() at convergence point — duplication risk
- **[HIGH]** .all() at convergence point — duplication risk
- **[HIGH]** .all() at convergence point — duplication risk

#### Collect Verified Results

- **Inputs:** 2 sources: Skip Verification (main), Parse Verifier Response (main)
- **Mode:** runOnceForAllItems
- **Uses deduplication:** yes (by id)
- **Uses try/catch:** yes

- **Collects from:** `Parse Verifier Response`, `Skip Verification`

- **[HIGH]** .all() at convergence point — duplication risk
- **[HIGH]** .all() at convergence point — duplication risk

#### Collect NamSor Results

- **Inputs:** 2 sources: Parse NamSor Response (main), Skip NamSor (main)
- **Mode:** runOnceForAllItems
- **Uses deduplication:** yes (by id)
- **Uses try/catch:** yes

- **Collects from:** `Parse NamSor Response`, `Skip NamSor`

- **[HIGH]** .all() at convergence point — duplication risk
- **[HIGH]** .all() at convergence point — duplication risk

#### Collect Updates

- **Inputs:** 2 sources: Has Updates? (FALSE), Update Contact in Supabase (main)
- **Mode:** runOnceForAllItems
- **Uses deduplication:** yes (by id)
- **Uses try/catch:** yes

- **Collects from:** `Update Contact in Supabase`, `Has Updates?`

- **[HIGH]** .all() at convergence point — duplication risk
- **[HIGH]** .all() at convergence point — duplication risk

---

## 4. Non-Step-4 Convergence Analysis

While Step 4 is the primary bug location, other steps also have convergence points.
This section assesses whether those convergence points cause practical bugs.

### Step 1: Discovery

- **Run Summary** (HIGH)
  - .all() at convergence point — duplication risk: Uses $('Deduplicate Records').all at/downstream of convergence. .all() returns items per-batch, may cause duplication wh

### Step 2: Company Enrichment

- **Analyze Website HTML** (CRITICAL)
  - BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Has Website?').item.json but is downstream of convergence point(s): Merge Backfill. Items will pair incorrectly 
- **Parse Google Details** (CRITICAL)
  - BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Has Google Place ID?').item.json but is downstream of convergence point(s): Merge Website Results, Merge Backfil
- **Prepare Social Processing** (CRITICAL)
  - BATCHING BUG: .item.json pairing downstream of convergence: Uses $('Prepare Company Update').item.json but is downstream of convergence point(s): Prepare Company Update, Merge Webs
- **Run Summary1** (HIGH)
  - .all() at convergence point — duplication risk: Uses $('Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when node 
  - .all() at convergence point — duplication risk: Uses $('Analyze Website HTML').all at/downstream of convergence. .all() returns items per-batch, may cause duplication w

### Step 3b: Social Enrichment

- **Run Summary2** (HIGH)
  - .all() at convergence point — duplication risk: Uses $('Build SociaVault Request').all at/downstream of convergence. .all() returns items per-batch, may cause duplicati
  - .all() at convergence point — duplication risk: Uses $('Parse SociaVault Response').all at/downstream of convergence. .all() returns items per-batch, may cause duplicat

### Step 3a: Find People

- **Run Summary3** (HIGH)
  - .all() at convergence point — duplication risk: Uses $('Filter & Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may cause duplication w
  - .all() at convergence point — duplication risk: Uses $('Prepare Solo Contact').all at/downstream of convergence. .all() returns items per-batch, may cause duplication w
  - .all() at convergence point — duplication risk: Uses $('Parse Apollo Search').all at/downstream of convergence. .all() returns items per-batch, may cause duplication wh
  - .all() at convergence point — duplication risk: Uses $('Parse Apollo Enrich').all at/downstream of convergence. .all() returns items per-batch, may cause duplication wh
  - .all() at convergence point — duplication risk: Uses $('Apollo Search Only Contact').all at/downstream of convergence. .all() returns items per-batch, may cause duplica
  - .all() at convergence point — duplication risk: Uses $('Parse About Page').all at/downstream of convergence. .all() returns items per-batch, may cause duplication when 
  - .all() at convergence point — duplication risk: Uses $('No Domain Fallback').all at/downstream of convergence. .all() returns items per-batch, may cause duplication whe

---

## 5. Pattern Violation Summary

### .all() at convergence point — duplication risk (22 occurrences)

- **Run Summary** (Step 1: Discovery): Uses $('Deduplicate Records').all at/downstream of convergence. .all() returns items per-batch, may 
- **Run Summary1** (Step 2: Company Enrichment): Uses $('Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may cause du
- **Run Summary1** (Step 2: Company Enrichment): Uses $('Analyze Website HTML').all at/downstream of convergence. .all() returns items per-batch, may
- **Run Summary2** (Step 3b: Social Enrichment): Uses $('Build SociaVault Request').all at/downstream of convergence. .all() returns items per-batch,
- **Run Summary2** (Step 3b: Social Enrichment): Uses $('Parse SociaVault Response').all at/downstream of convergence. .all() returns items per-batch
- **Run Summary3** (Step 3a: Find People): Uses $('Filter & Parse Batch').all at/downstream of convergence. .all() returns items per-batch, may
- **Run Summary3** (Step 3a: Find People): Uses $('Prepare Solo Contact').all at/downstream of convergence. .all() returns items per-batch, may
- **Run Summary3** (Step 3a: Find People): Uses $('Parse Apollo Search').all at/downstream of convergence. .all() returns items per-batch, may 
- **Run Summary3** (Step 3a: Find People): Uses $('Parse Apollo Enrich').all at/downstream of convergence. .all() returns items per-batch, may 
- **Run Summary3** (Step 3a: Find People): Uses $('Apollo Search Only Contact').all at/downstream of convergence. .all() returns items per-batc
- **Run Summary3** (Step 3a: Find People): Uses $('Parse About Page').all at/downstream of convergence. .all() returns items per-batch, may cau
- **Run Summary3** (Step 3a: Find People): Uses $('No Domain Fallback').all at/downstream of convergence. .all() returns items per-batch, may c
- **Collect Email Results** (Step 4: Enrich People): Uses $('Merge Email Results').all at/downstream of convergence. .all() returns items per-batch, may 
- **Collect Email Results** (Step 4: Enrich People): Uses $('Skip Email - Pass Through').all at/downstream of convergence. .all() returns items per-batch
- **Collect Email Results** (Step 4: Enrich People): Uses $('No Domain - Skip Email').all at/downstream of convergence. .all() returns items per-batch, m
- **Collect Verified Results** (Step 4: Enrich People): Uses $('Parse Verifier Response').all at/downstream of convergence. .all() returns items per-batch, 
- **Collect Verified Results** (Step 4: Enrich People): Uses $('Skip Verification').all at/downstream of convergence. .all() returns items per-batch, may ca
- **Collect NamSor Results** (Step 4: Enrich People): Uses $('Parse NamSor Response').all at/downstream of convergence. .all() returns items per-batch, ma
- **Collect NamSor Results** (Step 4: Enrich People): Uses $('Skip NamSor').all at/downstream of convergence. .all() returns items per-batch, may cause du
- **Collect Updates** (Step 4: Enrich People): Uses $('Update Contact in Supabase').all at/downstream of convergence. .all() returns items per-batc
- **Collect Updates** (Step 4: Enrich People): Uses $('Has Updates?').all at/downstream of convergence. .all() returns items per-batch, may cause d
- **Run Summary4** (Step 4: Enrich People): Uses $('Prepare Contact Update').all at/downstream of convergence. .all() returns items per-batch, m

### No error handling for API response parsing (6 occurrences)

- **Extract & Patch Domain** (Step 2: Company Enrichment): Receives HTTP response but doesn't check for error status
- **Parse Apollo Search** (Step 3a: Find People): Receives HTTP response but doesn't check for error status
- **Parse About Page** (Step 3a: Find People): Receives HTTP response but doesn't check for error status
- **Parse Apollo Enrich** (Step 3a: Find People): Receives HTTP response but doesn't check for error status
- **Parse Hunter Response** (Step 4: Enrich People): Receives HTTP response but doesn't check for error status
- **Parse NamSor Response** (Step 4: Enrich People): Receives HTTP response but doesn't check for error status

### BATCHING BUG: .item.json pairing downstream of convergence (6 occurrences)

- **Analyze Website HTML** (Step 2: Company Enrichment): Uses $('Has Website?').item.json but is downstream of convergence point(s): Merge Backfill. Items wi
- **Parse Google Details** (Step 2: Company Enrichment): Uses $('Has Google Place ID?').item.json but is downstream of convergence point(s): Merge Website Re
- **Prepare Social Processing** (Step 2: Company Enrichment): Uses $('Prepare Company Update').item.json but is downstream of convergence point(s): Prepare Compan
- **Parse Snov.io Response** (Step 4: Enrich People): Uses $('Hunter Found Email?').item.json but is downstream of convergence point(s): Hunter Found Emai
- **Parse Verifier Response** (Step 4: Enrich People): Uses $('Has Email to Verify?').item.json but is downstream of convergence point(s): Collect Email Re
- **Parse NamSor Response** (Step 4: Enrich People): Uses $('Needs NamSor?').item.json but is downstream of convergence point(s): Collect Verified Result

### No null/undefined checks on upstream data access (2 occurrences)

- **Prepare Social Processing** (Step 2: Company Enrichment): Accesses upstream nodes but has no null/undefined guards
- **Filter & Parse Batch** (Step 3a: Find People): Accesses upstream nodes but has no null/undefined guards

### Hardcoded API URL (1 occurrences)

- **Build SociaVault Request** (Step 3b: Social Enrichment): URL in code: https://api.sociavault.com/v1/scrape...

---

## 6. Completeness Verification

- **Total Code nodes in workflow:** 72
- **Code nodes audited:** 72
- **Unique code blocks audited:** 66
- **Duplicate code blocks (audited once):** 6
- **All Code nodes covered:** YES

### Audited Nodes

- [CRITICAL] Analyze Website HTML
- [OK] Apollo Search Only Contact
- [OK] Bridge to 3a (duplicate)
- [OK] Bridge to 3b
- [OK] Bridge to 4 (duplicate)
- [LOW] Build SociaVault Request
- [OK] Build Social Discovery Batch
- [OK] Collapse to Single
- [HIGH] Collect Email Results
- [HIGH] Collect NamSor Results
- [HIGH] Collect Updates
- [HIGH] Collect Verified Results
- [OK] Deduplicate Records
- [MEDIUM] Extract & Patch Domain
- [OK] Extract FB Run ID
- [OK] Extract IG Run ID
- [OK] Extract Run ID
- [OK] Filter & Merge Contacts
- [MEDIUM] Filter & Parse Batch
- [OK] Match FB Results to Companies
- [OK] Match IG Results to Companies
- [OK] Merge Email Results
- [OK] Merge Website Results
- [OK] No Domain - Skip Email
- [OK] No Domain Fallback
- [OK] No Records - Done
- [OK] No Records - Done1
- [OK] No Records - Done2
- [OK] No Records - Done3
- [OK] Normalize Google Results
- [OK] Normalize Yelp Results
- [MEDIUM] Parse About Page
- [MEDIUM] Parse Apollo Enrich
- [MEDIUM] Parse Apollo Search
- [OK] Parse Batch
- [OK] Parse Batch1
- [OK] Parse FB Status
- [CRITICAL] Parse Google Details
- [MEDIUM] Parse Hunter Response
- [OK] Parse IG Status
- [CRITICAL] Parse NamSor Response
- [CRITICAL] Parse Snov.io Response
- [OK] Parse SociaVault Response
- [OK] Parse Status
- [CRITICAL] Parse Verifier Response
- [OK] Prepare Company Update
- [OK] Prepare Contact Update
- [OK] Prepare FB Search Input
- [OK] Prepare IG Search Input
- [CRITICAL] Prepare Social Processing
- [OK] Prepare Social Profiles Insert
- [OK] Prepare Solo Contact
- [OK] Prepare for Supabase
- [HIGH] Run Summary
- [HIGH] Run Summary1
- [HIGH] Run Summary2
- [HIGH] Run Summary3
- [HIGH] Run Summary4
- [OK] Skip - No Website
- [OK] Skip Email - Pass Through
- [OK] Skip Google Details
- [OK] Skip Hunter
- [OK] Skip NamSor
- [OK] Skip Snov.io
- [OK] Skip Verification
- [OK] Solo Practitioner Check
- [OK] Split Search Queries
- [OK] Validate & Clean Contact (duplicate)
- [OK] Validate & Clean Contact1 (duplicate)
- [OK] Validate & Clean Contact2 (duplicate)
- [OK] Validate & Clean Contact3
- [OK] Validate & Clean Contact4 (duplicate)
