-- Back up hub_runs, hub_run_history and audit objects first.
-- Deploy the previous application before executing this manual rollback.
-- JSON additions in hub_runs are backward compatible and remain untouched.
DROP TABLE IF EXISTS hub_run_history;
DELETE FROM render_schema_migrations WHERE name='0021_audit_reports.sql';
