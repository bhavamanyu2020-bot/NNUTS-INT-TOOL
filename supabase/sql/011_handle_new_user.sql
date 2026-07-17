-- PLAN.md P3.1: auth.users -> public.users sync. Onboarding a real employee via Supabase Auth
-- (dashboard, Admin API, or self-serve signup) now automatically creates the matching
-- public.users row - no more hand-written SQL. Default role is 'member', team_id/lead_id left
-- NULL; a super_admin sets role/team afterward via the existing /users edit page.
--
-- Must be SECURITY DEFINER, matching the pattern in 008_audit_triggers.sql: trigger bodies run
-- with the INVOKING user's privileges and do NOT bypass RLS/grants. The auth.users insert here
-- is performed by Supabase Auth's own internal service, which has no grants on public.users -
-- without SECURITY DEFINER (running as this function's owner instead), the insert into
-- public.users below would fail for every single signup.
--
-- users.role has NOT NULL with no column default (schema.prisma / the init migration), so it
-- must be set explicitly - there is no DB-level fallback to lean on. Same for name: the trigger
-- must never raise, since raising here would abort the auth.users insert itself and block account
-- creation entirely, so name always falls back to something derived from the email rather than
-- risking a NOT NULL violation.
--
-- ON CONFLICT DO NOTHING is intentionally unqualified (no conflict target), not ON CONFLICT (id).
-- users.email is independently UNIQUE (users_email_key) - if an auth.users row is ever deleted
-- and later recreated with the same email (exactly the state the ON DELETE decision below
-- produces: the old public.users row is left in place, still holding that email), a fresh signup
-- gets a brand-new auth.users.id, so an id-only conflict target would miss the email collision
-- entirely and this INSERT would raise an unhandled unique-violation - inside a trigger on
-- auth.users, which would abort that signup outright. Unqualified DO NOTHING catches a conflict
-- on *any* unique/exclusion constraint on the table, covering both id and email.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'member'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- ON DELETE: deliberately no trigger here, not an oversight.
--
-- Once an auth.users row is gone, that person can never obtain a valid auth.uid() again, so RLS
-- already fully locks them out of everything regardless of what happens to their public.users
-- row - there is no access-control gap in leaving it in place.
--
-- Hard-deleting/cascading the public.users row instead would likely fail for any real employee:
-- clients.created_by, tasks.assigned_by, and task_files.uploaded_by are all ON DELETE RESTRICT
-- against users.id (see prisma/schema.prisma), so cascading into public.users would throw a
-- foreign-key violation the moment that person has any real history - a created client, an
-- assigned task, an uploaded file - which defeats the purpose of handling this automatically.
-- Leaving the row orphaned instead preserves the audit trail and every existing task/client
-- relationship untouched, at zero ongoing access-control cost.
