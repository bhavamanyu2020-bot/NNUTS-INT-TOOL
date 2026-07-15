-- Row Level Security policies. This is the actual enforcement of CLAUDE.md's visibility
-- matrix (section 4.3) - it is NOT implemented in the UI. Depends on 001_helper_functions.sql.
--
-- Roles: super_admin | admin_onboarding | lead | member
--   super_admin       -> entire org
--   admin_onboarding  -> client data + onboarding-stage tasks
--   lead              -> own tasks + their team's tasks
--   member            -> only assigned tasks
--
-- Idempotent: every CREATE POLICY is preceded by DROP POLICY IF EXISTS so `pnpm db:sql` can be
-- re-run against the same database without erroring (see prisma/README.md's documented workflow).

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users / teams: readable by every authenticated user (assignment dropdowns,
-- nav, "who's on my team" etc need this); writes are super_admin-only.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS users_select_all ON users;
CREATE POLICY users_select_all ON users
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS users_write_super_admin ON users;
CREATE POLICY users_write_super_admin ON users
  FOR ALL TO authenticated
  USING (current_role_name() = 'super_admin')
  WITH CHECK (current_role_name() = 'super_admin');

DROP POLICY IF EXISTS teams_select_all ON teams;
CREATE POLICY teams_select_all ON teams
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS teams_write_super_admin ON teams;
CREATE POLICY teams_write_super_admin ON teams
  FOR ALL TO authenticated
  USING (current_role_name() = 'super_admin')
  WITH CHECK (current_role_name() = 'super_admin');

-- ---------------------------------------------------------------------------
-- clients: super_admin and admin_onboarding only. lead/member see client
-- context only indirectly, through their tasks - no direct clients access.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS clients_all_super_admin_onboarding ON clients;
CREATE POLICY clients_all_super_admin_onboarding ON clients
  FOR ALL TO authenticated
  USING (current_role_name() IN ('super_admin', 'admin_onboarding'))
  WITH CHECK (current_role_name() IN ('super_admin', 'admin_onboarding'));

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS tasks_select_super_admin ON tasks;
CREATE POLICY tasks_select_super_admin ON tasks
  FOR SELECT TO authenticated
  USING (current_role_name() = 'super_admin');

DROP POLICY IF EXISTS tasks_select_admin_onboarding ON tasks;
CREATE POLICY tasks_select_admin_onboarding ON tasks
  FOR SELECT TO authenticated
  USING (current_role_name() = 'admin_onboarding' AND stage = 'onboarding');

-- `OR assigned_by = auth.uid()` covers a lead's own just-created, still-unassigned task: without
-- it, `assigned_to IN (...)` is NULL (not true) for a NULL assigned_to, so the row that was just
-- inserted would be invisible to its own creator (P2.5).
DROP POLICY IF EXISTS tasks_select_lead ON tasks;
CREATE POLICY tasks_select_lead ON tasks
  FOR SELECT TO authenticated
  USING (
    current_role_name() = 'lead'
    AND (
      assigned_to = auth.uid()
      OR assigned_by = auth.uid()
      OR assigned_to IN (SELECT id FROM users WHERE team_id = current_team_id())
    )
  );

DROP POLICY IF EXISTS tasks_select_member ON tasks;
CREATE POLICY tasks_select_member ON tasks
  FOR SELECT TO authenticated
  USING (current_role_name() = 'member' AND assigned_to = auth.uid());

-- Creation/assignment: super_admin, admin_onboarding (onboarding-stage tasks), and leads
-- (assigning within their own team) can create tasks. Members cannot create tasks.
-- Whatever status/stage a non-super_admin sends is pinned to yet_to_start/onboarding by the
-- 007_task_insert_guard.sql trigger, so this policy doesn't need to (and can't cleanly) police
-- those columns itself.
DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    current_role_name() = 'super_admin'
    OR (current_role_name() = 'admin_onboarding' AND stage = 'onboarding')
    OR (
      current_role_name() = 'lead'
      AND (assigned_to IS NULL OR assigned_to IN (SELECT id FROM users WHERE team_id = current_team_id()))
    )
  );

-- Updates (status/stage transitions, reassignment): same visibility as SELECT. WITH CHECK
-- mirrors USING on every policy below (P2.3) - without that, e.g. a lead could USE their way
-- into a row via a team-task predicate and then WITH CHECK only re-verifies role, letting them
-- reassign the row to someone outside their team and lose visibility of it. The FSM/file-gate/
-- column-guard triggers (003-005, 009) independently guard which columns and values are legal
-- regardless of who is allowed to attempt the update.
DROP POLICY IF EXISTS tasks_update_super_admin ON tasks;
CREATE POLICY tasks_update_super_admin ON tasks
  FOR UPDATE TO authenticated
  USING (current_role_name() = 'super_admin')
  WITH CHECK (current_role_name() = 'super_admin');

