import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { TaskStageBadge } from "@/components/tasks/TaskStageBadge";
import type { TaskStage, TaskStatus } from "@/generated/prisma/client";

// Backed by supabase/sql/010_analytics_views.sql and 016_analytics_views.sql - Postgres views
// with security_invoker=true, so every number here is already scoped to what the signed-in role
// can see (CLAUDE.md section 5: dashboards are derived from views, not app-layer aggregation).
type StatusCountRow = { status: TaskStatus; count: number };
type MemberLoadRow = { user_id: string; active_task_count: number };
type StageDurationRow = { stage: TaskStage; avg_duration: string; completed_segment_count: number };
type ClientHealthRow = {
  client_id: string;
  brand_name: string;
  total_tasks: number;
  active_tasks: number;
  overdue_tasks: number;
  completed_tasks: number;
};

// Postgres/PostgREST returns `interval` as text ("01:02:03" or "1 day 02:03:04") - this renders
// it as a short human string rather than parsing it into anything numeric, since the dashboard
// only ever displays it, never computes with it (the reconciliation test does the numeric parse).
function formatInterval(text: string): string {
  const dayMatch = text.match(/(-?\d+) days?/);
  const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  const timeMatch = text.match(/(\d+):(\d+):/);
  const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const canSeeClients = user?.role === "super_admin" || user?.role === "admin_onboarding";
  const isSuperAdmin = user?.role === "super_admin";

  const [
    { data: statusCounts },
    { data: clientCount },
    { data: recentTasks },
    { data: overdueCount },
    { data: memberLoad },
    { data: stageDurations },
    { data: clientHealth },
    { data: users },
  ] = await Promise.all([
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
    supabase.from("overdue_task_count").select("count").single().returns<{ count: number }>(),
    supabase.from("member_task_load").select("user_id, active_task_count").returns<MemberLoadRow[]>(),
    isSuperAdmin
      ? supabase
          .from("avg_time_in_stage")
          .select("stage, avg_duration, completed_segment_count")
          .returns<StageDurationRow[]>()
      : Promise.resolve({ data: null }),
    canSeeClients
      ? supabase
          .from("client_pipeline_health")
          .select("client_id, brand_name, total_tasks, active_tasks, overdue_tasks, completed_tasks")
          .returns<ClientHealthRow[]>()
      : Promise.resolve({ data: null }),
    // Names for member_task_load's user_id column - users_select_all grants read to every role,
    // so this is safe regardless of which rows load returned.
    supabase.from("users").select("id, name").returns<Array<{ id: string; name: string }>>(),
  ]);

  const counts = statusCounts ?? [];
  const totalTasks = counts.reduce((sum, row) => sum + row.count, 0);
  const completedTasks = counts.find((row) => row.status === "completed")?.count ?? 0;
  const openTasks = totalTasks - completedTasks;
  const usersById = new Map((users ?? []).map((u) => [u.id, u.name]));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        Signed in as {user?.name} ({user?.role})
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {canSeeClients && <StatCard label="Total Clients" value={clientCount?.count ?? 0} />}
        <StatCard label="Total Tasks" value={totalTasks} />
        <StatCard label="Open Tasks" value={openTasks} />
        <StatCard label="Completed Tasks" value={completedTasks} />
        <StatCard label="Overdue Tasks" value={overdueCount?.count ?? 0} />
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

      {memberLoad && memberLoad.length > 0 && (
        <Card className="p-0">
          <div className="px-4 pt-4">
            <h2 className="text-sm font-semibold text-neutral-900">Team Load</h2>
            <p className="text-xs text-neutral-400">Active (not completed) tasks per person</p>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-t border-neutral-200 text-left text-xs uppercase text-neutral-400">
                <th className="px-4 py-2 font-medium">Person</th>
                <th className="px-4 py-2 font-medium">Active tasks</th>
              </tr>
            </thead>
            <tbody>
              {memberLoad.map((row) => (
                <tr key={row.user_id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 text-neutral-900">
                    {usersById.get(row.user_id) ?? row.user_id}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{row.active_task_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {isSuperAdmin && stageDurations && stageDurations.length > 0 && (
        <Card className="p-0">
          <div className="px-4 pt-4">
            <h2 className="text-sm font-semibold text-neutral-900">Average Time in Stage</h2>
            <p className="text-xs text-neutral-400">
              Completed stage segments only, derived from audit_log
            </p>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-t border-neutral-200 text-left text-xs uppercase text-neutral-400">
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2 font-medium">Average duration</th>
                <th className="px-4 py-2 font-medium">Sample size</th>
              </tr>
            </thead>
            <tbody>
              {stageDurations.map((row) => (
                <tr key={row.stage} className="border-t border-neutral-100">
                  <td className="px-4 py-3">
                    <TaskStageBadge stage={row.stage} />
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatInterval(row.avg_duration)}</td>
                  <td className="px-4 py-3 text-neutral-500">{row.completed_segment_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {canSeeClients && clientHealth && clientHealth.length > 0 && (
        <Card className="p-0">
          <div className="px-4 pt-4">
            <h2 className="text-sm font-semibold text-neutral-900">Client Pipeline Health</h2>
            <p className="text-xs text-neutral-400">Task breakdown per client</p>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-t border-neutral-200 text-left text-xs uppercase text-neutral-400">
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium">Overdue</th>
                <th className="px-4 py-2 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {clientHealth.map((row) => (
                <tr key={row.client_id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${row.client_id}`} className="text-neutral-900 hover:underline">
                      {row.brand_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{row.total_tasks}</td>
                  <td className="px-4 py-3 text-neutral-500">{row.active_tasks}</td>
                  <td className="px-4 py-3 text-neutral-500">{row.overdue_tasks}</td>
                  <td className="px-4 py-3 text-neutral-500">{row.completed_tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
