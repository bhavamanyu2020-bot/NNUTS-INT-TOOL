-- Helper functions used by RLS policies (002_rls_policies.sql).
-- SECURITY DEFINER is required here: without it, a policy on "users" that calls a function
-- which itself queries "users" would recursively re-evaluate RLS on "users", which either
-- infinite-loops or silently returns nothing. Running as the function owner (bypassing RLS
-- inside the function body only) avoids that.

CREATE OR REPLACE FUNCTION current_role_name()
RETURNS role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_team_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$;