DROP POLICY IF EXISTS tasks_update_admin_onboarding ON tasks;
CREATE POLICY tasks_update_admin_onboarding ON tasks
  FOR UPDATE TO authenticated
  USING (current_role_name() = 'admin_onboarding' AND stage = 'onboarding')
  WITH CHECK (current_role_name() = 'admin_onboarding' AND stage = 'onboarding');

DROP POLICY IF EXISTS tasks_update_lead ON tasks;
CREATE POLICY tasks_update_lead ON tasks
  FOR UPDATE TO authenticated
  USING (
    current_role_name() = 'lead'
    AND (
      assigned_to = auth.uid()
      OR assigned_by = auth.uid()
      OR assigned_to IN (SELECT id FROM users WHERE team_id = current_team_id())
    )
  )
  WITH CHECK (
    current_role_name() = 'lead'
    AND (
      assigned_to = auth.uid()
      OR assigned_by = auth.uid()
      OR assigned_to IN (SELECT id FROM users WHERE team_id = current_team_id())
    )
  );

DROP POLICY IF EXISTS tasks_update_member ON tasks;
CREATE POLICY tasks_update_member ON tasks
  FOR UPDATE TO authenticated
  USING (current_role_name() = 'member' AND assigned_to = auth.uid())
  WITH CHECK (current_role_name() = 'member' AND assigned_to = auth.uid());

DROP POLICY IF EXISTS tasks_delete_super_admin ON tasks;
CREATE POLICY tasks_delete_super_admin ON tasks
  FOR DELETE TO authenticated
  USING (current_role_name() = 'super_admin');

-- ---------------------------------------------------------------------------
-- task_files: visibility inherited from the parent task's SELECT policy set;
-- writes require the parent task be *update*-visible, not merely select-visible (P2.7) -
-- otherwise anyone who can merely see a task (e.g. another admin_onboarding) could attach files
-- to a task they have no assignment relationship to.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS task_files_select ON task_files;
CREATE POLICY task_files_select ON task_files
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_files.task_id));

DROP POLICY IF EXISTS task_files_insert ON task_files;
CREATE POLICY task_files_insert ON task_files
  FOR INSERT TO authenticated
  WITH CHECK (
    current_role_name() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_files.task_id
        AND (
          (current_role_name() = 'admin_onboarding' AND tasks.stage = 'onboarding')
          OR (
            current_role_name() = 'lead'
            AND (
              tasks.assigned_to = auth.uid()
              OR tasks.assigned_by = auth.uid()
              OR tasks.assigned_to IN (SELECT id FROM users WHERE team_id = current_team_id())
            )
          )
          OR (current_role_name() = 'member' AND tasks.assigned_to = auth.uid())
        )
    )
  );

-- Only the uploader may correct their own file row (e.g. a mistyped link); super_admin unrestricted.
DROP POLICY IF EXISTS task_files_update ON task_files;
CREATE POLICY task_files_update ON task_files
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR current_role_name() = 'super_admin')
  WITH CHECK (uploaded_by = auth.uid() OR current_role_name() = 'super_admin');

DROP POLICY IF EXISTS task_files_delete_super_admin ON task_files;
CREATE POLICY task_files_delete_super_admin ON task_files
  FOR DELETE TO authenticated
  USING (current_role_name() = 'super_admin');

-- ---------------------------------------------------------------------------
-- notifications: users see/manage only their own. INSERT is intentionally not
-- granted to authenticated roles here - notification delivery (out of scope
-- this phase) will insert via a service-role context (Edge Function/pg_cron).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS notifications_select_own ON notifications;
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_role_name() = 'super_admin');

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_log: read-only from the app's perspective. Writes happen exclusively via the
-- SECURITY DEFINER triggers in 008_audit_triggers.sql, never via a direct client INSERT -
-- see that file for why (enforcing "log every mutation" in app code, as round 1 did, is
-- unenforceable: RLS still permits a direct UPDATE that skips the server action entirely).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS audit_log_select_super_admin ON audit_log;
CREATE POLICY audit_log_select_super_admin ON audit_log
  FOR SELECT TO authenticated
  USING (current_role_name() = 'super_admin');
