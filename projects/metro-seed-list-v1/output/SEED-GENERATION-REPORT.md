# Metro Seed List Generation Report

**Generated:** 2026-02-27
**Run tag:** seed-5k-50k-20260227

## Data Sources

| Source | File | Records |
|--------|------|---------|
| Geography (lat/lon) | 2020 Census Gazetteer (`2020_Gaz_place_national.txt`) | 31,909 places |
| Population estimates | Census Subcounty Estimates 2024 (`sub-est2024.csv`) | 19,479 places |
| Merged input | `merged_places_2020.txt` | 19,449 matched places |

**Note:** The 2020 Gazetteer file does not include population data. A merge script (`merge_gazetteer_pop.py`) was created to join Gazetteer geography with Census subcounty population estimates (POPESTIMATE2020) by GEOID. The 12,460 unmatched records are primarily CDPs (Census Designated Places) not tracked in subcounty estimates.

## Run Parameters

| Parameter | Value |
|-----------|-------|
| Population range | 5,000 – 50,000 |
| Base radius | 50km |
| Isolated radius | 80km |
| Radius range | [25, 100]km |
| Big city threshold | 100,000 |
| CDPs included | No |

## Output Summary

| Metric | Value |
|--------|-------|
| **Total cities** | **3,987** |
| Rural (pop < 15k) | 2,441 (61.2%) |
| Suburban (15k–40k) | 1,345 (33.7%) |
| Metro (40k–50k) | 201 (5.0%) |
| States represented | 49 of 51 |
| Missing | DC, HI (no cities in 5k–50k range) |
| Canada border states | 1,160 cities |

### Radius Distribution

| Reason | Count | % |
|--------|-------|---|
| Proximity shrink (near big city) | 3,255 | 81.6% |
| Standard (50km) | 590 | 14.8% |
| Isolated (80km) | 142 | 3.6% |

| Stat | Value |
|------|-------|
| Min | 25km |
| Median | 25km |
| Max | 80km |
| Mean | 33.1km |

## Verification Results (8/8 PASS)

| # | Check | Result |
|---|-------|--------|
| 1 | Shape — row count + 12 columns | PASS (3,987 rows) |
| 2 | Territory filter — no PR/GU/AS/VI/MP | PASS |
| 3 | Population bounds — all within [5,000, 50,000] | PASS (min=5,000, max=49,974) |
| 4 | Radius sanity — range [25, 100]km, mixed reasons | PASS ([25, 80]km, 3 reason types) |
| 5 | Spot-check known cities | PASS (Price UT, Sterling CO, Vernal UT, Riverton UT, Durango CO, Clovis NM, Elko NV) |
| 6 | Geographic coverage — 49+ states | PASS (49 states; DC/HI legitimately absent) |
| 7 | Duplicate check — no duplicate (metro_name, state) | PASS |
| 8 | Lat/lon bounds — CONUS/AK/HI | PASS |

## SQL Files Generated

Execute in this order in Supabase SQL Editor:

```
1. 00-companies-migration.sql          — adds lat/lon columns + earthdistance extensions
2. 01-pipeline-queue-table.sql         — creates pipeline_queue table (with market_type, unique on metro_name+state)
3. 02-seed-pipeline-queue-batch01.sql  — rows 1-500
4. 02-seed-pipeline-queue-batch02.sql  — rows 501-1000
5. 02-seed-pipeline-queue-batch03.sql  — rows 1001-1500
6. 02-seed-pipeline-queue-batch04.sql  — rows 1501-2000
7. 02-seed-pipeline-queue-batch05.sql  — rows 2001-2500
8. 02-seed-pipeline-queue-batch06.sql  — rows 2501-3000
9. 02-seed-pipeline-queue-batch07.sql  — rows 3001-3500
10. 02-seed-pipeline-queue-batch08.sql — rows 3501-3987
11. 03-verify-seed.sql                 — verification queries
```

All SQL is idempotent (IF NOT EXISTS, ON CONFLICT DO UPDATE).

## Schema Changes

### `01-pipeline-queue-table.sql` (modified)
- **Added:** `market_type TEXT CHECK (market_type IN ('rural', 'suburban', 'metro'))`
- **Changed:** `UNIQUE (metro_name)` → `UNIQUE (metro_name, state)` to handle legitimate duplicates (e.g., Springfield IL vs Springfield MO)

### `00-companies-migration.sql` (new)
- **Added:** `latitude DECIMAL(8,4)`, `longitude DECIMAL(9,4)` columns to `companies`
- **Added:** `discovery_metro TEXT` (IF NOT EXISTS guard — already exists)
- **Enabled:** `cube` + `earthdistance` extensions
- **Added:** Indexes on `discovery_metro` and `(latitude, longitude)`

## Warnings

- **DC and HI missing:** No cities in the 5,000–50,000 population range. This is expected — DC is a single entity (pop 689k) and Hawaii's places either exceed 50k or are unincorporated (CDPs excluded).
- **Canada border states (1,160 cities):** Higher risk of Canadian business contamination in Google Places results. The pipeline already has country-filtering logic.
- **Population data is 2020 Census base:** Uses `POPESTIMATE2020` from subcounty estimates (April 2020 Census count). More recent estimates (2024) are available if preferred.

## Files Created

| File | Location |
|------|----------|
| CSV output | `projects/metro-seed-list-v1/output/metro_seed_5k-50k.csv` |
| Merge script | `projects/metro-seed-list-v1/merge_gazetteer_pop.py` |
| SQL generator | `projects/metro-seed-list-v1/generate_seed_sql.py` |
| Companies migration | `projects/queueing-system-v1/sql/00-companies-migration.sql` |
| Pipeline queue table | `projects/queueing-system-v1/sql/01-pipeline-queue-table.sql` (modified) |
| Seed SQL (8 batches) | `projects/queueing-system-v1/sql/02-seed-pipeline-queue-batch01..08.sql` |
| Verify SQL | `projects/queueing-system-v1/sql/03-verify-seed.sql` |
| This report | `projects/metro-seed-list-v1/output/SEED-GENERATION-REPORT.md` |
