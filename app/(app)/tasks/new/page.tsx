import { createClient } from "@/lib/supabase/server";
import { CLIENTS_SELECT, USERS_SELECT } from "@/lib/supabase/columns";
import { TaskForm } from "@/components/tasks/TaskForm";
import type { Client, User } from "@/generated/prisma/client";

export default async function NewTaskPage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: users }] = await Promise.all([
    supabase.from("clients").select(CLIENTS_SELECT).order("brand_name").returns<Client[]>(),
    supabase.from("users").select(USERS_SELECT).order("name").returns<User[]>(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">New task</h1>
      <TaskForm clients={clients ?? []} users={users ?? []} />
    </div>
  );
}
