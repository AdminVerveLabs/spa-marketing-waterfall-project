# Phase 2: Connection Map

**Workflow:** Step 4 (isolated) - with Layer 2 Verification
**Total Nodes:** 151
**Total Connections:** 180
**Date:** 2026-02-17
**Phase:** 2 of 7 (Investigation)

> **This is where the batching bugs live.** Every HIGH risk convergence point is a
> potential item-loss or duplication bug. Phase 3 (Code Audit) will cross-reference
> these convergence points with the `$('NodeName').item.json` patterns flagged in Phase 1.

## 1. Summary

- **Total connections (edges):** 180
- **Convergence points (multi-input nodes):** 19
- **Entry points (no incoming):** 1
- **Terminal points (no outgoing):** 5

### Convergence Points by Step

| Step | Convergence Points | Highest Risk |
|------|--------------------|-------------|
| Step 1: Discovery | 3 | HIGH (max 2 inputs) |
| Step 2: Company Enrichment | 6 | CRITICAL (max 7 inputs) |
| Step 3b: Social Enrichment | 1 | HIGH (max 2 inputs) |
| Step 3a: Find People | 2 | CRITICAL (max 5 inputs) |
| Step 4: Enrich People | 7 | CRITICAL (max 3 inputs) |

---

## 2. Flow Diagrams and Connection Tables by Step

### Step 1: Discovery

**20 nodes, 23 connections**

#### Flow Diagram

```
  [When clicking ‘Execute workflow’] (Trigger)
  |
  [Metro Config] (Set)
  |
  [Split Search Queries] (Code)
  |
  [Google Places - Text Search] (HTTP)
  |
  [Normalize Google Results] (Code)
  |
  |
  | <-- [Normalize Google Results] via main
  | <-- [Normalize Yelp Results] via main
  v
  [Merge All Sources] (Merge) *** CONVERGENCE (2 inputs) ***
  |
  [Deduplicate Records] (Code)
  |
  [Prepare for Supabase] (Code)
  |
  [Fuzzy Match?] (IF)
  |
  +--[TRUE]--+---[FALSE]--+
  |           |            |
  |  TRUE:    |            |
    [Insert Flagged (Needs Review)] (HTTP)
    |
    |
    | <-- [Insert Flagged (Needs Review)] via main
    | <-- [Insert to Supabase] via main
    v
    [Run Summary] (Code) *** CONVERGENCE (2 inputs) ***
    | --main--> [Enrichment Config] (next step)
    | (end)
  |           |            |
  |           |   FALSE:   |
      [Insert to Supabase] (HTTP)
      |
      --> [Run Summary] (already shown above)
  [Start Apify Run] (HTTP)
  |
  [Extract Run ID] (Code)
  |
  |
  | <-- [Extract Run ID] via main
  | <-- [Run Succeeded?] via FALSE
  v
  [Wait 30s] (Wait) *** CONVERGENCE (2 inputs) ***
  |
  [Check Run Status] (HTTP)
  |
  [Parse Status] (Code)
  |
  [Run Succeeded?] (IF)
  |
  +--[TRUE]--+---[FALSE]--+
  |           |            |
  |  TRUE:    |            |
    [Fetch Apify Results] (HTTP)
    |
    [Normalize Yelp Results] (Code)
    |
    --> [Merge All Sources] (already shown above)
  |           |            |
  |           |   FALSE:   |
      --> [Wait 30s] (already shown above)

```

#### Connection Table

| # | Source | --Label--> | Target | Source Type | Target Type |
|---|--------|------------|--------|-------------|-------------|
| 1 | When clicking ‘Execute workflow’ | main | Metro Config | manualTrigger | set |
| 2 | Metro Config | main | Split Search Queries | set | code |
| 3 | Split Search Queries | main | Google Places - Text Search | code | httpRequest |
| 4 | Split Search Queries | main | Start Apify Run | code | httpRequest |
| 5 | Start Apify Run | main | Extract Run ID | httpRequest | code |
| 6 | Extract Run ID | main | Wait 30s | code | wait |
| 7 | Wait 30s | main | Check Run Status | wait | httpRequest |
| 8 | Check Run Status | main | Parse Status | httpRequest | code |
| 9 | Parse Status | main | Run Succeeded? | code | if |
| 10 | Run Succeeded? | FALSE | Wait 30s | if | wait |
| 11 | Run Succeeded? | TRUE | Fetch Apify Results | if | httpRequest |
| 12 | Google Places - Text Search | main | Normalize Google Results | httpRequest | code |
| 13 | Fetch Apify Results | main | Normalize Yelp Results | httpRequest | code |
| 14 | Normalize Google Results | main | Merge All Sources | code | merge |
| 15 | Normalize Yelp Results | main | Merge All Sources | code | merge |
| 16 | Merge All Sources | main | Deduplicate Records | merge | code |
| 17 | Deduplicate Records | main | Prepare for Supabase | code | code |
| 18 | Prepare for Supabase | main | Fuzzy Match? | code | if |
| 19 | Fuzzy Match? | FALSE | Insert to Supabase | if | httpRequest |
| 20 | Fuzzy Match? | TRUE | Insert Flagged (Needs Review) | if | httpRequest |
| 21 | Insert Flagged (Needs Review) | main | Run Summary | httpRequest | code |
| 22 | Insert to Supabase | main | Run Summary | httpRequest | code |
| 23 | Run Summary | main | Enrichment Config | code | set |

#### Input Count per Node

| Node | Type | Inputs | Sources |
|------|------|--------|---------|
| When clicking ‘Execute workflow’ | manualTrigger | 0 | (entry point) |
| Metro Config | set | 1 | When clicking ‘Execute workflow’ (main) |
| Split Search Queries | code | 1 | Metro Config (main) |
| Start Apify Run | httpRequest | 1 | Split Search Queries (main) |
| Extract Run ID | code | 1 | Start Apify Run (main) |
| Wait 30s | wait | 2 **CONVERGENCE** | Extract Run ID (main), Run Succeeded? (FALSE) |
| Check Run Status | httpRequest | 1 | Wait 30s (main) |
| Parse Status | code | 1 | Check Run Status (main) |
| Run Succeeded? | if | 1 | Parse Status (main) |
| Google Places - Text Search | httpRequest | 1 | Split Search Queries (main) |
| Fetch Apify Results | httpRequest | 1 | Run Succeeded? (TRUE) |
| Normalize Google Results | code | 1 | Google Places - Text Search (main) |
| Normalize Yelp Results | code | 1 | Fetch Apify Results (main) |
| Merge All Sources | merge | 2 **CONVERGENCE** | Normalize Google Results (main), Normalize Yelp Results (main) |
| Deduplicate Records | code | 1 | Merge All Sources (main) |
| Prepare for Supabase | code | 1 | Deduplicate Records (main) |
| Fuzzy Match? | if | 1 | Prepare for Supabase (main) |
| Insert Flagged (Needs Review) | httpRequest | 1 | Fuzzy Match? (TRUE) |
| Insert to Supabase | httpRequest | 1 | Fuzzy Match? (FALSE) |
| Run Summary | code | 2 **CONVERGENCE** | Insert Flagged (Needs Review) (main), Insert to Supabase (main) |

### Step 2: Company Enrichment

**50 nodes, 61 connections**

#### Flow Diagram

