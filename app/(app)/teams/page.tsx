import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TEAMS_SELECT, USERS_SELECT } from "@/lib/supabase/columns";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Team, User } from "@/generated/prisma/client";

export default async function TeamsPage() {
  const supabase = await createClient();
  const [{ data: teams }, { data: users }] = await Promise.all([
    supabase.from("teams").select(TEAMS_SELECT).order("name").returns<Team[]>(),
    supabase.from("users").select(USERS_SELECT).returns<User[]>(),
  ]);

  const usersById = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Teams</h2>
          <p className="text-xs text-neutral-400">{teams?.length ?? 0} teams</p>
        </div>
        <Link href="/teams/new">
          <Button>New team</Button>
        </Link>
      </div>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Members</th>
            </tr>
          </thead>
          <tbody>
            {teams?.map((team) => {
              const memberCount = (users ?? []).filter((u) => u.teamId === team.id).length;
              const lead = team.leadId ? usersById.get(team.leadId) : null;
              return (
                <tr key={team.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/teams/${team.id}`} className="font-medium text-neutral-900 hover:underline">
                      {team.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{lead?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-500">{memberCount}</td>
                </tr>
              );
            })}
            {teams?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No teams yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
