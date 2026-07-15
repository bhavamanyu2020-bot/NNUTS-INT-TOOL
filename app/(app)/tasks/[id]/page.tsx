import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TASKS_SELECT, USERS_SELECT, TASK_FILES_SELECT } from "@/lib/supabase/columns";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskStageBadge } from "@/components/tasks/TaskStageBadge";
import { TaskDetailActions } from "@/components/tasks/TaskDetailActions";
import type { Task, TaskFile, User } from "@/generated/prisma/client";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: task }, { data: users }, { data: taskFiles }] = await Promise.all([
    supabase.from("tasks").select(TASKS_SELECT).eq("id", id).single().returns<Task>(),
    supabase.from("users").select(USERS_SELECT).order("name").returns<User[]>(),
    supabase.from("task_files").select(TASK_FILES_SELECT).eq("task_id", id).returns<TaskFile[]>(),
  ]);

  if (!task) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">{task.title}</h1>
        <TaskStageBadge stage={task.stage} />
        <TaskStatusBadge status={task.status} />
      </div>
      {task.description && <p className="text-sm text-neutral-600">{task.description}</p>}
      <TaskDetailActions task={task} users={users ?? []} taskFiles={taskFiles ?? []} />
    </div>
  );
}
