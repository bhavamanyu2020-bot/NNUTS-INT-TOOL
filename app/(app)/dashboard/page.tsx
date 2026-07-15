import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskStageBadge } from "@/components/tasks/TaskStageBadge";
import type { TaskStage, TaskStatus } from "@/generated/prisma/client";

// Backed by supabase/sql/010_analytics_views.sql - Postgres views with security_invoker=true,
// so these counts are already scoped to what the signed-in role can see (CLAUDE.md section 5:
// dashboards are derived from views, not app-layer aggregation).
type StatusCountRow = { status: TaskStatus; count: number };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const canSeeClients = user?.role === "super_admin" || user?.role === "admin_onboarding";

  const [{ data: statusCounts }, { data: clientCount }, { data: recentTasks }] =
    await Promise.all([
      supabase.from("task_counts_by_status").select("status, count").returns<StatusCountRow[]>(),
      canSeeClients
        ? supabase.from("client_count").select("count").single().returns<{ count: number }>()
        : Promise.resolve({ data: null }),
      supabase
        .from("tasks")
        .select(
          "id, title, status, stage, createdAt:created_at, client:clients(brandName:brand_name)",
        )
        .order("created_at", { ascending: false })
        .limit(8)
        .returns<
          Array<{
            id: string;
            title: string;
            status: TaskStatus;
            createdAt: string;
            stage: TaskStage;
            client: { brandName: string } | null;
          }>
        >(),
    ]);

  const counts = statusCounts ?? [];
  const totalTasks = counts.reduce((sum, row) => sum + row.count, 0);
  const completedTasks = counts.find((row) => row.status === "completed")?.count ?? 0;
  const openTasks = totalTasks - completedTasks;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        Signed in as {user?.name} ({user?.role})
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {canSeeClients && <StatCard label="Total Clients" value={clientCount?.count ?? 0} />}
        <StatCard label="Total Tasks" value={totalTasks} />
        <StatCard label="Open Tasks" value={openTasks} />
        <StatCard label="Completed Tasks" value={completedTasks} />
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 pt-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Recent Tasks</h2>
            <p className="text-xs text-neutral-400">Latest activity</p>
          </div>
          <Link href="/tasks" className="text-xs text-indigo-600 hover:underline">
            View all
          </Link>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-t border-neutral-200 text-left text-xs uppercase text-neutral-400">
              <th className="px-4 py-2 font-medium">Task</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentTasks?.map((task) => (
              <tr key={task.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <Link href={`/tasks/${task.id}`} className="text-neutral-900 hover:underline">
                    {task.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-500">{task.client?.brandName ?? "—"}</td>
                <td className="px-4 py-3">
                  <TaskStageBadge stage={task.stage} />
                </td>
                <td className="px-4 py-3">
                  <TaskStatusBadge status={task.status} />
                </td>
              </tr>
            ))}
            {(!recentTasks || recentTasks.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
