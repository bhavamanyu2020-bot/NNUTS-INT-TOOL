-- Row Level Security policies. This is the actual enforcement of CLAUDE.md's visibility
-- matrix (section 4.3) - it is NOT implemented in the UI. Depends on 001_helper_functions.sql.
--
-- Roles: super_admin | admin_onboarding | lead | member
--   super_admin       -> entire org
--   admin_onboarding  -> client data + onboarding-stage tasks
--   lead              -> own tasks + their team's tasks
--   member            -> only assigned tasks

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

CREATE POLICY users_select_all ON users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_write_super_admin ON users
  FOR ALL TO authenticated
  USING (current_role_name() = 'super_admin')
  WITH CHECK (current_role_name() = 'super_admin');

CREATE POLICY teams_select_all ON teams
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY teams_write_super_admin ON teams
  FOR ALL TO authenticated
  USING (current_role_name() = 'super_admin')
  WITH CHECK (current_role_name() = 'super_admin');

-- ---------------------------------------------------------------------------
-- clients: super_admin and admin_onboarding only. lead/member see client
-- context only indirectly, through their tasks - no direct clients access.
-- ---------------------------------------------------------------------------

CREATE POLICY clients_all_super_admin_onboarding ON clients
  FOR ALL TO authenticated
  USING (current_role_name() IN ('super_admin', 'admin_onboarding'))
  WITH CHECK (current_role_name() IN ('super_admin', 'admin_onboarding'));

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

CREATE POLICY tasks_select_super_admin ON tasks
  FOR SELECT TO authenticated
  USING (current_role_name() = 'super_admin');

CREATE POLICY tasks_select_admin_onboarding ON tasks
  FOR SELECT TO authenticated
  USING (current_role_name() = 'admin_onboarding' AND stage = 'onboarding');

CREATE POLICY tasks_select_lead ON tasks
  FOR SELECT TO authenticated
  USING (
    current_role_name() = 'lead'
    AND (
      assigned_to = auth.uid()
      OR assigned_to IN (SELECT id FROM users WHERE team_id = current_team_id())
    )
  );

CREATE POLICY tasks_select_member ON tasks
  FOR SELECT TO authenticated
  USING (current_role_name() = 'member' AND assigned_to = auth.uid());

-- Creation/assignment: super_admin, admin_onboarding (onboarding-stage tasks), and leads
-- (assigning within their own team) can create tasks. Members cannot create tasks.
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

-- Updates (status/stage transitions, reassignment): same visibility as SELECT. The FSM/file-gate
-- triggers (003-005) independently guard what NEW.status/NEW.stage values are legal regardless
-- of who is allowed to attempt the update.
CREATE POLICY tasks_update_super_admin ON tasks
  FOR UPDATE TO authenticated
  USING (current_role_name() = 'super_admin')
  WITH CHECK (current_role_name() = 'super_admin');

CREATE POLICY tasks_update_admin_onboarding ON tasks
  FOR UPDATE TO authenticated
  USING (current_role_name() = 'admin_onboarding' AND stage = 'onboarding')
  WITH CHECK (current_role_name() = 'admin_onboarding');

CREATE POLICY tasks_update_lead ON tasks
  FOR UPDATE TO authenticated
  USING (
    current_role_name() = 'lead'
    AND (
      assigned_to = auth.uid()
      OR assigned_to IN (SELECT id FROM users WHERE team_id = current_team_id())
    )
  )
  WITH CHECK (current_role_name() = 'lead');

CREATE POLICY tasks_update_member ON tasks
  FOR UPDATE TO authenticated
  USING (current_role_name() = 'member' AND assigned_to = auth.uid())
  WITH CHECK (current_role_name() = 'member' AND assigned_to = auth.uid());

CREATE POLICY tasks_delete_super_admin ON tasks
  FOR DELETE TO authenticated
  USING (current_role_name() = 'super_admin');

-- ---------------------------------------------------------------------------
-- task_files: visibility/write inherited from the parent task's policy set.
-- ---------------------------------------------------------------------------

CREATE POLICY task_files_select ON task_files
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_files.task_id));

CREATE POLICY task_files_insert ON task_files
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_files.task_id));

CREATE POLICY task_files_delete_super_admin ON task_files
  FOR DELETE TO authenticated
  USING (current_role_name() = 'super_admin');

-- ---------------------------------------------------------------------------
-- notifications: users see/manage only their own. INSERT is intentionally not
-- granted to authenticated roles here - notification delivery (out of scope
-- this phase) will insert via a service-role context (Edge Function/pg_cron).
-- ---------------------------------------------------------------------------

CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_role_name() = 'super_admin');

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_log: append-only from the app's perspective. Any authenticated user
-- may log an action they themselves performed; only super_admin may read the log.
-- ---------------------------------------------------------------------------

CREATE POLICY audit_log_select_super_admin ON audit_log
  FOR SELECT TO authenticated
  USING (current_role_name() = 'super_admin');

CREATE POLICY audit_log_insert_own ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