```
  [Enrichment Config] (Set)
  |
  [Fetch Batch from Supabase] (HTTP)
  |
  [Parse Batch] (Code)
  |
  [Batch Empty?] (IF)
  |
  +--[TRUE]--+---[FALSE]--+
  |           |            |
  |  TRUE:    |            |
    [No Records - Done] (Code)
    | (end)
  |           |            |
  |           |   FALSE:   |
      [Needs Backfill?] (IF)
      |
      +--[TRUE]--+---[FALSE]--+
      |           |            |
      |  TRUE:    |            |
        [Google Places Lookup] (HTTP)
        |
        [Extract & Patch Domain] (Code)
        |
        |
        | <-- [Needs Backfill?] via FALSE
        | <-- [Extract & Patch Domain] via main
        v
        [Merge Backfill] (Merge) *** CONVERGENCE (2 inputs) ***
        |
        [Has Website?] (IF)
        |
        +--[TRUE]--+---[FALSE]--+
        |           |            |
        |  TRUE:    |            |
          [Fetch Website HTML] (HTTP)
          |
          [Analyze Website HTML] (Code)
          |
          |
          | <-- [Analyze Website HTML] via main
          | <-- [Skip - No Website] via main
          v
          [Merge Website Results] (Code) *** CONVERGENCE (2 inputs) ***
          |
          [Has Google Place ID?] (IF)
          |
          +--[TRUE]--+---[FALSE]--+
          |           |            |
          |  TRUE:    |            |
            [Google Places Details] (HTTP)
            |
            [Parse Google Details] (Code)
            |
            |
            | <-- [Skip Google Details] via main
            | <-- [Parse Google Details] via main
            v
            [Prepare Company Update] (Code) *** CONVERGENCE (2 inputs) ***
            |
            [Update Company in Supabase] (HTTP)
            |
            [Prepare Social Processing] (Code)
            |
            [Has Social Links?] (IF)
            |
            +--[TRUE]--+---[FALSE]--+
            |           |            |
            |  TRUE:    |            |
              [Prepare Social Profiles Insert] (Code)
              |
              [Insert Social Profiles] (HTTP)
              |
              |
              | <-- [Needs Social Discovery?] via FALSE
              | <-- [Discovery Queries Exist?] via FALSE
              | <-- [FB Matches Found?] via FALSE
              | <-- [IG Matches Found?] via FALSE
              | <-- [Insert Social Profiles] via main
              | <-- [Insert FB Social Profiles] via main
              | <-- [Insert IG Social Profiles] via main
              v
              [Run Summary1] (Code) *** CONVERGENCE (7 inputs) ***
              | --main--> [Bridge to 3b] (next step)
              | (end)
            |           |            |
            |           |   FALSE:   |
                [Needs Social Discovery?] (IF)
                |
                +--[TRUE]--+---[FALSE]--+
                |           |            |
                |  TRUE:    |            |
                  [Build Social Discovery Batch] (Code)
                  |
                  [Discovery Queries Exist?] (IF)
                  |
                  +--[TRUE]--+---[FALSE]--+
                  |           |            |
                  |  TRUE:    |            |
                    [Prepare FB Search Input] (Code)
                    |
                    [Start FB Search Run] (HTTP)
                    |
                    [Extract FB Run ID] (Code)
                    |
                    |
                    | <-- [Extract FB Run ID] via main
                    | <-- [FB Run Succeeded?] via FALSE
                    v
                    [Wait FB 30s] (Wait) *** CONVERGENCE (2 inputs) ***
                    |
                    [Check FB Run Status] (HTTP)
                    |
                    [Parse FB Status] (Code)
                    |
                    [FB Run Succeeded?] (IF)
                    |
                    +--[TRUE]--+---[FALSE]--+
                    |           |            |
                    |  TRUE:    |            |
                      [Fetch FB Search Results] (HTTP)
                      |
                      [Match FB Results to Companies] (Code)
                      |
                      [FB Matches Found?] (IF)
                      |
                      +--[TRUE]--+---[FALSE]--+
                      |           |            |
                      |  TRUE:    |            |
                        [Insert FB Social Profiles] (HTTP)
                        |
                        --> [Run Summary1] (already shown above)
                      |           |            |
                      |           |   FALSE:   |
                          --> [Run Summary1] (already shown above)
                    |           |            |
                    |           |   FALSE:   |
                        --> [Wait FB 30s] (already shown above)
                  |           |            |
                  |  TRUE:    |            |
                    [Prepare IG Search Input] (Code)
                    |
                    [Start IG Search Run] (HTTP)
                    |
                    [Extract IG Run ID] (Code)
                    |
                    |
                    | <-- [Extract IG Run ID] via main
                    | <-- [IG Run Succeeded?] via FALSE
                    v
                    [Wait IG 30s] (Wait) *** CONVERGENCE (2 inputs) ***
                    |
                    [Check IG Run Status] (HTTP)
                    |
                    [Parse IG Status] (Code)
                    |
                    [IG Run Succeeded?] (IF)
                    |
                    +--[TRUE]--+---[FALSE]--+
                    |           |            |
                    |  TRUE:    |            |
                      [Fetch IG Search Results] (HTTP)
                      |
                      [Match IG Results to Companies] (Code)
                      |
                      [IG Matches Found?] (IF)
                      |
                      +--[TRUE]--+---[FALSE]--+
                      |           |            |
                      |  TRUE:    |            |
                        [Insert IG Social Profiles] (HTTP)
                        |
                        --> [Run Summary1] (already shown above)
                      |           |            |
                      |           |   FALSE:   |
                          --> [Run Summary1] (already shown above)
                    |           |            |
                    |           |   FALSE:   |
                        --> [Wait IG 30s] (already shown above)
                  |           |            |
                  |           |   FALSE:   |
                      --> [Run Summary1] (already shown above)
                |           |            |
                |           |   FALSE:   |
                    --> [Run Summary1] (already shown above)
          |           |            |
          |           |   FALSE:   |
              [Skip Google Details] (Code)
              |
              --> [Prepare Company Update] (already shown above)
        |           |            |
        |           |   FALSE:   |
            [Skip - No Website] (Code)
            |
            --> [Merge Website Results] (already shown above)
      |           |            |
      |           |   FALSE:   |
          --> [Merge Backfill] (already shown above)

```

#### Connection Table

| # | Source | --Label--> | Target | Source Type | Target Type |
|---|--------|------------|--------|-------------|-------------|
| 1 | Enrichment Config | main | Fetch Batch from Supabase | set | httpRequest |
| 2 | Fetch Batch from Supabase | main | Parse Batch | httpRequest | code |
| 3 | Parse Batch | main | Batch Empty? | code | if |
| 4 | Batch Empty? | FALSE | Needs Backfill? | if | if |
| 5 | Batch Empty? | TRUE | No Records - Done | if | code |
| 6 | Needs Backfill? | FALSE | Merge Backfill | if | merge |
| 7 | Needs Backfill? | TRUE | Google Places Lookup | if | httpRequest |
| 8 | Google Places Lookup | main | Extract & Patch Domain | httpRequest | code |
| 9 | Extract & Patch Domain | main | Merge Backfill | code | merge |
| 10 | Merge Backfill | main | Has Website? | merge | if |
| 11 | Has Website? | FALSE | Skip - No Website | if | code |
| 12 | Has Website? | TRUE | Fetch Website HTML | if | httpRequest |
| 13 | Fetch Website HTML | main | Analyze Website HTML | httpRequest | code |
| 14 | Analyze Website HTML | main | Merge Website Results | code | code |
| 15 | Skip - No Website | main | Merge Website Results | code | code |
| 16 | Merge Website Results | main | Has Google Place ID? | code | if |
| 17 | Has Google Place ID? | FALSE | Skip Google Details | if | code |
| 18 | Has Google Place ID? | TRUE | Google Places Details | if | httpRequest |
| 19 | Google Places Details | main | Parse Google Details | httpRequest | code |
| 20 | Skip Google Details | main | Prepare Company Update | code | code |
| 21 | Parse Google Details | main | Prepare Company Update | code | code |
| 22 | Prepare Company Update | main | Update Company in Supabase | code | httpRequest |
| 23 | Update Company in Supabase | main | Prepare Social Processing | httpRequest | code |
| 24 | Prepare Social Processing | main | Has Social Links? | code | if |
| 25 | Has Social Links? | FALSE | Needs Social Discovery? | if | if |
| 26 | Has Social Links? | TRUE | Prepare Social Profiles Insert | if | code |
| 27 | Needs Social Discovery? | FALSE | Run Summary1 | if | code |
| 28 | Needs Social Discovery? | TRUE | Build Social Discovery Batch | if | code |
| 29 | Build Social Discovery Batch | main | Discovery Queries Exist? | code | if |
| 30 | Discovery Queries Exist? | FALSE | Run Summary1 | if | code |
| 31 | Discovery Queries Exist? | TRUE | Prepare FB Search Input | if | code |
| 32 | Discovery Queries Exist? | TRUE | Prepare IG Search Input | if | code |
| 33 | Prepare FB Search Input | main | Start FB Search Run | code | httpRequest |
| 34 | Prepare IG Search Input | main | Start IG Search Run | code | httpRequest |
| 35 | Start FB Search Run | main | Extract FB Run ID | httpRequest | code |
| 36 | Start IG Search Run | main | Extract IG Run ID | httpRequest | code |
| 37 | Extract FB Run ID | main | Wait FB 30s | code | wait |
| 38 | Extract IG Run ID | main | Wait IG 30s | code | wait |
| 39 | Wait FB 30s | main | Check FB Run Status | wait | httpRequest |
| 40 | Wait IG 30s | main | Check IG Run Status | wait | httpRequest |
| 41 | Check FB Run Status | main | Parse FB Status | httpRequest | code |
| 42 | Check IG Run Status | main | Parse IG Status | httpRequest | code |
| 43 | Parse FB Status | main | FB Run Succeeded? | code | if |
| 44 | Parse IG Status | main | IG Run Succeeded? | code | if |
| 45 | FB Run Succeeded? | FALSE | Wait FB 30s | if | wait |
| 46 | FB Run Succeeded? | TRUE | Fetch FB Search Results | if | httpRequest |
| 47 | IG Run Succeeded? | FALSE | Wait IG 30s | if | wait |
| 48 | IG Run Succeeded? | TRUE | Fetch IG Search Results | if | httpRequest |
| 49 | Fetch FB Search Results | main | Match FB Results to Companies | httpRequest | code |
| 50 | Fetch IG Search Results | main | Match IG Results to Companies | httpRequest | code |
| 51 | Match FB Results to Companies | main | FB Matches Found? | code | if |
| 52 | Match IG Results to Companies | main | IG Matches Found? | code | if |
| 53 | Prepare Social Profiles Insert | main | Insert Social Profiles | code | httpRequest |
| 54 | FB Matches Found? | FALSE | Run Summary1 | if | code |
| 55 | FB Matches Found? | TRUE | Insert FB Social Profiles | if | httpRequest |
| 56 | IG Matches Found? | FALSE | Run Summary1 | if | code |
| 57 | IG Matches Found? | TRUE | Insert IG Social Profiles | if | httpRequest |
| 58 | Insert Social Profiles | main | Run Summary1 | httpRequest | code |
| 59 | Insert FB Social Profiles | main | Run Summary1 | httpRequest | code |
| 60 | Insert IG Social Profiles | main | Run Summary1 | httpRequest | code |
| 61 | Run Summary1 | main | Bridge to 3b | code | code |

