-- PLAN.md P4.3: deadline reminders. Scheduled job inserting deadline_reminder notifications for
-- tasks due within 24h and not completed. 013 was already taken by 013_notification_triggers.sql
-- (P4.1) and 014 by 014_notifications_realtime.sql (P4.2) - flagged, used next available number.
--
-- Recipient is the assignee only (assigned_to) - the person who actually owns the deadline. Not
-- also assigned_by, unlike P4.1's status_update/approval/file_uploaded - a lead doesn't need a
-- ping for every team member's every deadline. Deliberate scope decision.
--
-- deadline_reminder's payload shape is not in lib/schemas/notification.ts's discriminated union -
-- that file wasn't in this task's authorized file list, and P4.1 already flagged it as
-- deliberately deferred. Rows created here will fail Zod parsing in NotificationBell.tsx and fall
-- back to its generic "Notification" label - known consequence, not a bug, flagging for whoever
-- picks up that file next.
--
-- Idempotency is enforced by a partial unique index (user_id, task_id, reminder window), NOT by
-- the function checking first - a check-then-insert races itself if the job is ever retried or
-- somehow runs concurrently with itself. "Reminder window" = the deadline's calendar date: once a
-- task enters the <24h zone it gets exactly one reminder for that specific deadline, no matter
-- how many times the job runs before or after crossing it. If the deadline is later changed,
-- that's a new date - a new dedupe key - so a new reminder is correctly allowed for the new
-- deadline (not a double-send of the old one).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Unqualified ON CONFLICT DO NOTHING in the function below relies on this: a partial index only
-- guards rows matching its own WHERE clause, which every row this function inserts does (type is
-- always 'deadline_reminder' here), so an unqualified conflict target correctly resolves to it.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_deadline_reminder_dedupe
  ON notifications (user_id, (payload ->> 'taskId'), (payload ->> 'reminderWindow'))
  WHERE type = 'deadline_reminder';

CREATE OR REPLACE FUNCTION send_deadline_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, payload)
  SELECT
    t.assigned_to,
    'deadline_reminder',
    jsonb_build_object(
      'taskId', t.id,
      'taskTitle', t.title,
      'deadline', t.deadline,
      'reminderWindow', to_char(t.deadline, 'YYYY-MM-DD')
    )
  FROM tasks t
  WHERE t.assigned_to IS NOT NULL
    AND t.status <> 'completed'
    AND t.deadline IS NOT NULL
    AND t.deadline <= now() + interval '24 hours'
  ON CONFLICT DO NOTHING;
END;
$$;

-- Hourly: frequent enough that a task crossing into the <24h window is reminded within the hour,
-- infrequent enough not to hammer the database. The named-job form of cron.schedule is itself
-- idempotent by job name (re-running this file updates the existing schedule rather than
-- registering a second one) - not the same idempotency this task is about (that's the unique
-- index above, which governs the notification rows the job produces), but worth it not breaking
-- pnpm db:sql's own re-runnability requirement either.
SELECT cron.schedule(
  'deadline-reminders',
  '0 * * * *',
  $$SELECT send_deadline_reminders()$$
);
