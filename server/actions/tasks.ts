"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireRole, UnauthorizedError } from "@/lib/auth/guards";
import {
  taskCreateSchema,
  taskUpdateSchema,
  taskAssignSchema,
  taskStatusChangeSchema,
  taskStageChangeSchema,
} from "@/lib/schemas/task";
import { TASKS_SELECT } from "@/lib/supabase/columns";
import { assertStatusTransition } from "@/lib/fsm/taskStatus";
import { assertStageTransition } from "@/lib/fsm/taskStage";
import { TaskFsmError } from "@/lib/fsm/errors";
import { logAudit } from "@/lib/audit";
import { ok, err, type ActionResult } from "@/lib/actionResult";
import type { Task } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

function actionErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof TaskFsmError) return e.message;
  if (e instanceof UnauthorizedError) return e.message;
  return fallback;
}

export async function createTask(input: unknown): Promise<ActionResult<Task>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin", "admin_onboarding", "lead"]);
  } catch (e) {
    return err(actionErrorMessage(e, "Not authorized"));
  }

  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      description: parsed.data.description,
      assigned_to: parsed.data.assignedTo,
      assigned_by: user!.id,
      service_type: parsed.data.serviceType,
      deadline: parsed.data.deadline,
    })
    .select(TASKS_SELECT)
    .single()
    .returns<Task>();

  if (error) return err(error.message);

  await logAudit(supabase, {
    actorId: user!.id,
    entity: "tasks",
    entityId: data.id,
    action: "create",
    after: data,
  });

  revalidatePath("/tasks");
  return ok(data);
}

export async function updateTask(id: string, input: unknown): Promise<ActionResult<Task>> {
  const user = await getCurrentUser();
  if (!user) return err("Not signed in");

  const parsed = taskUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const { data: before } = await supabase
    .from("tasks")
    .select(TASKS_SELECT)
    .eq("id", id)
    .single()
    .returns<Task>();

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.assignedTo !== undefined) patch.assigned_to = parsed.data.assignedTo;
  if (parsed.data.serviceType !== undefined) patch.service_type = parsed.data.serviceType;
  if (parsed.data.deadline !== undefined) patch.deadline = parsed.data.deadline;

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select(TASKS_SELECT)
    .single()
    .returns<Task>();

  if (error) return err(error.message);

  await logAudit(supabase, {
    actorId: user.id,
    entity: "tasks",
    entityId: id,
    action: "update",
    before,
    after: data,
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return ok(data);
}

export async function assignTask(input: unknown): Promise<ActionResult<Task>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin", "admin_onboarding", "lead"]);
  } catch (e) {
    return err(actionErrorMessage(e, "Not authorized"));
  }

  const parsed = taskAssignSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const { data: before } = await supabase
    .from("tasks")
    .select(TASKS_SELECT)
    .eq("id", parsed.data.taskId)
    .single()
    .returns<Task>();

  const { data, error } = await supabase
    .from("tasks")
    .update({ assigned_to: parsed.data.assignedTo })
    .eq("id", parsed.data.taskId)
    .select(TASKS_SELECT)
    .single()
    .returns<Task>();

  if (error) return err(error.message);

  await logAudit(supabase, {
    actorId: user!.id,
    entity: "tasks",
    entityId: parsed.data.taskId,
    action: "assign",
    before,
    after: data,
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return ok(data);
}

// Checks the file-upload gate at the app layer (for a clean UI error) before attempting the
// write; the DB trigger (supabase/sql/005_file_gate_trigger.sql) enforces it independently
// regardless of whether this check is ever bypassed.
export async function changeTaskStatus(input: unknown): Promise<ActionResult<Task>> {
  const user = await getCurrentUser();
  if (!user) return err("Not signed in");

  const parsed = taskStatusChangeSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const { data: before, error: fetchError } = await supabase
    .from("tasks")
    .select(TASKS_SELECT)
    .eq("id", parsed.data.taskId)
    .single()
    .returns<Task>();

  if (fetchError || !before) return err(fetchError?.message ?? "Task not found");

  try {
    assertStatusTransition(before.status, parsed.data.status);
  } catch (e) {
    return err(actionErrorMessage(e, "Illegal status transition"));
  }

  if (parsed.data.status === "approval_sent") {
    const { data: files } = await supabase
      .from("task_files")
      .select("id")
      .eq("task_id", parsed.data.taskId)
      .not("drive_link", "is", null)
      .limit(1);

    if (!files || files.length === 0) {
      return err("Cannot move to approval_sent: no uploaded file with a drive link");
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.taskId)
    .select(TASKS_SELECT)
    .single()
    .returns<Task>();

  if (error) return err(error.message);

  await logAudit(supabase, {
    actorId: user.id,
    entity: "tasks",
    entityId: parsed.data.taskId,
    action: "status_change",
    before,
    after: data,
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return ok(data);
}

export async function changeTaskStage(input: unknown): Promise<ActionResult<Task>> {
  const user = await getCurrentUser();
  if (!user) return err("Not signed in");

  const parsed = taskStageChangeSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const { data: before, error: fetchError } = await supabase
    .from("tasks")
    .select(TASKS_SELECT)
    .eq("id", parsed.data.taskId)
    .single()
    .returns<Task>();

  if (fetchError || !before) return err(fetchError?.message ?? "Task not found");

  try {
    assertStageTransition(before.stage, parsed.data.stage);
  } catch (e) {
    return err(actionErrorMessage(e, "Illegal stage transition"));
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ stage: parsed.data.stage })
    .eq("id", parsed.data.taskId)
    .select(TASKS_SELECT)
    .single()
    .returns<Task>();

  if (error) return err(error.message);

  await logAudit(supabase, {
    actorId: user.id,
    entity: "tasks",
    entityId: parsed.data.taskId,
    action: "stage_change",
    before,
    after: data,
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return ok(data);
}

// super_admin-only override that skips the app-layer FSM guard (the DB trigger independently
// bypasses for super_admin too - see supabase/sql/004_stage_fsm_trigger.sql). For corrections,
// not normal pipeline flow.
export async function forceStageTransition(input: unknown): Promise<ActionResult<Task>> {
  const user = await getCurrentUser();

  try {
    requireRole(user, ["super_admin"]);
  } catch (e) {
    return err(actionErrorMessage(e, "Not authorized"));
  }

  const parsed = taskStageChangeSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();

  const { data: before } = await supabase
    .from("tasks")
    .select(TASKS_SELECT)
    .eq("id", parsed.data.taskId)
    .single()
    .returns<Task>();

  const { data, error } = await supabase
    .from("tasks")
    .update({ stage: parsed.data.stage })
    .eq("id", parsed.data.taskId)
    .select(TASKS_SELECT)
    .single()
    .returns<Task>();

  if (error) return err(error.message);

  await logAudit(supabase, {
    actorId: user!.id,
    entity: "tasks",
    entityId: parsed.data.taskId,
    action: "force_stage_change",
    before,
    after: data,
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return ok(data);
}
