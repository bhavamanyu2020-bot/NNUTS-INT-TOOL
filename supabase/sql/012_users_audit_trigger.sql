-- Closes a gap found while verifying P3.1b: 008_audit_triggers.sql wired tasks/clients/task_files
-- but never users, so a role/team change (e.g. via server/actions/users.ts's updateUser) wrote
-- nothing to audit_log - a real hole against CLAUDE.md section 4, rule 4 ("everything mutating
-- writes to audit_log"). Reuses write_audit_log() from 008 as-is: it's already generic via
-- TG_TABLE_NAME/to_jsonb(NEW|OLD), so no redefinition needed here, just the trigger wiring.

DROP TRIGGER IF EXISTS trg_users_audit ON users;
CREATE TRIGGER trg_users_audit
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION write_audit_log();
