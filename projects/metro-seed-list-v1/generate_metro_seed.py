#!/usr/bin/env python3
"""
VerveLabs Metro Seed List Generator
====================================
Generates a pipeline_queue-ready CSV from US Census Gazetteer data.

Features:
  - Configurable population range (min/max)
  - Isolation-based radius calculation (prevents blowout near big cities)
  - Run tagging for excluding previous runs
  - Excludes territories (PR, GU, AS, VI, MP)

Data Source:
  Download the 2020 Census Gazetteer Places file:
  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_place_national.zip
  
  Unzip it. The file inside is tab-delimited with columns:
  USPS | GEOID | ANSICODE | NAME | LSAD | FUNCSTAT | POP20 | HU20 | ALAND | AWATER | INTPTLAT | INTPTLONG

Usage:
  python generate_metro_seed.py --input 2020_Gaz_place_national.txt --pop-min 5000 --pop-max 50000
  python generate_metro_seed.py --input 2020_Gaz_place_national.txt --pop-min 5000 --pop-max 75000 --run-tag rural-batch-2 --exclude previous_run.csv
"""

import argparse
import csv
import math
import os
import sys
from datetime import datetime


# ============================================================
# CONFIGURATION DEFAULTS
# ============================================================
DEFAULT_POP_MIN = 5000
DEFAULT_POP_MAX = 50000
DEFAULT_BASE_RADIUS_KM = 50
DEFAULT_ISOLATED_RADIUS_KM = 80
DEFAULT_MIN_RADIUS_KM = 25
DEFAULT_MAX_RADIUS_KM = 100
DEFAULT_BIG_CITY_THRESHOLD = 100000  # Population above which a city is "big"
DEFAULT_PROXIMITY_DANGER_MULTIPLIER = 2.0  # If big city within base_radius * this, shrink
DEFAULT_ISOLATION_THRESHOLD_KM = 200  # If nearest big city > this, expand radius

# US territories to exclude
TERRITORIES = {'PR', 'GU', 'AS', 'VI', 'MP'}

# States that border Canada — extra note for Canadian contamination risk
CANADA_BORDER_STATES = {'WA', 'ID', 'MT', 'ND', 'MN', 'WI', 'MI', 'OH', 'PA', 'NY', 'VT', 'NH', 'ME'}


