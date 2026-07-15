import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { USERS_SELECT } from "@/lib/supabase/columns";
import type { User } from "@/generated/prisma/client";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: user } = await supabase
    .from("users")
    .select(USERS_SELECT)
    .eq("id", authUser.id)
    .single()
    .returns<User>();

  return user;
});
