# Claude Code Guide — Metro Seed List Generation & Supabase Prep

Paste this into Claude Code to run the metro seed generation pipeline.

---

```
You are running the metro seed list generator for VerveLabs and preparing Supabase to receive the data. Follow every phase in order. Do not skip verification steps.

## CONTEXT

We have a Python script (`generate_metro_seed.py`) that processes US Census Gazetteer data to produce a CSV of small/rural US cities suitable for our spa marketing pipeline. Each city gets an isolation-based search radius to prevent "blowout" (where searches in small towns return results from nearby big cities).

The output CSV feeds into a `pipeline_queue` table in Supabase that drives automated pipeline runs.

## FILE LOCATIONS

- Script: `projects/queueing-system-v1/generate_metro_seed.py`
- Census data: Zack will have uploaded `2020_Gaz_place_national.txt` (tab-delimited, ~32k rows) — check `/uploads/` or project root for it
- Output goes to: `projects/queueing-system-v1/output/`

If the script isn't at that path, check the project root or `/uploads/`. The file might also be named with a `.zip` extension — if so, unzip it first.

## PHASE 1: Setup & Validate Input Data

1. Find the Census Gazetteer file. Look in uploads, project root, and common locations:
   ```bash
   find / -name "*Gaz_place*" -o -name "*gazetteer*" 2>/dev/null | head -20
   find / -name "generate_metro_seed*" 2>/dev/null | head -20
   ```

2. If the file is zipped, unzip it:
   ```bash
   unzip <filename>.zip -d projects/queueing-system-v1/
   ```

3. Validate the Gazetteer file looks correct:
   ```bash
   head -3 <path_to_gazetteer_file>
   wc -l <path_to_gazetteer_file>
   ```
   - Expected: ~32,000 lines, tab-delimited
   - First line should be headers: USPS, GEOID, ANSICODE, NAME, LSAD, FUNCSTAT, POP20, HU20, ALAND, AWATER, INTPTLAT, INTPTLONG
   - If the columns don't match this layout, STOP and tell Zack — the script depends on these column names

4. Quick sanity check — count places by state to make sure it's the full national file:
   ```bash
   awk -F'\t' 'NR>1 {print $1}' <gazetteer_file> | sort | uniq -c | sort -rn | head -20
   ```
   - Texas should have the most (~1,800+), then California, Pennsylvania, etc.
   - If you see PR, GU, AS, VI, MP — that's fine, the script filters them out

5. Create the output directory:
   ```bash
   mkdir -p projects/queueing-system-v1/output
   ```

## PHASE 2: Run the Script

Run the script with default parameters first (pop 5k-50k), then we'll review before any wider runs.

```bash
cd projects/queueing-system-v1

python generate_metro_seed.py \
  --input <path_to_gazetteer_file> \
  --pop-min 5000 \
  --pop-max 50000 \
  --output output/metro_seed_5k-50k.csv
```

**Capture the full terminal output** — it contains the summary stats we need to verify.

Expected output should show:
- 2,000-4,000 target cities (this is the sweet spot for pop 5k-50k)
- Big cities (100k+): ~300-400
- Radius distribution: mix of proximity_shrink, standard, and isolated
- No errors or missing column warnings

If the script errors, read the error message carefully:
- "Could not find required columns" → the Gazetteer file format is different than expected. Show Zack the first 3 lines of the file.
- Import errors → should be none, it's stdlib only. If somehow there are, fix them.

## PHASE 3: Verify the Output

This is the most important phase. Run ALL of these checks.

### 3a. Basic shape check
```bash
wc -l output/metro_seed_5k-50k.csv
head -1 output/metro_seed_5k-50k.csv
```
- Should have 2,000-4,000 data rows + 1 header
- Header: metro_name,state,latitude,longitude,radius_km,population,market_type,nearest_big_city,nearest_big_city_km,radius_reason,canada_border,run_tag

### 3b. Verify NO territories leaked through
```bash
awk -F',' 'NR>1 {print $2}' output/metro_seed_5k-50k.csv | sort -u | grep -E '^(PR|GU|AS|VI|MP)$'
```
- Expected: NO output. If any territory codes appear, there's a bug.

### 3c. Population bounds check
```python
import csv
with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    pops = [int(r['population']) for r in reader]
print(f"Min: {min(pops)}, Max: {max(pops)}, Count: {len(pops)}")
assert min(pops) >= 5000, f"Population below floor: {min(pops)}"
assert max(pops) <= 50000, f"Population above ceiling: {max(pops)}"
print("✅ Population bounds check passed")
```

### 3d. Radius sanity check
```python
import csv
with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

