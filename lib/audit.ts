import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// CLAUDE.md section 4, rule 4: everything mutating writes to audit_log, no silent state changes.
// Written via the same RLS-respecting client as the mutation itself - the audit_log_insert_own
// RLS policy (supabase/sql/002_rls_policies.sql) only allows actor_id = auth.uid(), which this
// satisfies since actorId is always the caller's own id.
export async function logAudit(
  supabase: SupabaseClient,
  params: {
    actorId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await supabase.from("audit_log").insert({
    actor_id: params.actorId,
    entity: params.entity,
    entity_id: params.entityId,
    action: params.action,
    before: params.before ?? null,
    after: params.after ?? null,
  });
}
