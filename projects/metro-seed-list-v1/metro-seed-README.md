# Metro Seed List Generator — README

## Quick Start

### 1. Download the Census Data (one-time)

Go to: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/

Download: **2020_Gaz_place_national.zip** (1.1 MB)

Unzip it. You'll get `2020_Gaz_place_national.txt` — a tab-delimited file with ~32,000 US places including population, lat/lon.

### 2. Run the Script

```bash
# Default: pop 5,000 - 50,000
python generate_metro_seed.py --input 2020_Gaz_place_national.txt

# Custom range
python generate_metro_seed.py --input 2020_Gaz_place_national.txt --pop-min 5000 --pop-max 75000

# Tag this run and exclude a previous batch
python generate_metro_seed.py --input 2020_Gaz_place_national.txt \
  --run-tag rural-batch-2 \
  --exclude metro_seed_rural-batch-1.csv
```

### 3. Review the Output

The script generates a CSV like:

| metro_name | state | latitude | longitude | radius_km | population | market_type | nearest_big_city | nearest_big_city_km | radius_reason | canada_border | run_tag |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Vernal | UT | 40.4555 | -109.5287 | 80 | 10508 | rural | Salt Lake City, UT | 202 | isolated | False | seed-5k-50k-20260228 |
| Sterling | CO | 40.6255 | -103.2078 | 50 | 14408 | rural | Fort Collins, CO | 158 | standard | False | seed-5k-50k-20260228 |

### 4. Load into pipeline_queue

The CSV columns map directly to the `pipeline_queue` table. Use the seed loader workflow (from the queueing system guide) or manual SQL.

---

## How Radius Calculation Works

The script prevents "blowout" (where small-town searches return big-city results) using isolation-based radius:

1. **Base radius:** 50km (default)
2. **Find nearest big city** (pop > 100k)
3. **If big city is close** (within 100km): shrink radius to half the distance
   - Example: Alice, TX is 66km from Corpus Christi → radius = 33km
4. **If very isolated** (nearest big city > 200km): expand to 80km
   - Example: Vernal, UT is 202km from SLC → radius = 80km
5. **Clamp** to [25km, 100km]

```
  [BIG CITY]
      |
      | 66km      ← Alice gets 33km radius (can't reach Corpus Christi)
      |
   [Alice, TX]
      |
      |--- 33km --→ search stops here


  [SLC]
      |
      | 202km     ← Vernal gets 80km radius (isolated, expanded)
      |
   [Vernal, UT]
      |
      |--- 80km --------→ search covers surrounding area
```

## All Options

```
--input FILE          Census Gazetteer file (required)
--pop-min N           Minimum population (default: 5000)
--pop-max N           Maximum population (default: 50000)
--base-radius N       Base search radius in km (default: 50)
--isolated-radius N   Expanded radius for isolated cities (default: 80)
--min-radius N        Minimum allowed radius (default: 25)
--max-radius N        Maximum allowed radius (default: 100)
--big-city-threshold N  What counts as "big" (default: 100000)
--isolation-threshold N Distance for "isolated" status (default: 200km)
--run-tag TAG         Tag this run (default: auto from date + range)
--exclude FILE [FILE] CSVs from previous runs to skip
--output FILE         Output path (default: auto from run tag)
--include-cdps        Include Census Designated Places (off by default)
```

## Run Management

Each output CSV has a `run_tag` column. To exclude previous runs:

```bash
# Batch 1: small towns
python generate_metro_seed.py --input data.txt --pop-min 5000 --pop-max 30000 --run-tag batch-1

# Batch 2: slightly bigger towns, skip batch 1
python generate_metro_seed.py --input data.txt --pop-min 5000 --pop-max 50000 \
  --run-tag batch-2 --exclude metro_seed_batch-1.csv

# Batch 3: even wider, skip both
python generate_metro_seed.py --input data.txt --pop-min 5000 --pop-max 75000 \
  --run-tag batch-3 --exclude metro_seed_batch-1.csv metro_seed_batch-2.csv
```

## Dependencies

Just Python 3.6+ standard library. No pip installs needed.
