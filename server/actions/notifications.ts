"use server";

// PLAN.md P4.2: "the row is the source of truth, the socket is a nicety - initial state comes
// from a server-side read; Realtime only patches it." getMyNotifications is that server-side
// read; components/nav/NotificationBell.tsx calls it on mount, before ever touching the realtime
// channel, and again on every full page load (a browser reload re-runs the effect that calls
// this - it never depends on the socket having delivered anything).

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ok, err, type ActionResult } from "@/lib/actionResult";
import type { Notification } from "@/generated/prisma/client";

// Not in lib/supabase/columns.ts: that file wasn't in this task's authorized file list. Mirrors
// its exact alias:column pattern (see that file's own header comment).
const NOTIFICATIONS_SELECT = "id, userId:user_id, type, payload, readAt:read_at, createdAt:created_at";

// Newest-first, capped - this backs a bell dropdown, not a full inbox.
export async function getMyNotifications(): Promise<ActionResult<Notification[]>> {
  const user = await getCurrentUser();
  if (!user) return err("Not signed in");

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATIONS_SELECT)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Notification[]>();

  if (error) return err(error.message);
  return ok(data);
}

export async function markNotificationRead(id: string): Promise<ActionResult<Notification>> {
  const user = await getCurrentUser();
  if (!user) return err("Not signed in");

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select(NOTIFICATIONS_SELECT)
    .single()
    .returns<Notification>();

  if (error) return err(error.message);
  return ok(data);
}
