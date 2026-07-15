-- CLAUDE.md section 4, rule 4: everything mutating writes to audit_log, no silent state changes.
-- Round 1 enforced this in application code (lib/audit.ts, called from server/actions/*) - that
-- doesn't actually hold, because RLS permits a direct client-side UPDATE on tasks (e.g. a member
-- changing their own task's status via supabase-js directly, bypassing the server action
-- entirely), which would go unlogged. A rule from CLAUDE.md section 4 being enforceable only in
-- app code is a bug by section 4's own terms - it has to be enforced where the mutation actually
-- happens, which is the database.
--
-- Must be SECURITY DEFINER: trigger bodies run with the INVOKING user's privileges and do NOT
-- bypass RLS. audit_log now has no INSERT policy for authenticated users at all (see
-- 002_rls_policies.sql) - only this function, running as its owner, can write to it.

CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (actor_id, entity, entity_id, action, after)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id, 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (actor_id, entity, entity_id, action, before, after)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (actor_id, entity, entity_id, action, before)
    VALUES (auth.uid(), TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_audit ON tasks;
CREATE TRIGGER trg_tasks_audit
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS trg_clients_audit ON clients;
CREATE TRIGGER trg_clients_audit
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS trg_task_files_audit ON task_files;
CREATE TRIGGER trg_task_files_audit
  AFTER INSERT OR UPDATE OR DELETE ON task_files
  FOR EACH ROW
  EXECUTE FUNCTION write_audit_log();