# ============================================================
# HAVERSINE DISTANCE
# ============================================================
def haversine_km(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two lat/lon points."""
    R = 6371.0  # Earth radius in km
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)
    
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


# ============================================================
# PARSE GAZETTEER FILE
# ============================================================
def parse_gazetteer(filepath):
    """
    Parse the 2020 Census Gazetteer Places file.
    Tab-delimited with columns:
    USPS  GEOID  ANSICODE  NAME  LSAD  FUNCSTAT  POP20  HU20  ALAND  AWATER  INTPTLAT  INTPTLONG
    
    LSAD codes for places:
      25 = city, 43 = town, 47 = village, 53 = CDP (Census Designated Place), etc.
    FUNCSTAT:
      A = Active government, S = Statistical entity (CDP), etc.
    """
    places = []
    
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        # Detect if first line is header
        first_line = f.readline()
        f.seek(0)
        
        # The gazetteer file is tab-delimited
        reader = csv.reader(f, delimiter='\t')
        header = next(reader)
        
        # Normalize header names (strip whitespace)
        header = [h.strip() for h in header]
        
        # Find column indices dynamically
        col_map = {}
        for i, h in enumerate(header):
            h_upper = h.upper()
            if h_upper in ('USPS',):
                col_map['state'] = i
            elif h_upper in ('NAME',):
                col_map['name'] = i
            elif h_upper in ('LSAD',):
                col_map['lsad'] = i
            elif h_upper in ('FUNCSTAT',):
                col_map['funcstat'] = i
            elif h_upper in ('POP20', 'POP10', 'POP'):
                col_map['pop'] = i
            elif h_upper in ('INTPTLAT',):
                col_map['lat'] = i
            elif h_upper in ('INTPTLONG', 'INTPTLON'):
                col_map['lon'] = i
            elif h_upper in ('GEOID',):
                col_map['geoid'] = i
        
        required = ['state', 'name', 'pop', 'lat', 'lon']
        missing = [r for r in required if r not in col_map]
        if missing:
            print(f"ERROR: Could not find required columns: {missing}")
            print(f"  Found headers: {header}")
            print(f"  Mapped: {col_map}")
            sys.exit(1)
        
        for row in reader:
            if len(row) < max(col_map.values()) + 1:
                continue
            
            try:
                state = row[col_map['state']].strip()
                name = row[col_map['name']].strip()
                pop = int(row[col_map['pop']].strip())
                lat = float(row[col_map['lat']].strip())
                lon = float(row[col_map['lon']].strip())
                lsad = row[col_map.get('lsad', 0)].strip() if 'lsad' in col_map else ''
                funcstat = row[col_map.get('funcstat', 0)].strip() if 'funcstat' in col_map else ''
                geoid = row[col_map.get('geoid', 0)].strip() if 'geoid' in col_map else ''
            except (ValueError, IndexError):
                continue
            
            places.append({
                'name': name,
                'state': state,
                'population': pop,
                'latitude': lat,
                'longitude': lon,
                'lsad': lsad,
                'funcstat': funcstat,
                'geoid': geoid,
            })
    
    return places


# ============================================================
# CALCULATE ISOLATION-BASED RADIUS
# ============================================================
def calculate_radius(target, big_cities, config):
    """
    Calculate the search radius for a target city based on isolation.
    
    Algorithm:
    1. Start with base_radius (default 50km)
    2. Find nearest city with pop > big_city_threshold (default 100k)
    3. If that big city is within (base_radius * danger_multiplier):
       → shrink radius to (distance_to_big_city / 2)
    4. If nearest big city is > isolation_threshold (200km):
       → expand radius to isolated_radius (80km)
    5. Clamp to [min_radius, max_radius]
    
    Returns: (radius_km, nearest_big_city_name, nearest_big_city_dist_km, radius_reason)
    """
    base = config['base_radius_km']
    isolated = config['isolated_radius_km']
    min_r = config['min_radius_km']
    max_r = config['max_radius_km']
    danger_zone = base * config['proximity_danger_multiplier']
    isolation_thresh = config['isolation_threshold_km']
    
    # Find nearest big city
    nearest_dist = float('inf')
    nearest_name = None
    
    for bc in big_cities:
        d = haversine_km(target['latitude'], target['longitude'],
                         bc['latitude'], bc['longitude'])
        if d < nearest_dist:
            nearest_dist = d
            nearest_name = f"{bc['name']}, {bc['state']}"
    
    # Determine radius
    if nearest_dist == float('inf'):
        # No big cities found (shouldn't happen for US)
        radius = isolated
        reason = 'no_big_city_found'
    elif nearest_dist < danger_zone:
        # Big city is close — shrink radius to avoid blowout
        radius = nearest_dist / 2
        reason = f'proximity_shrink ({nearest_name} is {nearest_dist:.0f}km away)'
    elif nearest_dist > isolation_thresh:
        # Very isolated — expand radius
        radius = isolated
        reason = f'isolated ({nearest_name} is {nearest_dist:.0f}km away)'
    else:
        # Normal case
        radius = base
        reason = f'standard ({nearest_name} is {nearest_dist:.0f}km away)'
    
    # Clamp
    radius = max(min_r, min(max_r, radius))
    
    return round(radius), nearest_name, round(nearest_dist), reason


# ============================================================
# LOAD EXCLUSION LIST
# ============================================================
def load_exclusions(exclude_files):
    """Load metro_name,state pairs from previous run CSVs to exclude."""
    excluded = set()
    
    for filepath in exclude_files:
        if not os.path.exists(filepath):
            print(f"WARNING: Exclusion file not found: {filepath}")
            continue
        
        with open(filepath, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = (row.get('metro_name', '').strip(), row.get('state', '').strip())
                if key[0] and key[1]:
                    excluded.add(key)
        
        print(f"  Loaded {len(excluded)} exclusions from {filepath}")
    
    return excluded


# ============================================================
# CLASSIFY MARKET TYPE
# ============================================================
def classify_market_type(pop):
    """Classify a city's market type based on population."""
    if pop < 15000:
        return 'rural'
    elif pop < 40000:
        return 'suburban'
    else:
        return 'metro'


# ============================================================
# MAIN
# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description='Generate pipeline_queue seed list from Census Gazetteer data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic run with defaults (pop 5k-50k)
  python generate_metro_seed.py --input 2020_Gaz_place_national.txt

  # Custom range
  python generate_metro_seed.py --input data.txt --pop-min 5000 --pop-max 75000

  # Exclude previous run and tag this one
  python generate_metro_seed.py --input data.txt --run-tag rural-batch-2 --exclude batch1.csv

  # Adjust radius parameters
  python generate_metro_seed.py --input data.txt --base-radius 60 --max-radius 120
        """
    )
    
    # Required
    parser.add_argument('--input', required=True,
                        help='Path to Census Gazetteer places file (tab-delimited)')
    
    # Population filters
    parser.add_argument('--pop-min', type=int, default=DEFAULT_POP_MIN,
                        help=f'Minimum population (default: {DEFAULT_POP_MIN})')
    parser.add_argument('--pop-max', type=int, default=DEFAULT_POP_MAX,
                        help=f'Maximum population (default: {DEFAULT_POP_MAX})')
    
    # Radius parameters
    parser.add_argument('--base-radius', type=int, default=DEFAULT_BASE_RADIUS_KM,
                        help=f'Base search radius in km (default: {DEFAULT_BASE_RADIUS_KM})')
    parser.add_argument('--isolated-radius', type=int, default=DEFAULT_ISOLATED_RADIUS_KM,
                        help=f'Expanded radius for isolated cities in km (default: {DEFAULT_ISOLATED_RADIUS_KM})')
    parser.add_argument('--min-radius', type=int, default=DEFAULT_MIN_RADIUS_KM,
                        help=f'Minimum allowed radius in km (default: {DEFAULT_MIN_RADIUS_KM})')
    parser.add_argument('--max-radius', type=int, default=DEFAULT_MAX_RADIUS_KM,
                        help=f'Maximum allowed radius in km (default: {DEFAULT_MAX_RADIUS_KM})')
    parser.add_argument('--big-city-threshold', type=int, default=DEFAULT_BIG_CITY_THRESHOLD,
                        help=f'Population threshold for "big city" (default: {DEFAULT_BIG_CITY_THRESHOLD})')
    parser.add_argument('--isolation-threshold', type=int, default=DEFAULT_ISOLATION_THRESHOLD_KM,
                        help=f'Distance threshold for "isolated" classification in km (default: {DEFAULT_ISOLATION_THRESHOLD_KM})')
    
    # Run management
    parser.add_argument('--run-tag', default=None,
                        help='Tag for this run (default: auto-generated from date + pop range)')
    parser.add_argument('--exclude', nargs='*', default=[],
                        help='CSV files from previous runs to exclude')
    
    # Output
    parser.add_argument('--output', default=None,
                        help='Output CSV path (default: auto-generated)')
    parser.add_argument('--include-cdps', action='store_true',
                        help='Include Census Designated Places (unincorporated communities). Off by default.')
    
    args = parser.parse_args()
    
    # Auto-generate run tag
    if not args.run_tag:
        args.run_tag = f"seed-{args.pop_min // 1000}k-{args.pop_max // 1000}k-{datetime.now().strftime('%Y%m%d')}"
    
    # Auto-generate output filename
    if not args.output:
        args.output = f"metro_seed_{args.run_tag}.csv"
    
    # Build config
    config = {
        'base_radius_km': args.base_radius,
        'isolated_radius_km': args.isolated_radius,
        'min_radius_km': args.min_radius,
        'max_radius_km': args.max_radius,
        'big_city_threshold': args.big_city_threshold,
        'proximity_danger_multiplier': DEFAULT_PROXIMITY_DANGER_MULTIPLIER,
        'isolation_threshold_km': args.isolation_threshold,
    }
    
    print(f"=" * 60)
    print(f"VerveLabs Metro Seed List Generator")
    print(f"=" * 60)
    print(f"  Input:          {args.input}")
    print(f"  Population:     {args.pop_min:,} - {args.pop_max:,}")
    print(f"  Base radius:    {config['base_radius_km']}km")
    print(f"  Isolated radius:{config['isolated_radius_km']}km")
    print(f"  Radius range:   [{config['min_radius_km']}, {config['max_radius_km']}]km")
    print(f"  Big city cutoff:{config['big_city_threshold']:,}")
    print(f"  Run tag:        {args.run_tag}")
    print(f"  Include CDPs:   {args.include_cdps}")
    print(f"  Output:         {args.output}")
    print()
    
    # ----------------------------------------------------------
    # Step 1: Parse the Gazetteer file
    # ----------------------------------------------------------
    print(f"[1/5] Parsing Gazetteer file...")
    all_places = parse_gazetteer(args.input)
    print(f"  Loaded {len(all_places):,} total places")
    
    # ----------------------------------------------------------
    # Step 2: Filter to US states only (exclude territories)
    # ----------------------------------------------------------
    us_places = [p for p in all_places if p['state'] not in TERRITORIES]
    print(f"  After excluding territories: {len(us_places):,}")
    
    # Optionally exclude CDPs (unincorporated areas)
    if not args.include_cdps:
        before = len(us_places)
        us_places = [p for p in us_places if p['lsad'] != '57']
        # Note: LSAD 57 = CDP. If column not available, this filter is a no-op
        cdps_removed = before - len(us_places)
        if cdps_removed > 0:
            print(f"  Excluded {cdps_removed:,} Census Designated Places (use --include-cdps to keep)")
    
    # ----------------------------------------------------------
    # Step 3: Separate big cities (for radius calculation) and target cities
    # ----------------------------------------------------------
    print(f"\n[2/5] Classifying cities...")
    big_cities = [p for p in us_places if p['population'] >= config['big_city_threshold']]
    target_cities = [p for p in us_places 
                     if args.pop_min <= p['population'] <= args.pop_max]
    
    print(f"  Big cities (pop >= {config['big_city_threshold']:,}): {len(big_cities):,}")
    print(f"  Target cities ({args.pop_min:,} - {args.pop_max:,}): {len(target_cities):,}")
    
    # ----------------------------------------------------------
    # Step 4: Load exclusions
    # ----------------------------------------------------------
    exclusions = set()
    if args.exclude:
        print(f"\n[3/5] Loading exclusion lists...")
        exclusions = load_exclusions(args.exclude)
        before = len(target_cities)
        target_cities = [c for c in target_cities 
                         if (c['name'], c['state']) not in exclusions]
        excluded_count = before - len(target_cities)
        print(f"  Excluded {excluded_count:,} previously processed cities")
        print(f"  Remaining targets: {len(target_cities):,}")
    else:
        print(f"\n[3/5] No exclusion lists provided, skipping")
    
    # ----------------------------------------------------------
    # Step 5: Calculate radius for each target city
    # ----------------------------------------------------------
    print(f"\n[4/5] Calculating isolation-based radius for {len(target_cities):,} cities...")
    
    results = []
    radius_stats = {'proximity_shrink': 0, 'isolated': 0, 'standard': 0, 'no_big_city_found': 0}
    canada_border_count = 0
    
    for i, city in enumerate(target_cities):
        if (i + 1) % 500 == 0:
            print(f"  Processing {i + 1:,}/{len(target_cities):,}...")
        
        radius, nearest_big, nearest_dist, reason = calculate_radius(city, big_cities, config)
        
        market_type = classify_market_type(city['population'])
        is_border = city['state'] in CANADA_BORDER_STATES
        if is_border:
            canada_border_count += 1
        
        # Track radius distribution
        reason_key = reason.split(' ')[0]
        radius_stats[reason_key] = radius_stats.get(reason_key, 0) + 1
        
        results.append({
            'metro_name': city['name'],
            'state': city['state'],
            'latitude': round(city['latitude'], 4),
            'longitude': round(city['longitude'], 4),
            'radius_km': radius,
            'population': city['population'],
            'market_type': market_type,
            'nearest_big_city': nearest_big or '',
            'nearest_big_city_km': nearest_dist if nearest_dist != float('inf') else '',
            'radius_reason': reason,
            'canada_border': is_border,
            'run_tag': args.run_tag,
        })
    
    # Sort by state, then name
    results.sort(key=lambda r: (r['state'], r['metro_name']))
    
    # ----------------------------------------------------------
    # Step 6: Write output
    # ----------------------------------------------------------
    print(f"\n[5/5] Writing {len(results):,} cities to {args.output}...")
    
    fieldnames = [
        'metro_name', 'state', 'latitude', 'longitude', 'radius_km',
        'population', 'market_type', 'nearest_big_city', 'nearest_big_city_km',
        'radius_reason', 'canada_border', 'run_tag'
    ]
    
    with open(args.output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    
    # ----------------------------------------------------------
    # Summary
    # ----------------------------------------------------------
    print(f"\n{'=' * 60}")
    print(f"SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Total cities generated: {len(results):,}")
    print(f"  Run tag:               {args.run_tag}")
    print(f"  Output file:           {args.output}")
    print()
    print(f"  Radius distribution:")
    for reason, count in sorted(radius_stats.items()):
        print(f"    {reason}: {count:,}")
    print()
    print(f"  Market type breakdown:")
    type_counts = {}
    for r in results:
        type_counts[r['market_type']] = type_counts.get(r['market_type'], 0) + 1
    for mt, count in sorted(type_counts.items()):
        print(f"    {mt}: {count:,}")
    print()
    print(f"  Canada border states: {canada_border_count:,} cities (higher RMT contamination risk)")
    print()
    
    # Radius percentiles
    radii = [r['radius_km'] for r in results]
    if radii:
        radii.sort()
        print(f"  Radius stats:")
        print(f"    Min:    {radii[0]}km")
        print(f"    Median: {radii[len(radii) // 2]}km")
        print(f"    Max:    {radii[-1]}km")
        print(f"    Mean:   {sum(radii) / len(radii):.1f}km")
    
    print()
    print(f"  Next steps:")
    print(f"  1. Review the CSV — spot-check cities you know")
    print(f"  2. Adjust --base-radius / --max-radius if needed and re-run")
    print(f"  3. Load into pipeline_queue via the seed loader workflow")
    print(f"  4. On future runs, use --exclude {args.output} to skip these cities")


if __name__ == '__main__':
    main()
