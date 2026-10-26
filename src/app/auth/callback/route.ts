import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the OAuth / e-mail-link redirect from Supabase Auth, exchanges the
 * one-time code for a cookie session, then sends the member onward.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  const failure = new URL(`${origin}/login`);
  failure.searchParams.set("reason", code ? "session_expired" : "invalid_link");
  const message = searchParams.get("error_description");
  if (message) failure.searchParams.set("message", message);
  return NextResponse.redirect(failure.toString());
}