#### Input Count per Node

| Node | Type | Inputs | Sources |
|------|------|--------|---------|
| Enrichment Config | set | 1 | Run Summary (main) |
| Fetch Batch from Supabase | httpRequest | 1 | Enrichment Config (main) |
| Parse Batch | code | 1 | Fetch Batch from Supabase (main) |
| Batch Empty? | if | 1 | Parse Batch (main) |
| No Records - Done | code | 1 | Batch Empty? (TRUE) |
| Needs Backfill? | if | 1 | Batch Empty? (FALSE) |
| Google Places Lookup | httpRequest | 1 | Needs Backfill? (TRUE) |
| Extract & Patch Domain | code | 1 | Google Places Lookup (main) |
| Merge Backfill | merge | 2 **CONVERGENCE** | Needs Backfill? (FALSE), Extract & Patch Domain (main) |
| Has Website? | if | 1 | Merge Backfill (main) |
| Fetch Website HTML | httpRequest | 1 | Has Website? (TRUE) |
| Analyze Website HTML | code | 1 | Fetch Website HTML (main) |
| Skip - No Website | code | 1 | Has Website? (FALSE) |
| Merge Website Results | code | 2 **CONVERGENCE** | Analyze Website HTML (main), Skip - No Website (main) |
| Has Google Place ID? | if | 1 | Merge Website Results (main) |
| Google Places Details | httpRequest | 1 | Has Google Place ID? (TRUE) |
| Skip Google Details | code | 1 | Has Google Place ID? (FALSE) |
| Parse Google Details | code | 1 | Google Places Details (main) |
| Prepare Company Update | code | 2 **CONVERGENCE** | Skip Google Details (main), Parse Google Details (main) |
| Update Company in Supabase | httpRequest | 1 | Prepare Company Update (main) |
| Prepare Social Processing | code | 1 | Update Company in Supabase (main) |
| Has Social Links? | if | 1 | Prepare Social Processing (main) |
| Needs Social Discovery? | if | 1 | Has Social Links? (FALSE) |
| Build Social Discovery Batch | code | 1 | Needs Social Discovery? (TRUE) |
| Discovery Queries Exist? | if | 1 | Build Social Discovery Batch (main) |
| Prepare FB Search Input | code | 1 | Discovery Queries Exist? (TRUE) |
| Prepare IG Search Input | code | 1 | Discovery Queries Exist? (TRUE) |
| Start FB Search Run | httpRequest | 1 | Prepare FB Search Input (main) |
| Start IG Search Run | httpRequest | 1 | Prepare IG Search Input (main) |
| Extract FB Run ID | code | 1 | Start FB Search Run (main) |
| Extract IG Run ID | code | 1 | Start IG Search Run (main) |
| Wait FB 30s | wait | 2 **CONVERGENCE** | Extract FB Run ID (main), FB Run Succeeded? (FALSE) |
| Wait IG 30s | wait | 2 **CONVERGENCE** | Extract IG Run ID (main), IG Run Succeeded? (FALSE) |
| Check FB Run Status | httpRequest | 1 | Wait FB 30s (main) |
| Check IG Run Status | httpRequest | 1 | Wait IG 30s (main) |
| Parse FB Status | code | 1 | Check FB Run Status (main) |
| Parse IG Status | code | 1 | Check IG Run Status (main) |
| FB Run Succeeded? | if | 1 | Parse FB Status (main) |
| IG Run Succeeded? | if | 1 | Parse IG Status (main) |
| Fetch FB Search Results | httpRequest | 1 | FB Run Succeeded? (TRUE) |
| Fetch IG Search Results | httpRequest | 1 | IG Run Succeeded? (TRUE) |
| Match FB Results to Companies | code | 1 | Fetch FB Search Results (main) |
| Match IG Results to Companies | code | 1 | Fetch IG Search Results (main) |
| Prepare Social Profiles Insert | code | 1 | Has Social Links? (TRUE) |
| FB Matches Found? | if | 1 | Match FB Results to Companies (main) |
| IG Matches Found? | if | 1 | Match IG Results to Companies (main) |
| Insert Social Profiles | httpRequest | 1 | Prepare Social Profiles Insert (main) |
| Insert FB Social Profiles | httpRequest | 1 | FB Matches Found? (TRUE) |
| Insert IG Social Profiles | httpRequest | 1 | IG Matches Found? (TRUE) |
| Run Summary1 | code | 7 **CONVERGENCE** | Needs Social Discovery? (FALSE), Discovery Queries Exist? (FALSE), FB Matches Found? (FALSE), IG Matches Found? (FALSE), Insert Social Profiles (main), Insert FB Social Profiles (main), Insert IG Social Profiles (main) |

### Step 3b: Social Enrichment

**12 nodes, 13 connections**

#### Flow Diagram

```
  [Bridge to 3b] (Code)
  |
  [Step 3b Config] (Set)
  |
  [Fetch Unenriched Social Profiles] (HTTP)
  |
  [Parse Batch1] (Code)
  |
  [Batch Empty?1] (IF)
  |
  +--[TRUE]--+---[FALSE]--+
  |           |            |
  |  TRUE:    |            |
    [No Records - Done1] (Code)
    | (end)
  |           |            |
  |           |   FALSE:   |
      [Build SociaVault Request] (Code)
      |
      [Should Enrich?] (IF)
      |
      +--[TRUE]--+---[FALSE]--+
      |           |            |
      |  TRUE:    |            |
        [Call SociaVault API] (HTTP)
        |
        [Parse SociaVault Response] (Code)
        |
        [Update Social Profile in Supabase] (HTTP)
        |
        |
        | <-- [Should Enrich?] via FALSE
        | <-- [Update Social Profile in Supabase] via main
        v
        [Run Summary2] (Code) *** CONVERGENCE (2 inputs) ***
        | --main--> [Bridge to 3a] (next step)
        | (end)
      |           |            |
      |           |   FALSE:   |
          --> [Run Summary2] (already shown above)

```

