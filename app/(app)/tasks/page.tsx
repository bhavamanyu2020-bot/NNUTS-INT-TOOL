import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TASKS_SELECT } from "@/lib/supabase/columns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskStageBadge } from "@/components/tasks/TaskStageBadge";
import type { Task } from "@/generated/prisma/client";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select(TASKS_SELECT)
    .order("created_at", { ascending: false })
    .returns<Task[]>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <Link href="/tasks/new">
          <Button>New task</Button>
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {tasks?.map((task) => (
          <Link key={task.id} href={`/tasks/${task.id}`}>
            <Card className="flex items-center justify-between hover:border-neutral-400">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-neutral-500">
                  {task.serviceType.replace(/_/g, " ")}
                  {task.deadline && ` · due ${new Date(task.deadline).toLocaleString()}`}
                </p>
              </div>
              <div className="flex gap-2">
                <TaskStageBadge stage={task.stage} />
                <TaskStatusBadge status={task.status} />
              </div>
            </Card>
          </Link>
        ))}
        {tasks?.length === 0 && <p className="text-sm text-neutral-500">No tasks yet.</p>}
      </div>
    </div>
  );
}
