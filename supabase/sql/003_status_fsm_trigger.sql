-- DB-side enforcement of the task status lifecycle. This is defense in depth alongside the
-- TypeScript guard in lib/fsm/taskStatus.ts - keep both in sync if the transition table changes.
--
--   yet_to_start -> in_process
--   in_process -> changes_required | approval_sent
--   changes_required -> in_process
--   approval_sent -> completed | changes_required
--   completed -> (terminal)

CREATE OR REPLACE FUNCTION enforce_task_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (
    (OLD.status = 'yet_to_start' AND NEW.status = 'in_process')
    OR (OLD.status = 'in_process' AND NEW.status IN ('changes_required', 'approval_sent'))
    OR (OLD.status = 'changes_required' AND NEW.status = 'in_process')
    OR (OLD.status = 'approval_sent' AND NEW.status IN ('completed', 'changes_required'))
  ) THEN
    RAISE EXCEPTION 'Illegal task status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_status_fsm
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enforce_task_status_transition();
