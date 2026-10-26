import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on every dynamic request and gates the
 * member area. Role checks happen again inside `requireMember()` — this only
 * keeps unauthenticated traffic out of `/dashboard`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = supabaseEnv();

  if (!config) return response;

  const supabase = createServerClient(config.url, config.anonKey, {
    // Middleware runs server-side too, so it dials the same address as the
    // server clients while reading the cookie the browser wrote.
    cookieOptions: { name: config.storageKey },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !user) {
    const redirect = new URL("/login", request.url);
    redirect.searchParams.set("next", pathname + search);
    redirect.searchParams.set("reason", "signed_out");
    return NextResponse.redirect(redirect);
  }

  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
