import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { USERS_SELECT } from "@/lib/supabase/columns";
import type { User } from "@/generated/prisma/client";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();

  // middleware.ts already ran auth.getUser() (a network round-trip to Supabase Auth) for this
  // request and forwards the validated id via this header - reuse it instead of paying that
  // round-trip again. Falls back to calling getUser() directly for any request path middleware's
  // matcher doesn't cover (defense in depth, not the common case).
  let authUserId = (await headers()).get("x-nnuts-user-id");
  if (!authUserId) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    authUserId = authUser?.id ?? null;
  }

  if (!authUserId) return null;

  const { data: user } = await supabase
    .from("users")
    .select(USERS_SELECT)
    .eq("id", authUserId)
    .single()
    .returns<User>();

  return user;
});