radii = [int(r['radius_km']) for r in rows]
print(f"Radius — Min: {min(radii)}, Max: {max(radii)}, Mean: {sum(radii)/len(radii):.1f}")
assert min(radii) >= 25, f"Radius below minimum: {min(radii)}"
assert max(radii) <= 100, f"Radius above maximum: {max(radii)}"

# Check distribution
from collections import Counter
reasons = Counter(r['radius_reason'].split(' ')[0] for r in rows)
print(f"Radius reasons: {dict(reasons)}")
# Should have a healthy mix. If ALL are "isolated" or ALL are "standard", something is off.
assert len(reasons) >= 2, "Only one radius reason — isolation logic may not be working"
print("✅ Radius sanity check passed")
```

### 3e. Spot-check known cities from Zack's test runs
```python
import csv
# These are cities from the rural market test — verify they appear with correct radii
check_cities = {
    ('Price', 'UT'): {'max_radius': 60},          # Should be standard or less, NOT 80 (too close to SLC corridor)
    ('Sterling', 'CO'): {'max_radius': 60},        # Must NOT reach Denver
    ('Vernal', 'UT'): {'min_radius': 60},          # Should be isolated, expanded
    ('Riverton', 'WY'): {'min_radius': 60},        # Should be isolated
    ('Scottsbluff', 'NE'): {'max_radius': 60},     # Not too big
    ('Durango', 'CO'): {'min_radius': 60},          # Tourist town, isolated
    ('Clovis', 'NM'): {},                           # Just verify it exists
    ('Elko', 'NV'): {'min_radius': 60},             # Isolated
}

with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    found = {}
    for r in reader:
        key = (r['metro_name'], r['state'])
        if key in check_cities:
            found[key] = r

print(f"\nSpot-check results ({len(found)}/{len(check_cities)} found):")
all_good = True
for city, constraints in check_cities.items():
    if city not in found:
        # Might not be in range — check if pop is 5k-50k
        print(f"  ⚠️  {city[0]}, {city[1]} — NOT FOUND (may be outside pop range)")
        continue
    
    r = found[city]
    radius = int(r['radius_km'])
    issues = []
    if 'max_radius' in constraints and radius > constraints['max_radius']:
        issues.append(f"radius {radius} > max {constraints['max_radius']}")
    if 'min_radius' in constraints and radius < constraints['min_radius']:
        issues.append(f"radius {radius} < min {constraints['min_radius']}")
    
    status = "✅" if not issues else "❌"
    detail = f"radius={radius}km, reason={r['radius_reason']}"
    if issues:
        detail += f" ISSUES: {', '.join(issues)}"
        all_good = False
    print(f"  {status} {city[0]}, {city[1]} — {detail}")

if all_good:
    print("\n✅ All spot checks passed")
else:
    print("\n❌ Some spot checks failed — review radius parameters")
```

### 3f. Geographic coverage check
```python
import csv
from collections import Counter

with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

states = Counter(r['state'] for r in rows)
print(f"\nState coverage: {len(states)} states")
print(f"Top 10: {states.most_common(10)}")

