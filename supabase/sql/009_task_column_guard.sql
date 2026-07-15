-- Closes a column-authorization gap: tasks_update_member (002) lets a member update ANY column
-- of their own task - deadline, stage, client_id, title - not just status. The FSM triggers
-- police which status/stage VALUES are legal, never who may change which COLUMNS.
--
-- member   : status only.
-- lead     : status, stage, assigned_to, deadline (assignment is already scoped to their team by
--            the tasks_update_lead RLS predicate - this trigger only restricts which columns,
--            not which values).
-- admin_onboarding / super_admin: unrestricted (admin_onboarding is still row-scoped to
--            onboarding-stage tasks by RLS).

CREATE OR REPLACE FUNCTION enforce_task_column_authorization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  role_name role := current_role_name();
BEGIN
  IF role_name IN ('super_admin', 'admin_onboarding') THEN
    RETURN NEW;
  END IF;

  IF role_name = 'member' THEN
    IF NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
      OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
      OR NEW.stage IS DISTINCT FROM OLD.stage
      OR NEW.service_type IS DISTINCT FROM OLD.service_type
      OR NEW.deadline IS DISTINCT FROM OLD.deadline
    THEN
      RAISE EXCEPTION 'member may only change task status' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF role_name = 'lead' THEN
    IF NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
      OR NEW.service_type IS DISTINCT FROM OLD.service_type
    THEN
      RAISE EXCEPTION 'lead may only change status, stage, assigned_to, and deadline' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_column_guard ON tasks;
CREATE TRIGGER trg_task_column_guard
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_task_column_authorization();
