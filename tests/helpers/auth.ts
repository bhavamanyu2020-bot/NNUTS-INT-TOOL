// Test harness for the RLS/FSM suite (PLAN.md P1). Every client this file hands out is a real
// supabase-js client authenticated via signInWithPassword as a seeded user - never the
// service-role key, never the Prisma adapter. Both bypass RLS entirely; a test built on either
// would be asserting nothing about the actual security boundary (CLAUDE.md section 4.3).
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing - tests run against the " +
      "same seeded project pnpm dev uses. Copy .env.example to .env and point it at a real " +
      "project (see README.md) before running pnpm test.",
  );
}

// Must match prisma/seed.ts's SEED_PASSWORD and SEED_USERS exactly - this file intentionally
// does not import from prisma/seed.ts (out of this task's file scope), so keep them in sync by
// hand if the seed data ever changes.
export const SEED_PASSWORD = "nnuts-dev-password";

export const SEED_EMAILS = {
  superAdmin: "super.admin@nnuts.local",
  onboarding: "onboarding@nnuts.local",
  leadProduction: "lead.production@nnuts.local",
  leadPostProduction: "lead.postproduction@nnuts.local",
  member1: "member1@nnuts.local",
  member2: "member2@nnuts.local",
  member3: "member3@nnuts.local",
  member4: "member4@nnuts.local",
  member5: "member5@nnuts.local",
} as const;

export type SeedRole = keyof typeof SEED_EMAILS;

export interface AuthedUser {
  client: SupabaseClient;
  id: string;
  email: string;
}

// Signs in as a seeded user and resolves their public.users row id in the same call - every
// caller needs the id almost immediately (to build fixture rows, to assert on assigned_to, etc.)
// and users_select_all grants SELECT on users to every authenticated role, so this never needs
// an elevated client.
export async function signInAs(email: string): Promise<AuthedUser> {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error || !data.user) {
    throw new Error(`signInAs(${email}) failed: ${error?.message}`);
  }

  return { client, id: data.user.id, email };
}

export async function signOutAll(...users: AuthedUser[]): Promise<void> {
  await Promise.all(users.map((u) => u.client.auth.signOut()));
}
