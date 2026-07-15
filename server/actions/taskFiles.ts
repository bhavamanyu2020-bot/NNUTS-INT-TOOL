"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { taskFileCreateSchema } from "@/lib/schemas/taskFile";
import { TASK_FILES_SELECT } from "@/lib/supabase/columns";
import { ok, err, type ActionResult } from "@/lib/actionResult";
import type { TaskFile } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function createTaskFile(input: unknown): Promise<ActionResult<TaskFile>> {
  const user = await getCurrentUser();
  if (!user) return err("Not signed in");

  const parsed = taskFileCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("task_files")
    .insert({
      task_id: parsed.data.taskId,
      drive_link: parsed.data.driveLink,
      file_type: parsed.data.fileType,
      uploaded_by: user.id,
    })
    .select(TASK_FILES_SELECT)
    .single()
    .returns<TaskFile>();

  if (error) return err(error.message);

  revalidatePath(`/tasks/${parsed.data.taskId}`);
  return ok(data);
}
