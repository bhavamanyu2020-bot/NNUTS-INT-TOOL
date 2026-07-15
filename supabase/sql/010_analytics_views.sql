-- Dashboard aggregates as Postgres views (CLAUDE.md section 5: "derived... not app-layer
-- aggregation"). A small subset of PLAN.md's P5.1, sized to what the redesigned /dashboard needs.
--
-- security_invoker = true is not the Postgres default and is NOT optional here: without it, a
-- view runs with its OWNER's table-access rights rather than the querying user's, which silently
-- bypasses the underlying tasks/clients RLS policies and leaks every role's numbers to everyone
-- who can query the view. Requires Postgres 15+ (Supabase's current default).

CREATE OR REPLACE VIEW task_counts_by_status
WITH (security_invoker = true) AS
SELECT status, count(*) AS count
FROM tasks
GROUP BY status;

CREATE OR REPLACE VIEW task_counts_by_stage
WITH (security_invoker = true) AS
SELECT stage, count(*) AS count
FROM tasks
GROUP BY stage;

CREATE OR REPLACE VIEW client_count
WITH (security_invoker = true) AS
SELECT count(*) AS count
FROM clients;
