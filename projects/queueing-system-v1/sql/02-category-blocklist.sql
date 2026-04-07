-- ============================================================
-- 02-category-blocklist.sql
-- Queuing System v1 — Category Blocklist Table + Seed Data
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS category_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_pattern TEXT NOT NULL UNIQUE,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_blocklist_active
  ON category_blocklist (active)
  WHERE active = TRUE;

COMMENT ON TABLE category_blocklist IS 'Patterns matched via ILIKE against companies.category. Safe-term exemption prevents removing massage businesses.';

-- ============================================================
-- Seed data — from Q5 rural audit results
-- ============================================================

-- Pure non-spa categories
INSERT INTO category_blocklist (category_pattern, reason) VALUES
  ('Dental Clinic', 'Medical — not spa/massage'),
  ('Clothing Store', 'Retail — not spa/massage'),
  ('Mover', 'Service — not spa/massage'),
  ('Manufacturer', 'Industrial — not spa/massage'),
  ('Building Materials Store', 'Retail — RMT search term false positive'),
  ('Corporate Office', 'Office — not spa/massage'),
  ('Sports Activity Location', 'Recreation — not spa/massage'),
  ('Physical Therapist', 'Medical — not spa/massage')
ON CONFLICT (category_pattern) DO NOTHING;

-- Beauty-adjacent but not massage
INSERT INTO category_blocklist (category_pattern, reason) VALUES
  ('Nail Salon', 'Beauty — not massage. Safe-term exemption protects combos.'),
  ('Cosmetics Store', 'Retail cosmetics — not spa/massage'),
  ('Tanning Salon', 'Tanning — not spa/massage'),
  ('Hair Salon', 'Hair — not massage. Safe-term exemption protects "Massage + Hair Salon" combos.')
ON CONFLICT (category_pattern) DO NOTHING;