# Check for states with suspiciously few or zero cities
all_states = {'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
              'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
              'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
              'VA','WA','WV','WI','WY','DC'}
missing = all_states - set(states.keys())
if missing:
    print(f"\n⚠️  States with ZERO cities in range: {sorted(missing)}")
    print("   (DC and small states like RI/DE may legitimately have none)")
else:
    print("✅ All 50 states + DC represented")

# Market type distribution  
types = Counter(r['market_type'] for r in rows)
print(f"\nMarket types: {dict(types)}")

# Canada border flag
border = sum(1 for r in rows if r['canada_border'] == 'True')
print(f"Canada border cities: {border} ({border/len(rows)*100:.1f}%)")
print("✅ Geographic coverage check complete")
```

### 3g. Duplicate check
```python
import csv
from collections import Counter

with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    keys = [(r['metro_name'], r['state']) for r in reader]

dupes = [(k, c) for k, c in Counter(keys).items() if c > 1]
if dupes:
    print(f"❌ DUPLICATES FOUND: {len(dupes)}")
    for k, c in dupes[:10]:
        print(f"  {k[0]}, {k[1]} appears {c} times")
    print("This might be legitimate (some states have cities with the same name)")
    print("Review and decide if the pipeline_queue unique index needs adjustment")
else:
    print("✅ No duplicate metro_name+state combinations")
```

### 3h. Lat/lon sanity check (continental US bounds)
```python
import csv
with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    outliers = []
    for r in reader:
        lat, lon = float(r['latitude']), float(r['longitude'])
        # Continental US roughly: lat 24-50, lon -125 to -66
        # Alaska: lat 51-72, lon -170 to -130
        # Hawaii: lat 18-22, lon -160 to -154
        if not ((24 <= lat <= 50 and -125 <= lon <= -66) or   # CONUS
                (51 <= lat <= 72 and -170 <= lon <= -130) or   # Alaska
                (18 <= lat <= 23 and -161 <= lon <= -154)):    # Hawaii
            outliers.append(f"  {r['metro_name']}, {r['state']}: ({lat}, {lon})")
    
    if outliers:
        print(f"⚠️  {len(outliers)} cities with unusual coordinates:")
        for o in outliers[:10]:
            print(o)
    else:
        print("✅ All coordinates within US bounds")
```

## PHASE 4: Supabase Schema Verification

Check if the pipeline_queue table exists and whether the CSV columns align with it. This uses Supabase environment variables — check if they're available.

### 4a. Check for existing pipeline_queue table

If you have access to Supabase credentials (check env vars or project config files for SUPABASE_URL and SUPABASE_SERVICE_KEY):

```bash
# Look for Supabase credentials
grep -r "SUPABASE_URL\|SUPABASE_SERVICE_KEY\|supabase_url\|supabase_service_key" \
  .env* *.env projects/ --include="*.env" --include="*.json" --include="*.md" 2>/dev/null | head -10
```

If credentials are found, query the schema:

```python
import os, json
from urllib.request import Request, urlopen

SUPABASE_URL = os.environ.get('SUPABASE_URL', '<PASTE_IF_NOT_IN_ENV>')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '<PASTE_IF_NOT_IN_ENV>')

if '<PASTE' in SUPABASE_URL or '<PASTE' in SUPABASE_KEY:
    print("⚠️  Supabase credentials not found in env. Tell Zack to provide them or skip to Phase 4b.")
