-- Closes an insert-time hole: 003/005 are BEFORE UPDATE only, and tasks_insert (002) doesn't
-- constrain status/stage - so a lead-or-above could INSERT a task straight at status='completed'
-- via PostgREST, skipping the lifecycle and the file gate entirely. Column DEFAULTs alone don't
-- prevent a client from setting a different value explicitly on insert.
--
-- Pins silently rather than raising - a BEFORE INSERT trigger sees NEW.status='yet_to_start'
-- identically whether the client omitted the column or explicitly sent it, because the DEFAULT
-- has already been applied by the time the trigger fires. "Raise if explicitly set to completed"
-- is not implementable from inside the trigger; pinning is the only coherent option.

CREATE OR REPLACE FUNCTION enforce_task_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_role_name() != 'super_admin' THEN
    NEW.status = 'yet_to_start';
    NEW.stage = 'onboarding';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_insert_guard ON tasks;
CREATE TRIGGER trg_task_insert_guard
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_task_insert_defaults();