#### Connection Table

| # | Source | --Label--> | Target | Source Type | Target Type |
|---|--------|------------|--------|-------------|-------------|
| 1 | Bridge to 3b | main | Step 3b Config | code | set |
| 2 | Step 3b Config | main | Fetch Unenriched Social Profiles | set | httpRequest |
| 3 | Fetch Unenriched Social Profiles | main | Parse Batch1 | httpRequest | code |
| 4 | Parse Batch1 | main | Batch Empty?1 | code | if |
| 5 | Batch Empty?1 | FALSE | Build SociaVault Request | if | code |
| 6 | Batch Empty?1 | TRUE | No Records - Done1 | if | code |
| 7 | Build SociaVault Request | main | Should Enrich? | code | if |
| 8 | Should Enrich? | FALSE | Run Summary2 | if | code |
| 9 | Should Enrich? | TRUE | Call SociaVault API | if | httpRequest |
| 10 | Call SociaVault API | main | Parse SociaVault Response | httpRequest | code |
| 11 | Parse SociaVault Response | main | Update Social Profile in Supabase | code | httpRequest |
| 12 | Update Social Profile in Supabase | main | Run Summary2 | httpRequest | code |
| 13 | Run Summary2 | main | Bridge to 3a | code | code |

#### Input Count per Node

| Node | Type | Inputs | Sources |
|------|------|--------|---------|
| Bridge to 3b | code | 1 | Run Summary1 (main) |
| Step 3b Config | set | 1 | Bridge to 3b (main) |
| Fetch Unenriched Social Profiles | httpRequest | 1 | Step 3b Config (main) |
| Parse Batch1 | code | 1 | Fetch Unenriched Social Profiles (main) |
| Batch Empty?1 | if | 1 | Parse Batch1 (main) |
| No Records - Done1 | code | 1 | Batch Empty?1 (TRUE) |
| Build SociaVault Request | code | 1 | Batch Empty?1 (FALSE) |
| Should Enrich? | if | 1 | Build SociaVault Request (main) |
| Call SociaVault API | httpRequest | 1 | Should Enrich? (TRUE) |
| Parse SociaVault Response | code | 1 | Call SociaVault API (main) |
| Update Social Profile in Supabase | httpRequest | 1 | Parse SociaVault Response (main) |
| Run Summary2 | code | 2 **CONVERGENCE** | Should Enrich? (FALSE), Update Social Profile in Supabase (main) |

### Step 3a: Find People

**30 nodes, 36 connections**

#### Flow Diagram

```
  [Bridge to 3a] (Code)
  |
  [Step 3a Config] (Set)
  |
  [Fetch Companies] (HTTP)
  |
  [Fetch Existing Contacts] (HTTP)
  |
  [Filter & Parse Batch] (Code)
  |
  [Batch Empty?2] (IF)
  |
  +--[TRUE]--+---[FALSE]--+
  |           |            |
  |  TRUE:    |            |
    [No Records - Done2] (Code)
    | (end)
  |           |            |
  |           |   FALSE:   |
      [Solo Practitioner Check] (Code)
      |
      [Is Solo?] (IF)
      |
      +--[TRUE]--+---[FALSE]--+
      |           |            |
      |  TRUE:    |            |
        [Prepare Solo Contact] (Code)
        |
        [Validate & Clean Contact] (Code)
        |
        |
        | <-- [Validate & Clean Contact3] via main
        | <-- [Validate & Clean Contact4] via main
        | <-- [Validate & Clean Contact2] via main
        | <-- [Validate & Clean Contact1] via main
        | <-- [Validate & Clean Contact] via main
        v
        [Insert Contact to Supabase] (HTTP) *** CONVERGENCE (5 inputs) ***
        |
        |
        | <-- [About Found Name?] via FALSE
        | <-- [No Domain Found Name?] via FALSE
        | <-- [Insert Contact to Supabase] via main
        v
        [Run Summary3] (Code) *** CONVERGENCE (3 inputs) ***
        | --main--> [Bridge to 4] (next step)
        | (end)
      |           |            |
      |           |   FALSE:   |
          [Has Domain & Apollo?] (IF)
          |
          +--[TRUE]--+---[FALSE]--+
          |           |            |
          |  TRUE:    |            |
            [Apollo People Search] (HTTP)
            |
            [Parse Apollo Search] (Code)
            |
            [Apollo Found People?] (IF)
            |
            +--[TRUE]--+---[FALSE]--+
            |           |            |
            |  TRUE:    |            |
              [Enrich Enabled?] (IF)
              |
              +--[TRUE]--+---[FALSE]--+
              |           |            |
              |  TRUE:    |            |
                [Apollo People Enrich] (HTTP)
                |
                [Parse Apollo Enrich] (Code)
                |
                [Validate & Clean Contact1] (Code)
                |
                --> [Insert Contact to Supabase] (already shown above)
              |           |            |
              |           |   FALSE:   |
                  [Apollo Search Only Contact] (Code)
                  |
                  [Validate & Clean Contact3] (Code)
                  |
                  --> [Insert Contact to Supabase] (already shown above)
            |           |            |
            |           |   FALSE:   |
                [Fetch About Page] (HTTP)
                |
                [Parse About Page] (Code)
                |
                [About Found Name?] (IF)
                |
                +--[TRUE]--+---[FALSE]--+
                |           |            |
                |  TRUE:    |            |
                  [Validate & Clean Contact4] (Code)
                  |
                  --> [Insert Contact to Supabase] (already shown above)
                |           |            |
                |           |   FALSE:   |
                    --> [Run Summary3] (already shown above)
          |           |            |
          |           |   FALSE:   |
              [No Domain Fallback] (Code)
              |
              [No Domain Found Name?] (IF)
              |
              +--[TRUE]--+---[FALSE]--+
              |           |            |
              |  TRUE:    |            |
                [Validate & Clean Contact2] (Code)
                |
                --> [Insert Contact to Supabase] (already shown above)
              |           |            |
              |           |   FALSE:   |
                  --> [Run Summary3] (already shown above)

```

#### Connection Table

| # | Source | --Label--> | Target | Source Type | Target Type |
|---|--------|------------|--------|-------------|-------------|
| 1 | Bridge to 3a | main | Step 3a Config | code | set |
| 2 | Step 3a Config | main | Fetch Companies | set | httpRequest |
| 3 | Fetch Companies | main | Fetch Existing Contacts | httpRequest | httpRequest |
| 4 | Fetch Existing Contacts | main | Filter & Parse Batch | httpRequest | code |
| 5 | Filter & Parse Batch | main | Batch Empty?2 | code | if |
| 6 | Batch Empty?2 | FALSE | Solo Practitioner Check | if | code |
| 7 | Batch Empty?2 | TRUE | No Records - Done2 | if | code |
| 8 | Solo Practitioner Check | main | Is Solo? | code | if |
| 9 | Is Solo? | FALSE | Has Domain & Apollo? | if | if |
| 10 | Is Solo? | TRUE | Prepare Solo Contact | if | code |
| 11 | Has Domain & Apollo? | FALSE | No Domain Fallback | if | code |
| 12 | Has Domain & Apollo? | TRUE | Apollo People Search | if | httpRequest |
| 13 | Apollo People Search | main | Parse Apollo Search | httpRequest | code |
| 14 | Parse Apollo Search | main | Apollo Found People? | code | if |
| 15 | Apollo Found People? | FALSE | Fetch About Page | if | httpRequest |
| 16 | Apollo Found People? | TRUE | Enrich Enabled? | if | if |
| 17 | Fetch About Page | main | Parse About Page | httpRequest | code |
| 18 | Enrich Enabled? | FALSE | Apollo Search Only Contact | if | code |
| 19 | Enrich Enabled? | TRUE | Apollo People Enrich | if | httpRequest |
| 20 | No Domain Fallback | main | No Domain Found Name? | code | if |
| 21 | Prepare Solo Contact | main | Validate & Clean Contact | code | code |
| 22 | Parse About Page | main | About Found Name? | code | if |
| 23 | Apollo People Enrich | main | Parse Apollo Enrich | httpRequest | code |
| 24 | Apollo Search Only Contact | main | Validate & Clean Contact3 | code | code |
| 25 | About Found Name? | FALSE | Run Summary3 | if | code |
| 26 | About Found Name? | TRUE | Validate & Clean Contact4 | if | code |
| 27 | No Domain Found Name? | FALSE | Run Summary3 | if | code |
| 28 | No Domain Found Name? | TRUE | Validate & Clean Contact2 | if | code |
| 29 | Parse Apollo Enrich | main | Validate & Clean Contact1 | code | code |
| 30 | Validate & Clean Contact3 | main | Insert Contact to Supabase | code | httpRequest |
| 31 | Validate & Clean Contact4 | main | Insert Contact to Supabase | code | httpRequest |
| 32 | Validate & Clean Contact2 | main | Insert Contact to Supabase | code | httpRequest |
| 33 | Validate & Clean Contact1 | main | Insert Contact to Supabase | code | httpRequest |
| 34 | Validate & Clean Contact | main | Insert Contact to Supabase | code | httpRequest |
| 35 | Insert Contact to Supabase | main | Run Summary3 | httpRequest | code |
| 36 | Run Summary3 | main | Bridge to 4 | code | code |

