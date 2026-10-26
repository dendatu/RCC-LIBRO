import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoleSlug, SessionMember } from "@/lib/types";

const ROLE_RANK: Record<RoleSlug, number> = { borrower: 10, librarian: 20, admin: 30 };

/**
 * Resolves the signed-in account once per request (profile, standing, roles).
 * `cache()` dedupes the three round-trips across nested server components.
 */
export const getMember = cache(async (): Promise<SessionMember | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [account, roles, profile, record] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role_slug").eq("user_id", user.id),
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("borrower_records").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  const slugs = (roles.data ?? []).map((row) => row.role_slug as RoleSlug);
  if (!account.data) return null;

  return {
    user: { ...account.data, avatar_url: account.data.avatar_url ?? user.user_metadata?.avatar_url ?? null },
    profile: profile.data ?? null,
    record: record.data ?? null,
    roles: slugs.length ? slugs : ["borrower"],
    role: slugs.reduce<RoleSlug>(
      (best, slug) => (ROLE_RANK[slug] > ROLE_RANK[best] ? slug : best),
      "borrower",
    ),
  };
});

export async function requireMember(): Promise<SessionMember> {
  const member = await getMember();
  if (!member) redirect("/login");
  return member;
}

/** Server-side role gate. Redirects to the dashboard when the role is missing. */
export async function requireRole(...roles: RoleSlug[]): Promise<SessionMember> {
  const member = await requireMember();
  if (!member.roles.some((slug) => roles.includes(slug))) {
    redirect(`/dashboard?denied=${roles.join("|")}`);
  }
  return member;
}

export function hasRole(member: SessionMember | null, ...roles: RoleSlug[]) {
  if (!member) return false;
  return member.roles.some((slug) => roles.includes(slug));
}

export const isStaff = (member: SessionMember | null) => hasRole(member, "librarian", "admin");
export const isAdmin = (member: SessionMember | null) => hasRole(member, "admin");

/** Throws instead of redirecting — for use inside server actions. */
export async function guardRole(...roles: RoleSlug[]): Promise<SessionMember> {
  const member = await getMember();
  if (!member) throw new Error("Not authenticated");
  if (!hasRole(member, ...roles)) throw new Error("You do not have access to this action");
  return member;
}
