-- File-uploaded gate (CLAUDE.md section 4, rule 2): a task may only enter approval_sent
-- (and therefore, transitively, completed - completed is only reachable from approval_sent
-- per 003_status_fsm_trigger.sql) if it has at least one task_files row with a non-null
-- drive_link. Enforced here as a DB constraint, not left to frontend validation.

CREATE OR REPLACE FUNCTION enforce_file_upload_gate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approval_sent' AND NOT EXISTS (
    SELECT 1 FROM task_files WHERE task_id = NEW.id AND drive_link IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot move task % to approval_sent: no uploaded file with a drive link', NEW.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_file_upload_gate
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.status = 'approval_sent' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enforce_file_upload_gate();
