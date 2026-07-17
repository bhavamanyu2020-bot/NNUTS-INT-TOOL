-- PLAN.md P4.2: the notification bell needs live delivery via Supabase Realtime, which requires
-- the table to be in the supabase_realtime publication - Postgres Changes (what Realtime uses
-- under the hood) only broadcasts changes for tables explicitly added here. Verified directly
-- against pg_publication_tables before writing this: no table in this project was in the
-- publication at all, notifications included.
--
-- REPLICA IDENTITY is deliberately left at its default (primary key only), not set to FULL: the
-- bell only needs to receive INSERT events (a new notification arriving), and INSERT payloads
-- always carry the complete NEW row regardless of REPLICA IDENTITY - that setting only affects
-- how much of the OLD row is included in UPDATE/DELETE change payloads, which this feature
-- doesn't depend on (mark-as-read is a server action + local state update, not a realtime-driven
-- read of the old row - see NotificationBell.tsx).
--
-- Idempotent: ADD TABLE fails if the table is already a publication member, so this guards with
-- a existence check rather than a bare ALTER PUBLICATION, matching every other file's
-- re-runnable-three-times requirement.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