else:
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Check if pipeline_queue table exists by trying to query it
    try:
        req = Request(f'{SUPABASE_URL}/rest/v1/pipeline_queue?limit=1&select=*', headers=headers)
        resp = urlopen(req)
        data = json.loads(resp.read())
        print(f"✅ pipeline_queue table EXISTS with {len(data)} existing rows")
        if data:
            print(f"   Columns: {list(data[0].keys())}")
    except Exception as e:
        error_msg = str(e)
        if '404' in error_msg or 'relation' in error_msg.lower():
            print("⚠️  pipeline_queue table does NOT exist yet — needs to be created (see Phase 5)")
        else:
            print(f"❌ Error querying Supabase: {e}")
    
    # Check if companies table has lat/lon columns (needed for geo-filter)
    try:
        req = Request(f'{SUPABASE_URL}/rest/v1/companies?limit=1&select=latitude,longitude', headers=headers)
        resp = urlopen(req)
        print("✅ companies table HAS latitude/longitude columns")
    except Exception as e:
        if 'column' in str(e).lower():
            print("⚠️  companies table is MISSING latitude/longitude columns — migration needed (see Phase 5)")
        else:
            print(f"   Could not verify companies columns: {e}")
    
    # Check if discovery_metro column exists on companies
    try:
        req = Request(f'{SUPABASE_URL}/rest/v1/companies?limit=1&select=discovery_metro', headers=headers)
        resp = urlopen(req)
        print("✅ companies table HAS discovery_metro column")
    except Exception as e:
        if 'column' in str(e).lower():
            print("⚠️  companies table is MISSING discovery_metro column — migration needed (see Phase 5)")
        else:
            print(f"   Could not verify discovery_metro column: {e}")
    
    # Check existing companies count for reference
    try:
        req = Request(f'{SUPABASE_URL}/rest/v1/companies?select=id&limit=1', 
                      headers={**headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0'})
        resp = urlopen(req)
        count_header = resp.headers.get('content-range', '')
        print(f"   Existing companies: {count_header}")
    except:
        pass
```

### 4b. Column mapping verification (no Supabase needed)

Verify the CSV output columns map to the pipeline_queue table schema:

```python
import csv

with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    csv_columns = reader.fieldnames

# Expected pipeline_queue columns and their CSV source
column_mapping = {
    # pipeline_queue column      → CSV column (or note)
    'metro_name':                'metro_name',          # ✅ direct
    'state':                     'state',               # ✅ direct
    'latitude':                  'latitude',            # ✅ direct
    'longitude':                 'longitude',            # ✅ direct
    'radius_km':                 'radius_km',           # ✅ direct
    'population':                'population',           # ✅ direct
    'market_type':               'market_type',          # ✅ direct
    'status':                    '→ hardcode "pending"', # Set during INSERT
    'search_queries':            '→ use table default',  # Default ARRAY in schema
    'raw_discovered':            '→ default 0',          # Updated by pipeline
    'after_cleanup':             '→ default 0',          # Updated by pipeline
    'leads_found':               '→ default 0',          # Updated by pipeline
    'error_message':             '→ default NULL',       # Updated by pipeline
    'retry_count':               '→ default 0',          # Updated by pipeline
    'max_retries':               '→ default 3',          # Updated by pipeline
}

# Extra CSV columns NOT in pipeline_queue (useful metadata, not loaded)
extra_csv_columns = {
    'nearest_big_city':      'Reference only — useful for debugging radius',
    'nearest_big_city_km':   'Reference only — distance to nearest big city',
    'radius_reason':         'Reference only — why this radius was chosen',
    'canada_border':         'Reference only — flag for RMT contamination risk',
    'run_tag':               'Can be stored as a tag but not in base schema',
}

print("Column Mapping: CSV → pipeline_queue")
print("=" * 60)
for pq_col, csv_source in column_mapping.items():
    marker = "✅" if csv_source in csv_columns else "⚙️"
    print(f"  {marker} {pq_col:<25} ← {csv_source}")

print(f"\nExtra CSV columns (not loaded to pipeline_queue):")
for col, note in extra_csv_columns.items():
    present = "✅" if col in csv_columns else "❌"
    print(f"  {present} {col:<25} — {note}")

print(f"\n✅ Column mapping verified")
```

## PHASE 5: SQL Deliverables

Generate all the SQL Zack needs to run in Supabase SQL Editor. Write these to files.

### 5a. Create the SQL file for pipeline_queue + blocklists

**File:** `projects/queueing-system-v1/sql/01-pipeline-queue-and-blocklists.sql`

Use the schema from `projects/queueing-system-v1/queueing-system-guide.md` (Part 1 and Part 2). Copy it exactly — don't improvise the schema. The guide is the source of truth.

### 5b. Create the companies table migration SQL

**File:** `projects/queueing-system-v1/sql/00-companies-migration.sql`

```sql
-- Migration: Add columns needed for queue system and geo-filtering
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- Latitude/longitude for geo-filter distance calculations
-- Google Places API returns these — Step 1 should capture them during discovery
ALTER TABLE companies ADD COLUMN IF NOT EXISTS latitude DECIMAL(8,4);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,4);

-- Discovery metro tracking — which queue metro triggered this company's discovery
-- Critical for post-discovery cleanup scoping
ALTER TABLE companies ADD COLUMN IF NOT EXISTS discovery_metro TEXT;

-- Index for cleanup queries scoped by metro
CREATE INDEX IF NOT EXISTS idx_companies_discovery_metro ON companies (discovery_metro);

-- Extensions needed for geo-filter distance calculations
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
```

### 5c. Create the seed data INSERT SQL

**File:** `projects/queueing-system-v1/sql/02-seed-pipeline-queue.sql`

Generate this dynamically from the CSV:

```python
import csv

output_lines = [
    "-- Auto-generated seed data for pipeline_queue",
    "-- Source: generate_metro_seed.py output",
    f"-- Generated: {__import__('datetime').datetime.now().isoformat()}",
    "",
    "-- Upsert: safe to run multiple times (ON CONFLICT updates)",
    "INSERT INTO pipeline_queue (metro_name, state, latitude, longitude, radius_km, population, market_type, status)",
    "VALUES"
]

with open('output/metro_seed_5k-50k.csv') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

value_lines = []
for r in rows:
    value_lines.append(
        f"  ('{r['metro_name'].replace(chr(39), chr(39)+chr(39))}', "
        f"'{r['state']}', "
        f"{r['latitude']}, "
        f"{r['longitude']}, "
        f"{r['radius_km']}, "
        f"{r['population']}, "
        f"'{r['market_type']}', "
        f"'pending')"
    )

# Join with commas, last line gets semicolon
output_lines.append(',\n'.join(value_lines))
output_lines.append("ON CONFLICT (metro_name, state) DO UPDATE SET")
output_lines.append("  latitude = EXCLUDED.latitude,")
output_lines.append("  longitude = EXCLUDED.longitude,")
output_lines.append("  radius_km = EXCLUDED.radius_km,")
output_lines.append("  population = EXCLUDED.population,")
output_lines.append("  market_type = EXCLUDED.market_type;")
output_lines.append("")
output_lines.append(f"-- Total: {len(rows)} metros inserted/updated")

sql_content = '\n'.join(output_lines)

with open('projects/queueing-system-v1/sql/02-seed-pipeline-queue.sql', 'w') as f:
    f.write(sql_content)

print(f"✅ Generated SQL with {len(rows)} INSERT rows")
print(f"   File: projects/queueing-system-v1/sql/02-seed-pipeline-queue.sql")
print(f"   Size: {len(sql_content):,} bytes")

# Warn if file is very large
if len(rows) > 3000:
    print(f"\n⚠️  {len(rows)} rows is a lot for a single INSERT. Consider splitting:")
    print(f"   Supabase SQL Editor may timeout on very large statements.")
    print(f"   Alternative: split into batches of 500 rows each.")
```

**IMPORTANT:** If the generated SQL file is > 3,000 rows, split it into multiple files of 500 rows each:
- `02-seed-pipeline-queue-batch-1.sql` (rows 1-500)
- `02-seed-pipeline-queue-batch-2.sql` (rows 501-1000)
- etc.

This prevents Supabase SQL Editor timeouts.

### 5d. Verification query SQL

**File:** `projects/queueing-system-v1/sql/03-verify-seed.sql`

```sql
-- Run this AFTER loading seed data to verify everything looks right

-- 1. Total count
SELECT COUNT(*) as total_metros FROM pipeline_queue;

-- 2. Status distribution (all should be 'pending')
SELECT status, COUNT(*) FROM pipeline_queue GROUP BY status;

-- 3. Market type breakdown
SELECT market_type, COUNT(*) as count, 
       ROUND(AVG(population)) as avg_pop,
       ROUND(AVG(radius_km)) as avg_radius
FROM pipeline_queue 
GROUP BY market_type 
ORDER BY count DESC;

-- 4. State coverage
SELECT state, COUNT(*) as metros
FROM pipeline_queue 
GROUP BY state 
ORDER BY metros DESC;

-- 5. Radius distribution
SELECT 
  CASE 
    WHEN radius_km <= 30 THEN '25-30km (proximity shrink)'
    WHEN radius_km <= 55 THEN '31-55km (standard)'
    WHEN radius_km <= 85 THEN '56-85km (isolated)'
    ELSE '86-100km (max)'
  END as radius_bucket,
  COUNT(*) as count
FROM pipeline_queue
GROUP BY 1
ORDER BY 1;

-- 6. Spot check — look at the 10 test metros from rural audit
SELECT metro_name, state, radius_km, population, market_type
FROM pipeline_queue
WHERE (metro_name, state) IN (
  ('Price', 'UT'), ('Sterling', 'CO'), ('Vernal', 'UT'),
  ('Riverton', 'WY'), ('Scottsbluff', 'NE'), ('Lewistown', 'MT'),
  ('Alice', 'TX'), ('Elko', 'NV'), ('Durango', 'CO'), ('Clovis', 'NM')
)
ORDER BY state, metro_name;

-- 7. Any duplicates? (should be 0)
SELECT metro_name, state, COUNT(*) 
FROM pipeline_queue 
GROUP BY metro_name, state 
HAVING COUNT(*) > 1;
```

## PHASE 6: Summary & Handoff

After all phases complete, create a summary file:

**File:** `projects/queueing-system-v1/output/SEED-GENERATION-REPORT.md`

Include:
1. **Run parameters** — pop range, radius settings, run tag
2. **Total cities generated** — with state count
3. **Verification results** — pass/fail for each check in Phase 3
4. **Supabase status** — does pipeline_queue exist? What migrations are needed?
5. **SQL files generated** — list of files and what order to run them
6. **Recommended SQL execution order:**
   ```
   1. 00-companies-migration.sql          (adds lat/lon + discovery_metro to companies)
   2. 01-pipeline-queue-and-blocklists.sql (creates tables + cleanup functions)
   3. 02-seed-pipeline-queue.sql           (loads the metro seed data)
   4. 03-verify-seed.sql                   (verify everything loaded correctly)
   ```
7. **Flags/warnings** — any issues found, cities to review, large file splits needed
8. **Next steps for Zack**

## CRITICAL RULES

1. **Run ALL verification checks.** Don't skip any. If a check fails, flag it clearly but continue with remaining checks.

2. **Do NOT connect to Supabase to write data.** Only read (if credentials are available). All writes happen via SQL files that Zack runs manually.

3. **Escape single quotes in city names** when generating SQL. Use `''` (double single-quote) for names like "O'Fallon" or "Lee's Summit". This is critical — a missed quote will break the entire INSERT.

4. **If the CSV has > 3,000 rows**, split the INSERT SQL into batches. Supabase SQL Editor has execution time limits.

5. **Always create the output directory** before writing files. Use `mkdir -p`.

6. **Commit all generated files** with message: `feat(queue): generate metro seed list and SQL migrations`

## START NOW
Begin with Phase 1 — find the Census file and validate it.
```
