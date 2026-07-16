import { createClient } from "@/lib/supabase/server";
import { USERS_SELECT } from "@/lib/supabase/columns";
import { TeamForm } from "@/components/teams/TeamForm";
import type { User } from "@/generated/prisma/client";

export default async function NewTeamPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select(USERS_SELECT)
    .in("role", ["lead", "super_admin"])
    .order("name")
    .returns<User[]>();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-neutral-900">New team</h2>
      <TeamForm leadCandidates={users ?? []} />
    </div>
  );
}
