"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BookMarked } from "lucide-react";
import { NavIcon } from "@/components/shell/nav-icon";
import { ROLE_LABEL } from "@/lib/constants";
import type { NavGroup } from "@/lib/nav";
import type { RoleSlug } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SidebarNav({
  groups,
  role,
  name,
  onNavigate,
}: {
  groups: NavGroup[];
  role: RoleSlug;
  name: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-brand-900 text-cream/90">
      <div className="flex items-center gap-3 border-b border-cream/10 px-5 py-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold text-brand-900">
          <BookMarked className="size-5" />
        </span>
        <span className="leading-tight">
          <Link href="/" onClick={onNavigate} className="block font-serif text-lg text-cream">
            RCC LIBRO
          </Link>
          <span className="text-[11px] uppercase tracking-[0.14em] text-gold/80">
            {ROLE_LABEL[role]}
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/40">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.description}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-gold/18 text-cream"
                          : "text-cream/70 hover:bg-cream/8 hover:text-cream",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-gold"
                        />
                      ) : null}
                      <NavIcon name={item.icon} className="size-4 shrink-0 opacity-80" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-cream/10 px-5 py-4">
        <p className="truncate text-xs font-medium text-cream">{name}</p>
        <p className="mt-0.5 text-[11px] text-cream/50">Republic Central Colleges</p>
      </div>
    </div>
  );
}
