-- ============================================================
-- Phone Verification Schema Migration (Level 2: Telnyx)
-- Run in Supabase SQL Editor
-- ============================================================

-- contacts: phone verification columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_status TEXT
  CHECK (phone_status IN ('valid', 'invalid', 'disconnected', 'voip'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_line_type TEXT
  CHECK (phone_line_type IN ('mobile', 'landline', 'voip', 'toll_free'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_carrier TEXT;

-- companies: phone verification columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone_status TEXT
  CHECK (phone_status IN ('valid', 'invalid', 'disconnected', 'voip'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone_line_type TEXT
  CHECK (phone_line_type IN ('mobile', 'landline', 'voip', 'toll_free'));

-- Partial index: only contacts with phone but no verification status
CREATE INDEX IF NOT EXISTS idx_contacts_phone_status ON contacts (phone_status)
  WHERE phone_direct IS NOT NULL AND phone_status IS NULL;
