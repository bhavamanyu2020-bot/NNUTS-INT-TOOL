import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TEAMS_SELECT, USERS_SELECT } from "@/lib/supabase/columns";
import { TeamForm } from "@/components/teams/TeamForm";
import type { Team, User } from "@/generated/prisma/client";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: team }, { data: users }] = await Promise.all([
    supabase.from("teams").select(TEAMS_SELECT).eq("id", id).single().returns<Team>(),
    supabase
      .from("users")
      .select(USERS_SELECT)
      .in("role", ["lead", "super_admin"])
      .order("name")
      .returns<User[]>(),
  ]);

  if (!team) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-neutral-900">{team.name}</h2>
      <TeamForm team={team} leadCandidates={users ?? []} />
    </div>
  );
}
