-- File-uploaded gate (CLAUDE.md section 4, rule 2): a task may only enter approval_sent
-- (and therefore, transitively, completed - completed is only reachable from approval_sent
-- per 003_status_fsm_trigger.sql) if it has at least one attached task_files row. Enforced here
-- as a DB constraint, not left to frontend validation.
--
-- Note: task_files.drive_link is NOT NULL at the schema level, so "drive_link IS NOT NULL" would
-- always be true and is not a meaningful predicate - the real condition is just row existence.

CREATE OR REPLACE FUNCTION enforce_file_upload_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approval_sent' AND NOT EXISTS (
    SELECT 1 FROM task_files WHERE task_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Cannot move task % to approval_sent: no file attached', NEW.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_file_upload_gate ON tasks;
CREATE TRIGGER trg_task_file_upload_gate
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.status = 'approval_sent' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enforce_file_upload_gate();
