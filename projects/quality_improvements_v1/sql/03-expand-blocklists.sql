-- ============================================================
-- 03-expand-blocklists.sql
-- Lead Quality Improvements v1 — Phase 2 Priority 1
-- Expands category_blocklist + chain_blocklist
-- ALL use existing safe-term exemption in cleanup_category_blocklist()
-- ============================================================
-- IMPORTANT: Run 04-preview-new-filters.sql FIRST to verify impact
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PART 1: New category_blocklist patterns (~16 new)
-- Safe-term exemption automatically applied by cleanup function
-- (keeps companies whose category also contains Massage, Bodywork,
--  Day Spa, Wellness, or Therapeutic)
-- ════════════════════════════════════════════════════════════

INSERT INTO category_blocklist (id, category_pattern, reason, active)
VALUES
  -- Wrong business types (high count)
  (gen_random_uuid(), 'Chiropractor', 'Medical — not massage. Safe-term exemption protects "Chiro + Massage" combos (104 companies).', true),
  (gen_random_uuid(), 'Chiropractors', 'Medical — not massage (Yelp multi-category format).', true),
  (gen_random_uuid(), 'Acupuncture', 'Medical — not massage. Safe-term exemption protects combos.', true),
  (gen_random_uuid(), 'Medical Clinic', 'Medical — not massage.', true),
  (gen_random_uuid(), 'Medical Spa', 'Medical aesthetics — not massage. Safe-term exemption protects combos.', true),

  -- Fitness / wellness (not massage)
  (gen_random_uuid(), 'Gym', 'Fitness — not massage.', true),
  (gen_random_uuid(), 'Fitness center', 'Fitness — not massage.', true),
  (gen_random_uuid(), 'Fitness & Instruction', 'Fitness — not massage. Catches Yoga, Pilates combos too.', true),
  (gen_random_uuid(), 'Barbers', 'Grooming — not massage.', true),

  -- Medical / care (not massage)
  (gen_random_uuid(), 'Doulas', 'Birth services — not massage.', true),
  (gen_random_uuid(), 'Hospice', 'End-of-life care — not massage.', true),
  (gen_random_uuid(), 'Counseling & Mental Health', 'Mental health — not massage.', true),
  (gen_random_uuid(), 'IV Hydration', 'Medical — not massage.', true),
  (gen_random_uuid(), 'Body Contouring', 'Medical aesthetics — not massage. Safe-term exemption protects combos.', true),
  (gen_random_uuid(), 'Pain Management', 'Medical — not massage.', true),
  (gen_random_uuid(), 'Sauna', 'Facility amenity — not massage. Safe-term exemption protects spa+sauna combos.', true),

  -- Hospitality
  (gen_random_uuid(), 'Resort hotel', 'Hospitality — not massage business.', true)

ON CONFLICT (category_pattern) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- PART 2: Promote report-only junk categories to pipeline blocklist
-- These 8 were filtered in reports but NOT at discovery cleanup
-- (Corporate Office already exists in blocklist)
-- ════════════════════════════════════════════════════════════

INSERT INTO category_blocklist (id, category_pattern, reason, active)
VALUES
  (gen_random_uuid(), 'Car repair and maintenance service', 'Junk — promoted from report-only filter. 622 companies.', true),
  (gen_random_uuid(), 'Transportation Service', 'Junk — promoted from report-only filter.', true),
  (gen_random_uuid(), 'Car Rental Agency', 'Junk — promoted from report-only filter.', true),
  (gen_random_uuid(), 'Car Dealer', 'Junk — promoted from report-only filter.', true),
  (gen_random_uuid(), 'Educational Institution', 'Junk — promoted from report-only filter.', true),
  (gen_random_uuid(), 'Association / Organization', 'Junk — promoted from report-only filter.', true),
  (gen_random_uuid(), 'Storage Facility', 'Junk — promoted from report-only filter.', true),
  (gen_random_uuid(), 'Shipping Service', 'Junk — promoted from report-only filter.', true),
  (gen_random_uuid(), 'Store', 'Retail — not massage. Catches generic "Store" category.', true)

ON CONFLICT (category_pattern) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- PART 3: Add massage franchise brands to chain_blocklist
-- Reverses Queuing v1 Decision D4 (was: keep franchises)
-- New Decision D10: franchise locations can't make marketing decisions
-- ════════════════════════════════════════════════════════════

INSERT INTO chain_blocklist (id, chain_name, domain_pattern, reason, active)
VALUES
  (gen_random_uuid(), 'Massage Envy', 'massageenvy.com', 'Franchise — no independent marketing authority.', true),
  (gen_random_uuid(), 'Hand & Stone', 'handandstone.com', 'Franchise — no independent marketing authority.', true),
  (gen_random_uuid(), 'Elements Massage', 'elementsmassage.com', 'Franchise — no independent marketing authority.', true),
  (gen_random_uuid(), 'Massage Heights', 'massageheights.com', 'Franchise — no independent marketing authority. Also uses heightswellnessretreat.com.', true),
  (gen_random_uuid(), 'Massage Heights', 'heightswellnessretreat.com', 'Franchise — alternate domain for Massage Heights.', true),
  (gen_random_uuid(), 'Massage Luxe', 'massageluxe.com', 'Franchise — no independent marketing authority.', true),
  (gen_random_uuid(), 'LaVida Massage', 'lavidamassage.com', 'Franchise — no independent marketing authority.', true),
  (gen_random_uuid(), 'Spavia Day Spa', 'spaviadayspa.com', 'Franchise — no independent marketing authority.', true),
  (gen_random_uuid(), 'Massage Green Spa', 'massagegreenspa.com', 'Franchise — no independent marketing authority.', true)

ON CONFLICT DO NOTHING;
