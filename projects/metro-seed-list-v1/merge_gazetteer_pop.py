#!/usr/bin/env python3
"""
Merge Census Gazetteer geography (lat/lon) with subcounty population estimates.

Produces a tab-delimited file compatible with generate_metro_seed.py.

Usage:
  python merge_gazetteer_pop.py \
    --gazetteer 2020_Gaz_place_national.txt \
    --population sub-est2024.csv \
    --output merged_places.txt
"""

import argparse
import csv
import sys


def main():
    parser = argparse.ArgumentParser(description='Merge Gazetteer + population estimates')
    parser.add_argument('--gazetteer', required=True, help='Gazetteer places file (tab-delimited)')
    parser.add_argument('--population', required=True, help='Census subcounty population estimates CSV')
    parser.add_argument('--output', required=True, help='Output file (tab-delimited)')
    parser.add_argument('--pop-year', default='POPESTIMATE2020',
                        help='Population column to use (default: POPESTIMATE2020)')
    args = parser.parse_args()

    # --- Load population estimates ---
    # SUMLEV 162 = incorporated places + CDPs
    # GEOID = STATE (2 digits) + PLACE (5 digits) = 7 digits
    print(f"Loading population estimates from {args.population}...")
    pop_map = {}  # geoid -> population
    place_count = 0

    with open(args.population, 'r', encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for row in reader:
            sumlev = row.get('SUMLEV', '')
            if sumlev != '162':
                continue  # Only places (not states, counties, etc.)

            state_fips = row['STATE'].zfill(2)
            place_fips = row['PLACE'].zfill(5)
            geoid = state_fips + place_fips

            pop_str = row.get(args.pop_year, '').strip()
            if not pop_str:
                continue

            try:
                pop = int(pop_str)
            except ValueError:
                continue

            pop_map[geoid] = pop
            place_count += 1

    print(f"  Loaded {place_count:,} place population records")

    # --- Load Gazetteer and merge ---
    print(f"Loading Gazetteer from {args.gazetteer}...")
    matched = 0
    unmatched = 0

    with open(args.gazetteer, 'r', encoding='utf-8', errors='replace') as gaz_f, \
         open(args.output, 'w', newline='', encoding='utf-8') as out_f:

        gaz_reader = csv.reader(gaz_f, delimiter='\t')
        gaz_header = next(gaz_reader)
        gaz_header = [h.strip() for h in gaz_header]

        # Find column indices
        col_idx = {h.upper(): i for i, h in enumerate(gaz_header)}

        geoid_col = col_idx.get('GEOID')
        if geoid_col is None:
            print("ERROR: GEOID column not found in Gazetteer")
            sys.exit(1)

        # Write output header (tab-delimited, with POP column inserted after FUNCSTAT)
        out_header = gaz_header.copy()
        # Insert POP after FUNCSTAT
        funcstat_idx = col_idx.get('FUNCSTAT', len(gaz_header) - 1)
        insert_pos = funcstat_idx + 1
        out_header.insert(insert_pos, 'POP')

        out_f.write('\t'.join(out_header) + '\n')

        for row in gaz_reader:
            if len(row) < len(gaz_header):
                continue

            geoid_raw = row[geoid_col].strip()
            # Gazetteer GEOID may have leading zeros stripped, pad to 7
            geoid = geoid_raw.zfill(7)

            pop = pop_map.get(geoid)
            if pop is None:
                unmatched += 1
                continue  # Skip places with no population data

            # Build output row
            out_row = [c.strip() for c in row[:len(gaz_header)]]
            out_row.insert(insert_pos, str(pop))
            out_f.write('\t'.join(out_row) + '\n')
            matched += 1

    print(f"\n  Matched: {matched:,}")
    print(f"  Unmatched (no pop data): {unmatched:,}")
    print(f"  Output: {args.output}")


if __name__ == '__main__':
    main()
