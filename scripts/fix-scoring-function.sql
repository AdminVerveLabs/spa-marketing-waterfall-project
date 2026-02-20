-- Fix: calculate_lead_scores() blocked by "UPDATE requires a WHERE clause"
-- Supabase enforces WHERE clauses on UPDATE via PostgREST.
-- Fix: (1) add WHERE TRUE to the reset statement, (2) SECURITY DEFINER to bypass RLS.

CREATE OR REPLACE FUNCTION calculate_lead_scores()
RETURNS void AS $$
DECLARE
  rule RECORD;
  sql_text TEXT;
BEGIN
  -- Reset all scores to 0 (WHERE TRUE satisfies Supabase's WHERE-clause requirement)
  UPDATE companies SET lead_score = 0 WHERE TRUE;

  -- Apply each active rule
  FOR rule IN SELECT * FROM scoring_rules WHERE active = TRUE
  LOOP
    CASE rule.condition
      WHEN 'equals' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I::text = %L',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'not_equals' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I::text != %L',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'greater_than' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE (%I)::numeric > %s',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'less_than' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE (%I)::numeric < %s',
          rule.points, rule.field_name, rule.value
        );
      WHEN 'is_null' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I IS NULL',
          rule.points, rule.field_name
        );
      WHEN 'is_not_null' THEN
        sql_text := format(
          'UPDATE companies SET lead_score = lead_score + %s WHERE %I IS NOT NULL',
          rule.points, rule.field_name
        );
    END CASE;

    EXECUTE sql_text;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify it works
SELECT calculate_lead_scores();
SELECT name, lead_score FROM companies WHERE lead_score > 0 ORDER BY lead_score DESC LIMIT 5;
