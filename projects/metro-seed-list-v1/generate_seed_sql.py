#!/usr/bin/env python3
"""
Generate SQL INSERT statements from metro seed CSV.

Reads the CSV output from generate_metro_seed.py and produces
idempotent SQL for loading into pipeline_queue.

Key conversions:
  - radius_km * 1000 → radius_meters (schema column)
  - Single quotes escaped for SQL safety (O'Fallon, Lee's Summit, etc.)
  - ON CONFLICT (metro_name, state) DO UPDATE for idempotent re-runs
  - Splits into batch files of 500 rows if > 3000 rows
"""

import csv
import os
import sys


def escape_sql(val):
    """Escape single quotes for SQL strings."""
    if val is None:
        return 'NULL'
    return val.replace("'", "''")


def generate_sql(csv_path, output_dir, batch_size=500):
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    total = len(rows)
    print(f"Generating SQL for {total:,} rows from {csv_path}")

    # Determine if we need to split
    need_split = total > 3000

    if need_split:
        num_batches = (total + batch_size - 1) // batch_size
        print(f"  Splitting into {num_batches} batch files of up to {batch_size} rows")
    else:
        num_batches = 1

    files_created = []

    for batch_idx in range(num_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, total)
        batch_rows = rows[start:end]

        if need_split:
            filename = f"02-seed-pipeline-queue-batch{batch_idx + 1:02d}.sql"
        else:
            filename = "02-seed-pipeline-queue.sql"

        filepath = os.path.join(output_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"-- ============================================================\n")
            f.write(f"-- {filename}\n")
            if need_split:
                f.write(f"-- Batch {batch_idx + 1}/{num_batches} — rows {start + 1}-{end} of {total}\n")
            else:
                f.write(f"-- Seed pipeline_queue with {total} metros\n")
            f.write(f"-- Generated from: {os.path.basename(csv_path)}\n")
            f.write(f"-- Idempotent: ON CONFLICT DO UPDATE\n")
            f.write(f"-- ============================================================\n\n")

            f.write("INSERT INTO pipeline_queue (\n")
            f.write("  metro_name, state, country, latitude, longitude,\n")
            f.write("  radius_meters, population, market_type, priority\n")
            f.write(")\nVALUES\n")

            for i, row in enumerate(batch_rows):
                metro_name = escape_sql(row['metro_name'])
                state = escape_sql(row['state'])
                lat = row['latitude']
                lon = row['longitude']
                radius_m = int(row['radius_km']) * 1000
                pop = int(row['population'])
                market_type = escape_sql(row['market_type'])

                # Priority: higher population = higher priority (processed first)
                # Scale 0-10 based on population within range
                priority = min(10, pop // 5000)

                comma = ',' if i < len(batch_rows) - 1 else ''
                f.write(f"  ('{metro_name}', '{state}', 'US', {lat}, {lon}, "
                        f"{radius_m}, {pop}, '{market_type}', {priority}){comma}\n")

            f.write("\nON CONFLICT ON CONSTRAINT uq_pipeline_queue_metro\nDO UPDATE SET\n")
            f.write("  latitude = EXCLUDED.latitude,\n")
            f.write("  longitude = EXCLUDED.longitude,\n")
            f.write("  radius_meters = EXCLUDED.radius_meters,\n")
            f.write("  population = EXCLUDED.population,\n")
            f.write("  market_type = EXCLUDED.market_type,\n")
            f.write("  priority = EXCLUDED.priority;\n")

        files_created.append(filepath)
        print(f"  Created: {filename} ({len(batch_rows)} rows)")

    return files_created


if __name__ == '__main__':
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'output/metro_seed_5k-50k.csv'
    output_dir = sys.argv[2] if len(sys.argv) > 2 else '../queueing-system-v1/sql'

    files = generate_sql(csv_path, output_dir)
    print(f"\nDone. {len(files)} file(s) created.")
