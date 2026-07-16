"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireRole, UnauthorizedError } from "@/lib/auth/guards";
import { teamCreateSchema, teamUpdateSchema } from "@/lib/schemas/team";
import { TEAMS_SELECT } from "@/lib/supabase/columns";
import { ok, err, type ActionResult } from "@/lib/actionResult";
import type { Team } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function createTeam(input: unknown): Promise<ActionResult<Team>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin"]);
  } catch (e) {
    return err(e instanceof UnauthorizedError ? e.message : "Not authorized");
  }

  const parsed = teamCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ name: parsed.data.name, lead_id: parsed.data.leadId })
    .select(TEAMS_SELECT)
    .single()
    .returns<Team>();

  if (error) return err(error.message);

  revalidatePath("/teams");
  return ok(data);
}

export async function updateTeam(id: string, input: unknown): Promise<ActionResult<Team>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin"]);
  } catch (e) {
    return err(e instanceof UnauthorizedError ? e.message : "Not authorized");
  }

  const parsed = teamUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.leadId !== undefined) patch.lead_id = parsed.data.leadId;

  const { data, error } = await supabase
    .from("teams")
    .update(patch)
    .eq("id", id)
    .select(TEAMS_SELECT)
    .single()
    .returns<Team>();

  if (error) return err(error.message);

  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
  return ok(data);
}
