import type { Metadata } from "next";
import { requireMember } from "@/lib/rbac";
import { navForMember } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TopBar } from "@/components/shell/top-bar";
import type { AppNotification } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: `%s · RCC LIBRO` },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  const groups = navForMember(member.roles);

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", member.user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const notifications = (data ?? []) as AppNotification[];

  return (
    <div className="min-h-dvh bg-parchment lg:grid lg:grid-cols-[18.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-brand-800/40 lg:block">
        <SidebarNav groups={groups} role={member.role} name={member.user.full_name} />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <TopBar
          groups={groups}
          role={member.role}
          name={member.user.full_name}
          avatarUrl={member.user.avatar_url}
          notifications={notifications}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <footer className="border-t border-border px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>
            RCC LIBRO · Republic Central Colleges — Angeles City Campus ·{" "}
            <a href="/policies" className="underline-offset-4 hover:underline">
              Borrowing policy
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
