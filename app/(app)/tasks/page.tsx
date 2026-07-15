import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TASKS_SELECT } from "@/lib/supabase/columns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskStageBadge } from "@/components/tasks/TaskStageBadge";
import { TaskStage, TaskStatus } from "@/generated/prisma/enums";
import type { Task } from "@/generated/prisma/client";

// Filters are plain GET query params - shareable/bookmarkable URLs, no client JS needed for the
// filter bar itself (native <form method="get">), server-rendered results (P3.2).
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; status?: string }>;
}) {
  const { stage, status } = await searchParams;

  const supabase = await createClient();
  let query = supabase.from("tasks").select(TASKS_SELECT).order("created_at", { ascending: false });
  if (stage) query = query.eq("stage", stage);
  if (status) query = query.eq("status", status);
  const { data: tasks } = await query.returns<Task[]>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Tasks</h2>
          <p className="text-xs text-neutral-400">{tasks?.length ?? 0} shown</p>
        </div>
        <Link href="/tasks/new">
          <Button>New task</Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3">
        <Select name="stage" defaultValue={stage ?? ""} className="w-48">
          <option value="">All stages</option>
          {Object.values(TaskStage).map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""} className="w-48">
          <option value="">All statuses</option>
          {Object.values(TaskStatus).map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {(stage || status) && (
          <Link href="/tasks">
            <Button type="button" variant="secondary">
              Clear
            </Button>
          </Link>
        )}
      </form>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks?.map((task) => (
              <tr key={task.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/tasks/${task.id}`} className="font-medium text-neutral-900 hover:underline">
                    {task.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {task.serviceType.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {task.deadline ? new Date(task.deadline).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <TaskStageBadge stage={task.stage} />
                </td>
                <td className="px-4 py-3">
                  <TaskStatusBadge status={task.status} />
                </td>
              </tr>
            ))}
            {tasks?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No tasks match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