#### Input Count per Node

| Node | Type | Inputs | Sources |
|------|------|--------|---------|
| Bridge to 3a | code | 1 | Run Summary2 (main) |
| Step 3a Config | set | 1 | Bridge to 3a (main) |
| Fetch Companies | httpRequest | 1 | Step 3a Config (main) |
| Fetch Existing Contacts | httpRequest | 1 | Fetch Companies (main) |
| Filter & Parse Batch | code | 1 | Fetch Existing Contacts (main) |
| Batch Empty?2 | if | 1 | Filter & Parse Batch (main) |
| No Records - Done2 | code | 1 | Batch Empty?2 (TRUE) |
| Solo Practitioner Check | code | 1 | Batch Empty?2 (FALSE) |
| Is Solo? | if | 1 | Solo Practitioner Check (main) |
| Has Domain & Apollo? | if | 1 | Is Solo? (FALSE) |
| Apollo People Search | httpRequest | 1 | Has Domain & Apollo? (TRUE) |
| Parse Apollo Search | code | 1 | Apollo People Search (main) |
| Apollo Found People? | if | 1 | Parse Apollo Search (main) |
| Fetch About Page | httpRequest | 1 | Apollo Found People? (FALSE) |
| Enrich Enabled? | if | 1 | Apollo Found People? (TRUE) |
| No Domain Fallback | code | 1 | Has Domain & Apollo? (FALSE) |
| Prepare Solo Contact | code | 1 | Is Solo? (TRUE) |
| Parse About Page | code | 1 | Fetch About Page (main) |
| Apollo People Enrich | httpRequest | 1 | Enrich Enabled? (TRUE) |
| Apollo Search Only Contact | code | 1 | Enrich Enabled? (FALSE) |
| About Found Name? | if | 1 | Parse About Page (main) |
| No Domain Found Name? | if | 1 | No Domain Fallback (main) |
| Parse Apollo Enrich | code | 1 | Apollo People Enrich (main) |
| Validate & Clean Contact3 | code | 1 | Apollo Search Only Contact (main) |
| Validate & Clean Contact4 | code | 1 | About Found Name? (TRUE) |
| Validate & Clean Contact2 | code | 1 | No Domain Found Name? (TRUE) |
| Validate & Clean Contact1 | code | 1 | Parse Apollo Enrich (main) |
| Validate & Clean Contact | code | 1 | Prepare Solo Contact (main) |
| Insert Contact to Supabase | httpRequest | 5 **CONVERGENCE** | Validate & Clean Contact3 (main), Validate & Clean Contact4 (main), Validate & Clean Contact2 (main), Validate & Clean Contact1 (main), Validate & Clean Contact (main) |
| Run Summary3 | code | 3 **CONVERGENCE** | About Found Name? (FALSE), No Domain Found Name? (FALSE), Insert Contact to Supabase (main) |

### Step 4: Enrich People

**39 nodes, 47 connections**

#### Flow Diagram

```
  [Bridge to 4] (Code)
  |
  [Step 4 Config] (Set)
  |
  [Fetch Contacts] (HTTP)
  |
  [Collapse to Single] (Code)
  |
  [Fetch Companies1] (HTTP)
  |
  [Filter & Merge Contacts] (Code)
  |
  [Batch Empty?3] (IF)
  |
  +--[TRUE]--+---[FALSE]--+
  |           |            |
  |  TRUE:    |            |
    [No Records - Done3] (Code)
    | (end)
  |           |            |
  |           |   FALSE:   |
      [Needs Email?] (IF)
      |
      +--[TRUE]--+---[FALSE]--+
      |           |            |
      |  TRUE:    |            |
        [Has Domain & Name?] (IF)
        |
        +--[TRUE]--+---[FALSE]--+
        |           |            |
        |  TRUE:    |            |
          [Hunter Enabled?] (IF)
          |
          +--[TRUE]--+---[FALSE]--+
          |           |            |
          |  TRUE:    |            |
            [Skip Hunter] (Code)
            |
            |
            | <-- [Skip Hunter] via main
            | <-- [Parse Hunter Response] via main
            v
            [Hunter Found Email?] (IF) *** CONVERGENCE (2 inputs) ***
            |
            +--[TRUE]--+---[FALSE]--+
            |           |            |
            |  TRUE:    |            |
              |
              | <-- [Hunter Found Email?] via TRUE
              | <-- [Skip Snov.io] via main
              | <-- [Parse Snov.io Response] via main
              v
              [Merge Email Results] (Code) *** CONVERGENCE (3 inputs) ***
              |
              |
              | <-- [Skip Email - Pass Through] via main
              | <-- [Merge Email Results] via main
              | <-- [No Domain - Skip Email] via main
              v
              [Collect Email Results] (Code) *** CONVERGENCE (3 inputs) ***
              |
              [Has Email to Verify?] (IF)
              |
              +--[TRUE]--+---[FALSE]--+
              |           |            |
              |  TRUE:    |            |
                [Hunter Verifier Enabled?] (IF)
                |
                +--[TRUE]--+---[FALSE]--+
                |           |            |
                |  TRUE:    |            |
                  |
                  | <-- [Has Email to Verify?] via FALSE
                  | <-- [Hunter Verifier Enabled?] via TRUE
                  v
                  [Skip Verification] (Code) *** CONVERGENCE (2 inputs) ***
                  |
                  |
                  | <-- [Skip Verification] via main
                  | <-- [Parse Verifier Response] via main
                  v
                  [Collect Verified Results] (Code) *** CONVERGENCE (2 inputs) ***
                  |
                  [Needs NamSor?] (IF)
                  |
                  +--[TRUE]--+---[FALSE]--+
                  |           |            |
                  |  TRUE:    |            |
                    [NamSor Origin] (HTTP)
                    |
                    [Parse NamSor Response] (Code)
                    |
                    |
                    | <-- [Parse NamSor Response] via main
                    | <-- [Skip NamSor] via main
                    v
                    [Collect NamSor Results] (Code) *** CONVERGENCE (2 inputs) ***
                    |
                    [Prepare Contact Update] (Code)
                    |
                    [Has Updates?] (IF)
                    |
                    +--[TRUE]--+---[FALSE]--+
                    |           |            |
                    |  TRUE:    |            |
                      [Update Contact in Supabase] (HTTP)
                      |
                      |
                      | <-- [Has Updates?] via FALSE
                      | <-- [Update Contact in Supabase] via main
                      v
                      [Collect Updates] (Code) *** CONVERGENCE (2 inputs) ***
                      |
                      [Run Summary4] (Code)
                      | (end)
                    |           |            |
                    |           |   FALSE:   |
                        --> [Collect Updates] (already shown above)
                  |           |            |
                  |           |   FALSE:   |
                      [Skip NamSor] (Code)
                      |
                      --> [Collect NamSor Results] (already shown above)
                |           |            |
                |           |   FALSE:   |
                    [Hunter Email Verifier] (HTTP)
                    |
                    [Parse Verifier Response] (Code)
                    |
                    --> [Collect Verified Results] (already shown above)
              |           |            |
              |           |   FALSE:   |
                  --> [Skip Verification] (already shown above)
            |           |            |
            |           |   FALSE:   |
                [Snov.io Enabled?] (IF)
                |
                +--[TRUE]--+---[FALSE]--+
                |           |            |
                |  TRUE:    |            |
                  [Skip Snov.io] (Code)
                  |
                  --> [Merge Email Results] (already shown above)
                |           |            |
                |           |   FALSE:   |
                    [Snov.io Email Finder] (HTTP)
                    |
                    [Parse Snov.io Response] (Code)
                    |
                    --> [Merge Email Results] (already shown above)
          |           |            |
          |           |   FALSE:   |
              [Hunter Email Finder] (HTTP)
              |
              [Parse Hunter Response] (Code)
              |
              --> [Hunter Found Email?] (already shown above)
        |           |            |
        |           |   FALSE:   |
            [No Domain - Skip Email] (Code)
            |
            --> [Collect Email Results] (already shown above)
      |           |            |
      |           |   FALSE:   |
          [Skip Email - Pass Through] (Code)
          |
          --> [Collect Email Results] (already shown above)

```

