"use server";

// No createUser here: users.id must equal the corresponding auth.users.id (CLAUDE.md section 3),
// so provisioning a new person requires the Supabase Auth admin API, not a plain table insert.
// That's PLAN.md's P3.1 (auth -> users sync trigger + /admin/users provisioning flow) -
// deliberately deferred. This file only edits role/team/lead on users who already exist
// (currently created via prisma/seed.ts).

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireRole, UnauthorizedError } from "@/lib/auth/guards";
import { userUpdateSchema } from "@/lib/schemas/user";
import { USERS_SELECT } from "@/lib/supabase/columns";
import { ok, err, type ActionResult } from "@/lib/actionResult";
import type { User } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function updateUser(id: string, input: unknown): Promise<ActionResult<User>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin"]);
  } catch (e) {
    return err(e instanceof UnauthorizedError ? e.message : "Not authorized");
  }

  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const patch: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) patch.role = parsed.data.role;
  if (parsed.data.teamId !== undefined) patch.team_id = parsed.data.teamId;
  if (parsed.data.leadId !== undefined) patch.lead_id = parsed.data.leadId;

  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", id)
    .select(USERS_SELECT)
    .single()
    .returns<User>();

  if (error) return err(error.message);

  revalidatePath("/users");
  revalidatePath(`/users/${id}`);
  return ok(data);
}
