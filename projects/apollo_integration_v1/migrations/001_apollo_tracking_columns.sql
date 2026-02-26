-- ============================================================
-- Apollo Sync Tracking Columns
-- Run this in Supabase SQL Editor before deploying the Apollo Sync workflow.
-- Safe to re-run (all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================

-- Add Apollo tracking columns to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS apollo_account_id TEXT,
  ADD COLUMN IF NOT EXISTS apollo_synced_at TIMESTAMPTZ;

-- Add Apollo tracking columns to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS apollo_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS apollo_synced_at TIMESTAMPTZ;

-- Index for sync queries: find fully_enriched companies that need syncing
CREATE INDEX IF NOT EXISTS idx_companies_apollo_sync
  ON companies (enrichment_status, apollo_synced_at);
