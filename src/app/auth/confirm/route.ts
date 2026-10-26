import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Email-confirmation and magic-link entry point (`?token_hash=…&type=…`). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as "email" | "sms", token_hash });
    if (!error) redirect(`${origin}${safeNext}`);
  }

  redirect(`${origin}/login?reason=invalid_link`);
}
