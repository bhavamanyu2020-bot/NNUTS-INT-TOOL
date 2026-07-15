import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// RLS-respecting client for all user-facing reads/writes (Server Components, server actions,
// route handlers). The caller's JWT is what Postgres evaluates RLS policies against here -
// this is deliberately NOT the same connection Prisma uses (Prisma's DATABASE_URL role has
// full table access and would silently bypass RLS). See lib/supabase/admin.ts for the
// service-role client, which is the only place bypassing RLS is intentional.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component - middleware handles session refresh instead.
          }
        },
      },
    },
  );
}
