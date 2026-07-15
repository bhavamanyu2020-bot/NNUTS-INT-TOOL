-- DB-side enforcement of the task pipeline stage. Defense in depth alongside
-- lib/fsm/taskStage.ts - keep both in sync if the transition table changes.
--
-- Linear forward-only: onboarding -> marketing -> production -> post_production -> closed.
-- super_admin may bypass (stage overrides/corrections), matching the app-layer
-- forceStageTransition action which is gated by role, not by loosening this guard for everyone.

CREATE OR REPLACE FUNCTION enforce_task_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_role_name() = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.stage = 'onboarding' AND NEW.stage = 'marketing')
    OR (OLD.stage = 'marketing' AND NEW.stage = 'production')
    OR (OLD.stage = 'production' AND NEW.stage = 'post_production')
    OR (OLD.stage = 'post_production' AND NEW.stage = 'closed')
  ) THEN
    RAISE EXCEPTION 'Illegal task stage transition: % -> %', OLD.stage, NEW.stage
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_stage_fsm
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION enforce_task_stage_transition();
