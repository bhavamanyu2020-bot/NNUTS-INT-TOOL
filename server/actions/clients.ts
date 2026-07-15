"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireRole, UnauthorizedError } from "@/lib/auth/guards";
import { clientCreateSchema, clientUpdateSchema } from "@/lib/schemas/client";
import { CLIENTS_SELECT } from "@/lib/supabase/columns";
import { ok, err, type ActionResult } from "@/lib/actionResult";
import type { Client } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

// Audit logging happens via DB triggers (supabase/sql/008_audit_triggers.sql) - see
// CLAUDE.md section 4, rule 4.

export async function createClient(input: unknown): Promise<ActionResult<Client>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin", "admin_onboarding"]);
  } catch (e) {
    return err(e instanceof UnauthorizedError ? e.message : "Not authorized");
  }

  const parsed = clientCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      brand_name: parsed.data.brandName,
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone,
      package: parsed.data.package,
      service_type: parsed.data.serviceType,
      documents_link: parsed.data.documentsLink,
      drive_folder_link: parsed.data.driveFolderLink,
      timeline: parsed.data.timeline,
      notes: parsed.data.notes,
      created_by: user!.id,
    })
    .select(CLIENTS_SELECT)
    .single()
    .returns<Client>();

  if (error) return err(error.message);

  revalidatePath("/clients");
  return ok(data);
}

export async function updateClient(
  id: string,
  input: unknown,
): Promise<ActionResult<Client>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin", "admin_onboarding"]);
  } catch (e) {
    return err(e instanceof UnauthorizedError ? e.message : "Not authorized");
  }

  const parsed = clientUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const patch: Record<string, unknown> = {};
  if (parsed.data.brandName !== undefined) patch.brand_name = parsed.data.brandName;
  if (parsed.data.contactName !== undefined) patch.contact_name = parsed.data.contactName;
  if (parsed.data.contactEmail !== undefined) patch.contact_email = parsed.data.contactEmail;
  if (parsed.data.contactPhone !== undefined) patch.contact_phone = parsed.data.contactPhone;
  if (parsed.data.package !== undefined) patch.package = parsed.data.package;
  if (parsed.data.serviceType !== undefined) patch.service_type = parsed.data.serviceType;
  if (parsed.data.documentsLink !== undefined) patch.documents_link = parsed.data.documentsLink;
  if (parsed.data.driveFolderLink !== undefined)
    patch.drive_folder_link = parsed.data.driveFolderLink;
  if (parsed.data.timeline !== undefined) patch.timeline = parsed.data.timeline;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select(CLIENTS_SELECT)
    .single()
    .returns<Client>();

  if (error) return err(error.message);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return ok(data);
}