#### Connection Table

| # | Source | --Label--> | Target | Source Type | Target Type |
|---|--------|------------|--------|-------------|-------------|
| 1 | Bridge to 4 | main | Step 4 Config | code | set |
| 2 | Step 4 Config | main | Fetch Contacts | set | httpRequest |
| 3 | Fetch Contacts | main | Collapse to Single | httpRequest | code |
| 4 | Collapse to Single | main | Fetch Companies1 | code | httpRequest |
| 5 | Fetch Companies1 | main | Filter & Merge Contacts | httpRequest | code |
| 6 | Filter & Merge Contacts | main | Batch Empty?3 | code | if |
| 7 | Batch Empty?3 | FALSE | Needs Email? | if | if |
| 8 | Batch Empty?3 | TRUE | No Records - Done3 | if | code |
| 9 | Needs Email? | FALSE | Skip Email - Pass Through | if | code |
| 10 | Needs Email? | TRUE | Has Domain & Name? | if | if |
| 11 | Has Domain & Name? | FALSE | No Domain - Skip Email | if | code |
| 12 | Has Domain & Name? | TRUE | Hunter Enabled? | if | if |
| 13 | Hunter Enabled? | FALSE | Hunter Email Finder | if | httpRequest |
| 14 | Hunter Enabled? | TRUE | Skip Hunter | if | code |
| 15 | Hunter Email Finder | main | Parse Hunter Response | httpRequest | code |
| 16 | Skip Hunter | main | Hunter Found Email? | code | if |
| 17 | Parse Hunter Response | main | Hunter Found Email? | code | if |
| 18 | Hunter Found Email? | FALSE | Snov.io Enabled? | if | if |
| 19 | Hunter Found Email? | TRUE | Merge Email Results | if | code |
| 20 | Snov.io Enabled? | FALSE | Snov.io Email Finder | if | httpRequest |
| 21 | Snov.io Enabled? | TRUE | Skip Snov.io | if | code |
| 22 | Snov.io Email Finder | main | Parse Snov.io Response | httpRequest | code |
| 23 | Skip Email - Pass Through | main | Collect Email Results | code | code |
| 24 | Skip Snov.io | main | Merge Email Results | code | code |
| 25 | Parse Snov.io Response | main | Merge Email Results | code | code |
| 26 | Merge Email Results | main | Collect Email Results | code | code |
| 27 | No Domain - Skip Email | main | Collect Email Results | code | code |
| 28 | Collect Email Results | main | Has Email to Verify? | code | if |
| 29 | Has Email to Verify? | FALSE | Skip Verification | if | code |
| 30 | Has Email to Verify? | TRUE | Hunter Verifier Enabled? | if | if |
| 31 | Hunter Verifier Enabled? | FALSE | Hunter Email Verifier | if | httpRequest |
| 32 | Hunter Verifier Enabled? | TRUE | Skip Verification | if | code |
| 33 | Hunter Email Verifier | main | Parse Verifier Response | httpRequest | code |
| 34 | Skip Verification | main | Collect Verified Results | code | code |
| 35 | Parse Verifier Response | main | Collect Verified Results | code | code |
| 36 | Collect Verified Results | main | Needs NamSor? | code | if |
| 37 | Needs NamSor? | FALSE | Skip NamSor | if | code |
| 38 | Needs NamSor? | TRUE | NamSor Origin | if | httpRequest |
| 39 | NamSor Origin | main | Parse NamSor Response | httpRequest | code |
| 40 | Parse NamSor Response | main | Collect NamSor Results | code | code |
| 41 | Skip NamSor | main | Collect NamSor Results | code | code |
| 42 | Collect NamSor Results | main | Prepare Contact Update | code | code |
| 43 | Prepare Contact Update | main | Has Updates? | code | if |
| 44 | Has Updates? | FALSE | Collect Updates | if | code |
| 45 | Has Updates? | TRUE | Update Contact in Supabase | if | httpRequest |
| 46 | Update Contact in Supabase | main | Collect Updates | httpRequest | code |
| 47 | Collect Updates | main | Run Summary4 | code | code |

#### Input Count per Node

| Node | Type | Inputs | Sources |
|------|------|--------|---------|
| Bridge to 4 | code | 1 | Run Summary3 (main) |
| Step 4 Config | set | 1 | Bridge to 4 (main) |
| Fetch Contacts | httpRequest | 1 | Step 4 Config (main) |
| Collapse to Single | code | 1 | Fetch Contacts (main) |
| Fetch Companies1 | httpRequest | 1 | Collapse to Single (main) |
| Filter & Merge Contacts | code | 1 | Fetch Companies1 (main) |
| Batch Empty?3 | if | 1 | Filter & Merge Contacts (main) |
| No Records - Done3 | code | 1 | Batch Empty?3 (TRUE) |
| Needs Email? | if | 1 | Batch Empty?3 (FALSE) |
| Has Domain & Name? | if | 1 | Needs Email? (TRUE) |
| Hunter Enabled? | if | 1 | Has Domain & Name? (TRUE) |
| Hunter Email Finder | httpRequest | 1 | Hunter Enabled? (FALSE) |
| Skip Hunter | code | 1 | Hunter Enabled? (TRUE) |
| Parse Hunter Response | code | 1 | Hunter Email Finder (main) |
| Hunter Found Email? | if | 2 **CONVERGENCE** | Skip Hunter (main), Parse Hunter Response (main) |
| Snov.io Enabled? | if | 1 | Hunter Found Email? (FALSE) |
| Snov.io Email Finder | httpRequest | 1 | Snov.io Enabled? (FALSE) |
| Skip Email - Pass Through | code | 1 | Needs Email? (FALSE) |
| Skip Snov.io | code | 1 | Snov.io Enabled? (TRUE) |
| Parse Snov.io Response | code | 1 | Snov.io Email Finder (main) |
| Merge Email Results | code | 3 **CONVERGENCE** | Hunter Found Email? (TRUE), Skip Snov.io (main), Parse Snov.io Response (main) |
| No Domain - Skip Email | code | 1 | Has Domain & Name? (FALSE) |
| Collect Email Results | code | 3 **CONVERGENCE** | Skip Email - Pass Through (main), Merge Email Results (main), No Domain - Skip Email (main) |
| Has Email to Verify? | if | 1 | Collect Email Results (main) |
| Hunter Verifier Enabled? | if | 1 | Has Email to Verify? (TRUE) |
| Hunter Email Verifier | httpRequest | 1 | Hunter Verifier Enabled? (FALSE) |
| Skip Verification | code | 2 **CONVERGENCE** | Has Email to Verify? (FALSE), Hunter Verifier Enabled? (TRUE) |
| Parse Verifier Response | code | 1 | Hunter Email Verifier (main) |
| Collect Verified Results | code | 2 **CONVERGENCE** | Skip Verification (main), Parse Verifier Response (main) |
| Needs NamSor? | if | 1 | Collect Verified Results (main) |
| NamSor Origin | httpRequest | 1 | Needs NamSor? (TRUE) |
| Parse NamSor Response | code | 1 | NamSor Origin (main) |
| Skip NamSor | code | 1 | Needs NamSor? (FALSE) |
| Collect NamSor Results | code | 2 **CONVERGENCE** | Parse NamSor Response (main), Skip NamSor (main) |
| Prepare Contact Update | code | 1 | Collect NamSor Results (main) |
| Has Updates? | if | 1 | Prepare Contact Update (main) |
| Update Contact in Supabase | httpRequest | 1 | Has Updates? (TRUE) |
| Collect Updates | code | 2 **CONVERGENCE** | Has Updates? (FALSE), Update Contact in Supabase (main) |
| Run Summary4 | code | 1 | Collect Updates (main) |

