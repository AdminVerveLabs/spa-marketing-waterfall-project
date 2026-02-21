-- Backfill historical pipeline runs into dashboard
-- One row per metro based on current Supabase data
-- Run in Supabase SQL Editor
--
-- 7 metros with discovery_metro data available.
-- 4 metros (Denver, Phoenix, Toronto, Portland) ran before discovery_metro
-- column existed and are NOT included — can backfill later.
--
-- triggered_by = 'backfill' distinguishes these from dashboard-triggered runs.
-- Asheville marked 'failed' (2 companies, 0 enriched).

INSERT INTO pipeline_runs (
  country, state, city, metro_name,
  latitude, longitude, radius_meters,
  search_queries, yelp_location,
  status, total_discovered, new_records, contacts_found,
  total_batches, completed_batches,
  triggered_by, started_at, completed_at, created_at
) VALUES
  ('US', 'TX', 'Austin', 'Austin, TX',
   30.2672, -97.7431, 15000,
   ARRAY['massage therapy','massage clinic','massage therapist','spa massage','therapeutic massage','deep tissue massage','sports massage','bodywork','day spa','wellness spa','relaxation massage','licensed massage therapist'],
   'Austin, TX',
   'completed', 318, 318, 156, 13, 13,
   'backfill', '2026-02-20T01:18:42Z', '2026-02-21T01:14:14Z', '2026-02-20T01:18:42Z'),

  ('US', 'ID', 'Boise', 'Boise, ID',
   43.6150, -116.2023, 25000,
   ARRAY['massage therapy','massage clinic','massage therapist','spa massage','therapeutic massage','deep tissue massage','sports massage','bodywork','day spa','wellness spa','relaxation massage','licensed massage therapist'],
   'Boise, ID',
   'completed', 168, 168, 34, 7, 7,
   'backfill', '2026-02-21T01:07:42Z', '2026-02-21T01:15:56Z', '2026-02-21T01:07:42Z'),

  ('US', 'TN', 'Nashville', 'Nashville, TN',
   36.1627, -86.7816, 15000,
   ARRAY['massage therapy','massage clinic','massage therapist','spa massage','therapeutic massage','deep tissue massage','sports massage','bodywork','day spa','wellness spa','relaxation massage','licensed massage therapist'],
   'Nashville, TN',
   'completed', 327, 327, 37, 13, 13,
   'backfill', '2026-02-20T15:58:06Z', '2026-02-21T01:14:14Z', '2026-02-20T15:58:06Z'),

  ('US', 'CA', 'San Diego', 'San Diego, CA',
   32.7157, -117.1611, 15000,
   ARRAY['massage therapy','massage clinic','massage therapist','spa massage','therapeutic massage','deep tissue massage','sports massage','bodywork','day spa','wellness spa','relaxation massage','licensed massage therapist'],
   'San Diego, CA',
   'completed', 305, 305, 68, 13, 13,
   'backfill', '2026-02-20T04:30:03Z', '2026-02-21T01:14:14Z', '2026-02-20T04:30:03Z'),

  ('US', 'AZ', 'Scottsdale', 'Scottsdale, AZ',
   33.4942, -111.9261, 15000,
   ARRAY['massage therapy','massage clinic','massage therapist','spa massage','therapeutic massage','deep tissue massage','sports massage','bodywork','day spa','wellness spa','relaxation massage','licensed massage therapist'],
   'Scottsdale, AZ',
   'completed', 196, 196, 41, 8, 8,
   'backfill', '2026-02-20T23:04:16Z', '2026-02-21T01:14:14Z', '2026-02-20T23:04:16Z'),

  ('US', 'AZ', 'Sedona', 'Sedona, AZ',
   34.8697, -111.7610, 15000,
   ARRAY['massage therapy','massage clinic','massage therapist','spa massage','therapeutic massage','deep tissue massage','sports massage','bodywork','day spa','wellness spa','relaxation massage','licensed massage therapist'],
   'Sedona, AZ',
   'completed', 268, 268, 40, 11, 11,
   'backfill', '2026-02-20T18:48:49Z', '2026-02-21T01:14:14Z', '2026-02-20T18:48:49Z'),

  ('US', 'NC', 'Asheville', 'Asheville, NC',
   35.5951, -82.5515, 15000,
   ARRAY['massage therapy','massage clinic','massage therapist','spa massage','therapeutic massage','deep tissue massage','sports massage','bodywork','day spa','wellness spa','relaxation massage','licensed massage therapist'],
   'Asheville, NC',
   'failed', 2, 2, 0, 0, 0,
   'backfill', '2026-02-20T18:09:40Z', '2026-02-20T18:09:40Z', '2026-02-20T18:09:40Z');
