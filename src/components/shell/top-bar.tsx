"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { ROLE_LABEL } from "@/lib/constants";
import { signOut } from "@/server/actions/auth";
import type { AppNotification, RoleSlug } from "@/lib/types";
import { formatDateTime, initials } from "@/lib/utils";
import type { NavGroup } from "@/lib/nav";

export function TopBar({
  groups,
  role,
  name,
  avatarUrl,
  notifications,
}: {
  groups: NavGroup[];
  role: RoleSlug;
  name: string;
  avatarUrl: string | null;
  notifications: AppNotification[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const router = useRouter();
  const unread = notifications.filter((item) => !item.is_read).length;

  return (
    <header className="app-bar sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[19rem] border-none p-0">
            <SheetTitle className="sr-only">RCC LIBRO navigation</SheetTitle>
            <SidebarNav
              groups={groups}
              role={role}
              name={name}
              onNavigate={() => setDrawerOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="hidden min-w-0 flex-1 lg:block">
          <Link
            href="/dashboard/catalog"
            className="inline-flex w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:bg-muted"
          >
            <Search className="size-4" />
            <span>Search titles, authors, call numbers…</span>
            <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">
              Catalogue
            </kbd>
          </Link>
        </div>

        <Button
          asChild
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Search the catalogue"
        >
          <Link href="/dashboard/catalog">
            <Search className="size-5" />
          </Link>
        </Button>

        <Popover open={bellOpen} onOpenChange={setBellOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(94vw,22rem)] p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <Link
                href="/dashboard/notifications"
                className="text-xs text-brand-600 hover:underline"
                onClick={() => setBellOpen(false)}
              >
                View all
              </Link>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing new right now.
                </p>
              ) : (
                notifications.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted/70"
                    onClick={() => {
                      setBellOpen(false);
                      if (item.link) router.push(item.link);
                    }}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {!item.is_read ? <span className="size-1.5 rounded-full bg-gold" /> : null}
                      {item.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {formatDateTime(item.created_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:border-brand-300"
            >
              <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-xs font-semibold text-cream">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="size-8 object-cover" />
                ) : (
                  initials(name)
                )}
              </span>
              <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                {name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <UserRound className="size-4" /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/card">
                <UserRound className="size-4" /> My library card
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/notifications">
                <Bell className="size-4" /> Notifications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOut} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2 text-danger">
                  <LogOut className="size-4" /> Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
