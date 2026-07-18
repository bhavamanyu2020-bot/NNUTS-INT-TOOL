-- PLAN.md P5.1 remainder: overdue tasks, per-member load, average time-in-stage, per-client
-- pipeline health. 010_analytics_views.sql already covers task counts by status/stage and client
-- count - not edited here per this task's file scope. 013 and 014 were already taken
-- (013_notification_triggers.sql/P4.1, 014_notifications_realtime.sql/P4.2), 015 by
-- 015_deadline_reminders.sql/P4.3 - flagged, used next available number.
--
-- security_invoker = true on every view, copying 010's pattern exactly: without it a view runs
-- with its OWNER's rights, silently bypassing the underlying tasks/clients/audit_log RLS and
-- leaking every role's numbers to everyone who can query the view.
--
-- Explicitly NOT built: a single composite "pipeline health score" for clients. A score needs
-- weights (how much does "3 overdue tasks" subtract vs "shipped late twice"?), and weights are
-- not data that exists anywhere - they'd be invented. client_pipeline_health below is a factual
-- per-client breakdown instead: every number in it is a count(*) over real rows, nothing
-- synthesized.
--
-- audit_log's only SELECT policy is super_admin-only (002_rls_policies.sql, from P2.2 - not
-- touched here, out of this task's scope). task_stage_durations and avg_time_in_stage are built
-- entirely from audit_log, so for every other role they return zero rows, not a filtered subset -
-- this is an inherited consequence of an already-established policy, not a new gap.

-- ---------------------------------------------------------------------------
-- Overdue tasks
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW overdue_tasks
WITH (security_invoker = true) AS
SELECT
  id AS task_id,
  title,
  client_id,
  assigned_to,
  stage,
  status,
  deadline,
  now() - deadline AS overdue_by
FROM tasks
WHERE deadline IS NOT NULL
  AND deadline < now()
  AND status <> 'completed';

CREATE OR REPLACE VIEW overdue_task_count
WITH (security_invoker = true) AS
SELECT count(*) AS count FROM overdue_tasks;

-- ---------------------------------------------------------------------------
-- Per-member load: currently-active (not completed) assigned task count per member. Chained on
-- top of tasks directly (not overdue_tasks) - load includes every active task, not just overdue
-- ones.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW member_task_load
WITH (security_invoker = true) AS
SELECT assigned_to AS user_id, count(*) AS active_task_count
FROM tasks
WHERE assigned_to IS NOT NULL
  AND status <> 'completed'
GROUP BY assigned_to;

-- ---------------------------------------------------------------------------
-- Average time-in-stage, derived from audit_log's trigger-written history (008_audit_triggers.sql)
-- - this is what P2.2 was partly for. A task's stage history is reconstructed from two kinds of
-- audit_log rows: its 'create' row (the first stage begins there) and every 'update' row where
-- before->>'stage' actually differs from after->>'stage' (a new stage begins there). LEAD() gives
-- each segment's end time from the next segment's start; the most recent segment has no next
-- row, so left_at is NULL - it's still ongoing, not zero-duration.
--
-- 'delete' audit rows are not unioned in, so a deleted task's final stage segment is left with
-- left_at = NULL forever (indistinguishable from "still ongoing" once the task is gone). Doesn't
-- affect avg_time_in_stage below, which already excludes every NULL-left_at row regardless of why
-- it's null - noted here as a known limitation of this view specifically, not silently ignored.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW task_stage_durations
WITH (security_invoker = true) AS
WITH stage_events AS (
  SELECT entity_id AS task_id, (after ->> 'stage') AS stage, at AS entered_at
  FROM audit_log
  WHERE entity = 'tasks' AND action = 'create'
  UNION ALL
  SELECT entity_id AS task_id, (after ->> 'stage') AS stage, at AS entered_at
  FROM audit_log
  WHERE entity = 'tasks'
    AND action = 'update'
    AND (before ->> 'stage') IS DISTINCT FROM (after ->> 'stage')
)
SELECT
  task_id,
  stage,
  entered_at,
  LEAD(entered_at) OVER (PARTITION BY task_id ORDER BY entered_at) AS left_at,
  LEAD(entered_at) OVER (PARTITION BY task_id ORDER BY entered_at) - entered_at AS duration
FROM stage_events;

-- Only completed segments (left_at IS NOT NULL) are averaged - an ongoing stay of a few minutes
-- isn't comparable to a completed multi-day one, and including it would bias the average down
-- for no good reason.
CREATE OR REPLACE VIEW avg_time_in_stage
WITH (security_invoker = true) AS
SELECT stage, avg(duration) AS avg_duration, count(*) AS completed_segment_count
FROM task_stage_durations
WHERE left_at IS NOT NULL
GROUP BY stage;

-- ---------------------------------------------------------------------------
-- Per-client pipeline health: a factual breakdown, not a score (see file header). LEFT JOIN so a
-- client with zero tasks still appears with all counts at 0, not missing entirely.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW client_pipeline_health
WITH (security_invoker = true) AS
SELECT
  c.id AS client_id,
  c.brand_name,
  count(t.id) AS total_tasks,
  count(t.id) FILTER (WHERE t.status <> 'completed') AS active_tasks,
  count(t.id) FILTER (
    WHERE t.status <> 'completed' AND t.deadline IS NOT NULL AND t.deadline < now()
  ) AS overdue_tasks,
  count(t.id) FILTER (WHERE t.status = 'completed') AS completed_tasks
FROM clients c
LEFT JOIN tasks t ON t.client_id = c.id
GROUP BY c.id, c.brand_name;