---

## 3. Convergence Point Registry

Every node that receives input from 2 or more upstream paths. Formatted per investigation plan spec.

### Step 1: Discovery

```
CONVERGENCE: Wait 30s (wait)
  <- Source: Extract Run ID (via main)
  <- Source: Run Succeeded? (via FALSE)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Extract & Patch Domain, Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Merge All Sources (merge)
  <- Source: Normalize Google Results (via main)
  <- Source: Normalize Yelp Results (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Extract & Patch Domain, Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Run Summary (code)
  <- Source: Insert Flagged (Needs Review) (via main)
  <- Source: Insert to Supabase (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Extract & Patch Domain, Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

### Step 2: Company Enrichment

```
CONVERGENCE: Merge Backfill (merge)
  <- Source: Needs Backfill? (via FALSE)
  <- Source: Extract & Patch Domain (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Merge Website Results (code)
  <- Source: Analyze Website HTML (via main)
  <- Source: Skip - No Website (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Prepare Company Update (code)
  <- Source: Skip Google Details (via main)
  <- Source: Parse Google Details (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Wait FB 30s (wait)
  <- Source: Extract FB Run ID (via main)
  <- Source: FB Run Succeeded? (via FALSE)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Wait IG 30s (wait)
  <- Source: Extract IG Run ID (via main)
  <- Source: IG Run Succeeded? (via FALSE)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Run Summary1 (code)
  <- Source: Needs Social Discovery? (via FALSE)
  <- Source: Discovery Queries Exist? (via FALSE)
  <- Source: FB Matches Found? (via FALSE)
  <- Source: IG Matches Found? (via FALSE)
  <- Source: Insert Social Profiles (via main)
  <- Source: Insert FB Social Profiles (via main)
  <- Source: Insert IG Social Profiles (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

### Step 3b: Social Enrichment

```
CONVERGENCE: Run Summary2 (code)
  <- Source: Should Enrich? (via FALSE)
  <- Source: Update Social Profile in Supabase (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

### Step 3a: Find People

```
CONVERGENCE: Insert Contact to Supabase (httpRequest)
  <- Source: Validate & Clean Contact3 (via main)
  <- Source: Validate & Clean Contact4 (via main)
  <- Source: Validate & Clean Contact2 (via main)
  <- Source: Validate & Clean Contact1 (via main)
  <- Source: Validate & Clean Contact (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

```
CONVERGENCE: Run Summary3 (code)
  <- Source: About Found Name? (via FALSE)
  <- Source: No Domain Found Name? (via FALSE)
  <- Source: Insert Contact to Supabase (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response
```

### Step 4: Enrich People

```
CONVERGENCE: Hunter Found Email? (if)
  <- Source: Skip Hunter (via main)
  <- Source: Parse Hunter Response (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse Snov.io Response, Parse Verifier Response, Parse NamSor Response
```

```
CONVERGENCE: Merge Email Results (code)
  <- Source: Hunter Found Email? (via TRUE)
  <- Source: Skip Snov.io (via main)
  <- Source: Parse Snov.io Response (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse Verifier Response, Parse NamSor Response
```

```
CONVERGENCE: Collect Email Results (code)
  <- Source: Skip Email - Pass Through (via main)
  <- Source: Merge Email Results (via main)
  <- Source: No Domain - Skip Email (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse Verifier Response, Parse NamSor Response
```

```
CONVERGENCE: Skip Verification (code)
  <- Source: Has Email to Verify? (via FALSE)
  <- Source: Hunter Verifier Enabled? (via TRUE)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse NamSor Response
```

```
CONVERGENCE: Collect Verified Results (code)
  <- Source: Skip Verification (via main)
  <- Source: Parse Verifier Response (via main)
  RISK: HIGH
  DOWNSTREAM .item.json USAGE: Parse NamSor Response
```

```
CONVERGENCE: Collect NamSor Results (code)
  <- Source: Parse NamSor Response (via main)
  <- Source: Skip NamSor (via main)
  RISK: HIGH
```

```
CONVERGENCE: Collect Updates (code)
  <- Source: Has Updates? (via FALSE)
  <- Source: Update Contact in Supabase (via main)
  RISK: HIGH
```


---

## 4. Batch Execution Analysis — Step 4 Deep Dive

Step 4 (Enrich People) is where the critical batching bug lives. This section traces
the exact path structure that causes 12 of 13 contacts to lose their email verification.

### The Problem: Multi-Path Convergence Creates Separate Batches

When n8n encounters a node with multiple incoming connections, it creates **separate
execution batches** — one per upstream path. Each batch processes independently,
and downstream nodes see only the items from their batch.

### Step 4 Path Analysis

Starting from `Needs Email?`, contacts split into 3 possible paths:

```
                     [Needs Email?]
                     /            \
                  TRUE            FALSE
                   /                \
         [Has Domain & Name?]    [Skip Email - Pass Through]
          /            \                    |
       TRUE          FALSE                  |
        /              \                    |
  [Hunter Enabled?]  [No Domain - Skip Email]
    /          \                |            |
 TRUE        FALSE              |            |
  |            |                |            |
[Skip     [Hunter Email         |            |
 Hunter]   Finder]              |            |
  |            |                |            |
  |       [Parse Hunter         |            |
  |        Response]            |            |
  \          /                  |            |
   \        /                   |            |
  [Hunter Found Email?]         |            |
    /            \              |            |
 TRUE          FALSE            |            |
  |              |              |            |
  |        [Snov.io Enabled?]   |            |
  |          /         \        |            |
  |       TRUE        FALSE     |            |
  |        |            |       |            |
  |    [Skip        [Snov.io    |            |
  |     Snov.io]     Finder]    |            |
  |        |            |       |            |
  |        |       [Parse       |            |
  |        |        Snov.io]    |            |
  |        |          |         |            |
  +--------+----------+         |            |
           |                    |            |
  ***[Merge Email Results]***   |            |
     (3 inputs = 3 batches)     |            |
           |                    |            |
           +--------+-----------+            |
                    |                        |
       ***[Collect Email Results]***         |
          (3 inputs = 3 batches)             |
                    |                        |
          [Has Email to Verify?]             |
            /              \                 |
         TRUE            FALSE               |
          |                |                  |
  [Hunter Verifier     [Skip                 |
   Enabled?]            Verification]<-------+
    /        \              |
  TRUE      FALSE           |
   |          |             |
  [Skip    [Hunter Email    |
   Verif.]  Verifier]       |
   |          |             |
   +---->  [Parse Verifier  |
   |        Response]       |
   |          |             |
   +----------+-------------+
              |
  ***[Collect Verified Results]***
     (2 inputs = 2 batches)
              |
      [Needs NamSor?]
       /          \
    TRUE        FALSE
     |            |
  [NamSor      [Skip
   Origin]      NamSor]
     |            |
  [Parse NamSor   |
   Response]      |
     |            |
     +------------+
          |
  ***[Collect NamSor Results]***
     (2 inputs = 2 batches)
          |
  [Prepare Contact Update]
          |
     [Has Updates?]
      /          \
   TRUE        FALSE
    |            |
  [Update        |
   Contact]      |
    |            |
    +------------+
         |
  ***[Collect Updates]***
     (2 inputs = 2 batches)
         |
   [Run Summary4]
```

### Convergence Cascade Effect

The critical insight is that convergence points **cascade**. Each convergence creates
batches, and those batches propagate to downstream convergence points:

```
Layer 1:  Merge Email Results      <- 3 paths merge  -> creates up to 3 batches
Layer 2:  Collect Email Results     <- 3 paths merge  -> creates up to 3 batches
Layer 3:  Skip Verification        <- 2 paths merge  -> creates up to 2 batches per batch
Layer 4:  Collect Verified Results  <- 2 paths merge  -> creates up to 2 batches per batch
Layer 5:  Collect NamSor Results    <- 2 paths merge  -> creates up to 2 batches per batch
Layer 6:  Collect Updates           <- 2 paths merge  -> creates up to 2 batches per batch
```

With 13 contacts, if even 2 contacts take different paths through the email waterfall,
downstream nodes receive contacts in separate batches. Each `Collect *` node uses
`$('NodeName').all()` to try to gather all items, but `.all()` only sees items in the
**current batch**, not across all batches.

### Why Only 1 of 13 Gets Verified

Scenario with 13 contacts:
1. All 13 contacts enter `Needs Email?`
2. Some go TRUE (needs email), some go FALSE (skip)
3. TRUE contacts split further at `Has Domain & Name?`
4. At `Hunter Found Email?`, contacts split again based on whether Hunter found an email
5. Each unique path creates a separate batch at `Merge Email Results`
6. `Collect Email Results` receives 3 separate batches — each batch processed independently
7. Only the last batch (possibly just 1 contact) proceeds correctly through verification
8. Earlier batches may complete before later ones, causing race conditions

The `Collect *` Code nodes use `runOnceForAllItems` with `.all()` — but `.all()` within
a batch only returns items from **that batch**, not from all batches. So each batch
processes its subset independently, and the final `Run Summary4` only sees the last batch's results.

---

## 5. Risk Assessment: Convergence + `.item.json` Cross-Reference

This section cross-references convergence points from Section 3 with the `.item.json`
pairing patterns identified in Phase 1. When a Code node downstream of a convergence
point uses `$('NodeName').item.json`, the pairing can break because n8n pairs items
by index within each batch, not by contact ID.

### Risk Matrix

| Convergence Point | Step | Inputs | Downstream .item.json Users | Risk Level |
|-------------------|------|--------|----------------------------|------------|
| Wait 30s | Step 1: Discovery | 2 | Extract & Patch Domain, Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Merge All Sources | Step 1: Discovery | 2 | Extract & Patch Domain, Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Run Summary | Step 1: Discovery | 2 | Extract & Patch Domain, Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Merge Backfill | Step 2: Company Enrichment | 2 | Analyze Website HTML, Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Merge Website Results | Step 2: Company Enrichment | 2 | Parse Google Details, Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Prepare Company Update | Step 2: Company Enrichment | 2 | Prepare Social Processing, Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Wait FB 30s | Step 2: Company Enrichment | 2 | Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Wait IG 30s | Step 2: Company Enrichment | 2 | Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Run Summary1 | Step 2: Company Enrichment | 7 | Parse SociaVault Response, Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Run Summary2 | Step 3b: Social Enrichment | 2 | Parse Apollo Search, Parse About Page, Parse Apollo Enrich, Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Insert Contact to Supabase | Step 3a: Find People | 5 | Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Run Summary3 | Step 3a: Find People | 3 | Parse Hunter Response, Parse Verifier Response, Parse Snov.io Response, Parse NamSor Response | CRITICAL |
| Hunter Found Email? | Step 4: Enrich People | 2 | Parse Snov.io Response, Parse Verifier Response, Parse NamSor Response | CRITICAL |
| Merge Email Results | Step 4: Enrich People | 3 | Parse Verifier Response, Parse NamSor Response | CRITICAL |
| Collect Email Results | Step 4: Enrich People | 3 | Parse Verifier Response, Parse NamSor Response | CRITICAL |
| Skip Verification | Step 4: Enrich People | 2 | Parse NamSor Response | CRITICAL |
| Collect Verified Results | Step 4: Enrich People | 2 | Parse NamSor Response | CRITICAL |
| Collect NamSor Results | Step 4: Enrich People | 2 | (none) | HIGH |
| Collect Updates | Step 4: Enrich People | 2 | (none) | HIGH |

### Legend

- **CRITICAL:** Convergence point has downstream Code nodes using `.item.json` pairing — batching bugs will cause wrong items to pair
- **HIGH:** Convergence point exists (multiple batches created) but no `.item.json` pairing detected downstream — items may still be lost/duplicated via `.all()` within batches

### Important Note: Cross-Step Downstream Analysis

The "Downstream .item.json Users" column traces the full connection graph including across step
boundaries (via Bridge nodes). In practice, each step typically starts with a **fresh database fetch**
(e.g., `Fetch Batch from Supabase`, `Fetch Companies`, `Fetch Contacts`), which resets the batch
context. Therefore:

- **Within-step convergence** (e.g., Step 4's 7 convergence points) — **CONFIRMED HIGH RISK**. The
  batch chain is continuous from `Needs Email?` through `Run Summary4`.
- **Cross-step convergence** (e.g., Step 1 convergence affecting Step 4 nodes) — **LIKELY LOW RISK**
  because the Bridge + Config + Fetch pattern resets batching. Phase 3 (Code Audit) will verify this.

The Step 4 convergence cascade is the **primary bug location** — 7 convergence points in a single
unbroken batch chain, with `.item.json` pairing used at `Parse Hunter Response`, `Parse Snov.io Response`,
`Parse Verifier Response`, and `Parse NamSor Response`.

---

## 6. `.all()` Usage at Convergence Points

Even without `.item.json`, using `$('NodeName').all()` at convergence points is risky:
- `.all()` returns all items **in the current batch**, not all items globally
- When a node runs multiple times (once per batch), `.all()` from a specific upstream
  node returns the same items each time, causing **duplication**

| Code Node | Uses `.all()` from | At/Downstream of Convergence? | Risk |
|-----------|-------------------|-------------------------------|------|
| Run Summary | `Deduplicate Records` | YES | HIGH - may duplicate/lose items |
| Run Summary1 | `Parse Batch`, `Analyze Website HTML` | YES | HIGH - may duplicate/lose items |
| Run Summary2 | `Build SociaVault Request`, `Parse SociaVault Response` | YES | HIGH - may duplicate/lose items |
| Filter & Parse Batch | `Fetch Companies` | no | LOW |
| Run Summary3 | `Filter & Parse Batch`, `Prepare Solo Contact`, `Parse Apollo Search`, `Parse Apollo Enrich`, `Apollo Search Only Contact`, `Parse About Page`, `No Domain Fallback` | YES | HIGH - may duplicate/lose items |
| Filter & Merge Contacts | `Fetch Contacts`, `Fetch Companies1` | no | LOW |
| Collect Email Results | `Merge Email Results`, `Skip Email - Pass Through`, `No Domain - Skip Email` | YES | HIGH - may duplicate/lose items |
| Collect Verified Results | `Parse Verifier Response`, `Skip Verification` | YES | HIGH - may duplicate/lose items |
| Collect NamSor Results | `Parse NamSor Response`, `Skip NamSor` | YES | HIGH - may duplicate/lose items |
| Collect Updates | `Update Contact in Supabase`, `Has Updates?` | YES | HIGH - may duplicate/lose items |
| Run Summary4 | `Prepare Contact Update` | YES | HIGH - may duplicate/lose items |

---

## 7. Entry and Terminal Points

### Entry Points (no incoming connections)

- **When clicking ‘Execute workflow’** (manualTrigger) — Step 1: Discovery

### Terminal Points (no outgoing connections)

- **No Records - Done** (code) — Step 2: Company Enrichment
- **No Records - Done1** (code) — Step 3b: Social Enrichment
- **No Records - Done2** (code) — Step 3a: Find People
- **No Records - Done3** (code) — Step 4: Enrich People
- **Run Summary4** (code) — Step 4: Enrich People

---

## 8. Inter-Step Bridges

Connections that cross step boundaries:

- **Run Summary** (Step 1: Discovery) --main--> **Enrichment Config** (Step 2: Company Enrichment)
- **Run Summary1** (Step 2: Company Enrichment) --main--> **Bridge to 3b** (Step 3b: Social Enrichment)
- **Run Summary2** (Step 3b: Social Enrichment) --main--> **Bridge to 3a** (Step 3a: Find People)
- **Run Summary3** (Step 3a: Find People) --main--> **Bridge to 4** (Step 4: Enrich People)

---

## 9. Completeness Verification

- **Total nodes:** 151
- **Nodes in connection graph:** 151
- **Isolated nodes (no connections):** 0
- **Total edges:** 180
- **Convergence points:** 19
- **All convergence points documented:** YES
