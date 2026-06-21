-- Add sort_order columns for manual case ordering within test plans and runs

ALTER TABLE test_plan_case_links
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE test_run_case_links
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE test_run_report_case_links
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS test_plan_case_links_plan_sort_order_idx
  ON test_plan_case_links (plan, sort_order);

CREATE INDEX IF NOT EXISTS test_run_case_links_run_sort_order_idx
  ON test_run_case_links (run, sort_order);

CREATE INDEX IF NOT EXISTS test_run_report_case_links_report_sort_order_idx
  ON test_run_report_case_links (report, sort_order);

-- Backfill plan links by case_id within each plan
WITH ranked AS (
  SELECT
    tpc.plan,
    tpc.case,
    ROW_NUMBER() OVER (
      PARTITION BY tpc.plan
      ORDER BY tc.case_id NULLS LAST, tpc.case
    ) - 1 AS new_sort_order
  FROM test_plan_case_links tpc
  JOIN test_cases tc ON tc.id = tpc.case
)
UPDATE test_plan_case_links tpc
SET sort_order = ranked.new_sort_order
FROM ranked
WHERE tpc.plan = ranked.plan AND tpc.case = ranked.case;

-- Backfill run links by case_id within each run
WITH ranked AS (
  SELECT
    trc.run,
    trc.case,
    ROW_NUMBER() OVER (
      PARTITION BY trc.run
      ORDER BY tc.case_id NULLS LAST, trc.case
    ) - 1 AS new_sort_order
  FROM test_run_case_links trc
  JOIN test_cases tc ON tc.id = trc.case
)
UPDATE test_run_case_links trc
SET sort_order = ranked.new_sort_order
FROM ranked
WHERE trc.run = ranked.run AND trc.case = ranked.case;

-- Backfill report links by case_id within each report
WITH ranked AS (
  SELECT
    trrc.report,
    trrc.case,
    ROW_NUMBER() OVER (
      PARTITION BY trrc.report
      ORDER BY tc.case_id NULLS LAST, trrc.case
    ) - 1 AS new_sort_order
  FROM test_run_report_case_links trrc
  JOIN test_cases tc ON tc.id = trrc.case
)
UPDATE test_run_report_case_links trrc
SET sort_order = ranked.new_sort_order
FROM ranked
WHERE trrc.report = ranked.report AND trrc.case = ranked.case;
