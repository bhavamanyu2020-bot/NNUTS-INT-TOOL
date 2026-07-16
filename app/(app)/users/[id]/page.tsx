import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USERS_SELECT, TEAMS_SELECT } from "@/lib/supabase/columns";
import { UserForm } from "@/components/users/UserForm";
import type { Team, User } from "@/generated/prisma/client";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: user }, { data: teams }] = await Promise.all([
    supabase.from("users").select(USERS_SELECT).eq("id", id).single().returns<User>(),
    supabase.from("teams").select(TEAMS_SELECT).order("name").returns<Team[]>(),
  ]);

  if (!user) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-neutral-900">{user.name}</h2>
      <UserForm user={user} teams={teams ?? []} />
    </div>
  );
}
