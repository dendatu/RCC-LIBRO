import { updateSession } from "@/lib/supabase/middleware";

export default updateSession;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|css|js|txt|xml)$).*)",
  ],
};
