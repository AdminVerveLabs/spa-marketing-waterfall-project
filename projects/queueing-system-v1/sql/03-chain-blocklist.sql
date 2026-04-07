-- ============================================================
-- 03-chain-blocklist.sql
-- Queuing System v1 — Chain Blocklist Table + Seed Data
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS chain_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_name TEXT NOT NULL,
  domain_pattern TEXT,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chain_blocklist_active
  ON chain_blocklist (active)
  WHERE active = TRUE;

COMMENT ON TABLE chain_blocklist IS 'Non-massage retail chains to remove. Massage franchises (Massage Envy, Elements) are intentionally KEPT.';

-- ============================================================
-- Seed data — non-massage retail chains only
-- Massage franchises (Massage Envy, Elements, etc.) are NOT blocked per Zack's decision
-- ============================================================

INSERT INTO chain_blocklist (chain_name, domain_pattern, reason) VALUES
  ('Sally Beauty', 'stores.sallybeauty.com', 'Cosmetics retail, not spa'),
  ('Ulta Beauty', 'ulta.com', 'Cosmetics retail, not spa'),
  ('RMT Supply', 'rmtsupplyhelena.com', 'Building materials store matching "RMT" search term'),
  ('RMT Equipment', 'rmtequipment.com', 'Equipment store matching "RMT" search term'),
  ('Arctic Spas', 'arcticspasgreatfalls.com', 'Hot tub retailer, not spa services')
ON CONFLICT DO NOTHING;
