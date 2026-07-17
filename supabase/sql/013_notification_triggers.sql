-- PLAN.md P4.1: notification writes. RLS grants no client INSERT on notifications (see
-- 002_rls_policies.sql's comment on that table) - delivery is meant to arrive via a trusted
-- server-side context, which these SECURITY DEFINER triggers are. No delivery/UI yet (P4.2).
--
-- Payload shapes are the counterpart of lib/schemas/notification.ts - every jsonb_build_object(...)
-- below must produce exactly what that file's discriminated union parses. Keep both in sync by
-- hand if either changes. deadline_reminder is a real NotificationType value but has no producing
-- trigger here - that's P4.3 (pg_cron), deliberately not built yet.

-- An earlier draft of this file (already applied once while iterating on it) created a second
-- trigger, trg_notify_task_insert (AFTER INSERT), later folded into trg_notify_task_update below
-- and removed from this file - but with no DROP for its old name, it would stay live forever on
-- any database that had the earlier version applied (idempotency only covers what THIS version
-- of a file creates, not what an earlier version created and this version no longer does).
-- Caught live: OLD is NULL inside an AFTER INSERT firing, so `OLD.status IS DISTINCT FROM
-- NEW.status` was true on every insert, producing status_update rows with oldStatus=null that
-- correctly failed Zod parsing - that failure is what surfaced this.
DROP TRIGGER IF EXISTS trg_notify_task_insert ON tasks;

CREATE OR REPLACE FUNCTION notify_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  recipient uuid;
BEGIN
  -- task_assigned: UPDATE only, matching "assigned_to changes" literally - not fired on INSERT
  -- (a task created with an assignee already set is not a "change"). Only the new assignee is
  -- notified, not the previous one, not assigned_by.
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    IF NEW.assigned_to IS DISTINCT FROM actor THEN
      INSERT INTO notifications (user_id, type, payload)
      VALUES (
        NEW.assigned_to,
        'task_assigned',
        jsonb_build_object(
          'taskId', NEW.id,
          'taskTitle', NEW.title,
          'assignedBy', NEW.assigned_by
        )
      );
    END IF;
  END IF;

  -- status_update / approval: recipients are assigned_to and assigned_by, the two people with an
  -- actual stake in this task, each excluded if they are the one making the change.
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    FOR recipient IN
      SELECT DISTINCT u FROM unnest(ARRAY[NEW.assigned_to, NEW.assigned_by]) AS u
      WHERE u IS NOT NULL AND u IS DISTINCT FROM actor
    LOOP
      INSERT INTO notifications (user_id, type, payload)
      VALUES (
        recipient,
        -- Explicit cast required: a CASE expression's branch literals type as text, not the
        -- "unknown" pseudo-type a bare string literal gets, so Postgres won't auto-cast this one
        -- into notification_type the way it does for the plain literals elsewhere in this file
        -- (confirmed by hitting "column ... is of type notification_type but expression is of
        -- type text" without this cast).
        (CASE WHEN NEW.status = 'approval_sent' THEN 'approval' ELSE 'status_update' END)::notification_type,
        jsonb_build_object(
          'taskId', NEW.id,
          'taskTitle', NEW.title,
          'oldStatus', OLD.status,
          'newStatus', NEW.status,
          'changedBy', actor
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_update ON tasks;
CREATE TRIGGER trg_notify_task_update
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_task_changes();

-- file_uploaded: fires on task_files insert. Same two-recipient rule as status_update above,
-- excluding the uploader.
CREATE OR REPLACE FUNCTION notify_file_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  recipient uuid;
  parent_task RECORD;
BEGIN
  SELECT id, title, assigned_to, assigned_by INTO parent_task FROM tasks WHERE id = NEW.task_id;

  FOR recipient IN
    SELECT DISTINCT u FROM unnest(ARRAY[parent_task.assigned_to, parent_task.assigned_by]) AS u
    WHERE u IS NOT NULL AND u IS DISTINCT FROM actor
  LOOP
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      recipient,
      'file_uploaded',
      jsonb_build_object(
        'taskId', parent_task.id,
        'taskTitle', parent_task.title,
        'uploadedBy', NEW.uploaded_by,
        'fileType', NEW.file_type
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_file_uploaded ON task_files;
CREATE TRIGGER trg_notify_file_uploaded
  AFTER INSERT ON task_files
  FOR EACH ROW
  EXECUTE FUNCTION notify_file_uploaded();
