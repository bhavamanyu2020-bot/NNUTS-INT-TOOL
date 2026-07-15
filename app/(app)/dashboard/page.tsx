import { getCurrentUser } from "@/lib/auth/getCurrentUser";

// Placeholder - full analytics/dashboards are out of scope for this phase (CLAUDE.md section 5:
// dashboards are built last, from Postgres views, not app-layer aggregation).
export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Signed in as {user?.name} ({user?.role}). Analytics land in a later phase.
      </p>
    </div>
  );
}
