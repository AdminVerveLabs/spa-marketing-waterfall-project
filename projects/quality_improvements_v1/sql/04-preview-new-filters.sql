-- ============================================================
-- 04-preview-new-filters.sql
-- Dry-run preview — shows what WOULD be deleted by new filters
-- ALL QUERIES ARE READ-ONLY
-- ============================================================

-- 1. Category blocklist expansion — companies that would be deleted
SELECT category, COUNT(*) AS would_delete
FROM companies c
WHERE EXISTS (
  SELECT 1 FROM (VALUES
    ('Chiropractor'), ('Chiropractors'), ('Acupuncture'), ('Medical Clinic'), ('Medical Spa'),
    ('Gym'), ('Fitness center'), ('Fitness & Instruction'), ('Barbers'),
    ('Doulas'), ('Hospice'), ('Counseling & Mental Health'), ('IV Hydration'),
    ('Body Contouring'), ('Pain Management'), ('Sauna'), ('Resort hotel'),
    ('Car repair and maintenance service'), ('Transportation Service'), ('Car Rental Agency'),
    ('Car Dealer'), ('Educational Institution'), ('Association / Organization'),
    ('Storage Facility'), ('Shipping Service'), ('Store')
  ) AS new_patterns(pattern)
  WHERE c.category ILIKE '%' || pattern || '%'
)
AND c.category NOT ILIKE '%Massage%'
AND c.category NOT ILIKE '%Bodywork%'
AND c.category NOT ILIKE '%Day Spa%'
AND c.category NOT ILIKE '%Wellness%'
AND c.category NOT ILIKE '%Therapeutic%'
GROUP BY category
ORDER BY would_delete DESC;

-- 2. Chain blocklist expansion — franchise companies that would be deleted
SELECT name, category, city, state, domain
FROM companies
WHERE name ILIKE '%Massage Envy%'
   OR name ILIKE '%Hand & Stone%' OR name ILIKE '%Hand and Stone%'
   OR name ILIKE '%Elements Massage%'
   OR name ILIKE '%Massage Heights%'
   OR name ILIKE '%Massage Luxe%' OR name ILIKE '%MassageLuXe%'
   OR name ILIKE '%LaVida Massage%' OR name ILIKE '%La Vida Massage%'
   OR name ILIKE '%Spavia%'
   OR name ILIKE '%Massage Green%'
ORDER BY name;

-- 3. Safe-term exemption check — companies that WOULD match but are KEPT
SELECT category, COUNT(*) AS kept_by_exemption
FROM companies c
WHERE EXISTS (
  SELECT 1 FROM (VALUES
    ('Chiropractor'), ('Chiropractors'), ('Acupuncture'), ('Medical Clinic'), ('Medical Spa'),
    ('Sauna'), ('Body Contouring')
  ) AS risky_patterns(pattern)
  WHERE c.category ILIKE '%' || pattern || '%'
)
AND (c.category ILIKE '%Massage%' OR c.category ILIKE '%Bodywork%'
  OR c.category ILIKE '%Day Spa%' OR c.category ILIKE '%Wellness%' OR c.category ILIKE '%Therapeutic%')
GROUP BY category
ORDER BY kept_by_exemption DESC;
