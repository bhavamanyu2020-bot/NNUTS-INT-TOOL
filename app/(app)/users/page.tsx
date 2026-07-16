import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { USERS_SELECT, TEAMS_SELECT } from "@/lib/supabase/columns";
import { Card } from "@/components/ui/Card";
import type { Team, User } from "@/generated/prisma/client";

export default async function UsersPage() {
  const supabase = await createClient();
  const [{ data: users }, { data: teams }] = await Promise.all([
    supabase.from("users").select(USERS_SELECT).order("name").returns<User[]>(),
    supabase.from("teams").select(TEAMS_SELECT).returns<Team[]>(),
  ]);

  const teamsById = new Map((teams ?? []).map((t) => [t.id, t]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Users</h2>
        <p className="text-xs text-neutral-400">{users?.length ?? 0} people</p>
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Team</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/users/${u.id}`} className="font-medium text-neutral-900 hover:underline">
                    {u.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-500">{u.email}</td>
                <td className="px-4 py-3 text-neutral-500">{u.role.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-neutral-500">
                  {u.teamId ? (teamsById.get(u.teamId)?.name ?? "—") : "—"}
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
