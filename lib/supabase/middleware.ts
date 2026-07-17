import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Cookies the Supabase client wants set are collected here rather than applied to a response
  // immediately, so the x-nnuts-user-id header (known only after getUser() resolves) and any
  // refreshed auth cookies can both land on the single NextResponse actually returned below.
  // Building more than one NextResponse.next({request}) after cookies have been set on an
  // earlier one silently drops those cookies - the session would never refresh client-side.
  const cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          cookiesToApply.push(...cookiesToSet);
        },
      },
    },
  );

  // Refreshes the session token if expired. Required on every request - do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    for (const { name, value, options } of cookiesToApply) response.cookies.set(name, value, options);
    return response;
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const response = NextResponse.redirect(url);
    for (const { name, value, options } of cookiesToApply) response.cookies.set(name, value, options);
    return response;
  }

  // Forward the already-validated user id so getCurrentUser() doesn't repeat the same
  // auth.getUser() network round-trip on every request - middleware always runs first, so this
  // header can't be spoofed by an inbound client header of the same name (Next.js's request
  // pipeline guarantees middleware executes before any Server Component render for matched
  // routes; setting it here on `request.headers` replaces whatever the client sent).
  if (user) {
    request.headers.set("x-nnuts-user-id", user.id);
  }

  const response = NextResponse.next({ request });
  for (const { name, value, options } of cookiesToApply) response.cookies.set(name, value, options);
  return response;
}
