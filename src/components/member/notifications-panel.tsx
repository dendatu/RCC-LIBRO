"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookMarked,
  CalendarClock,
  Check,
  CircleDollarSign,
  Info,
  Banknote,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/server/actions/member";
import type { AppNotification, NotificationType } from "@/lib/types";

const ICONS: Record<NotificationType, typeof Info> = {
  due_reminder: CalendarClock,
  overdue: TriangleAlert,
  reservation_ready: BookMarked,
  fine_assessed: CircleDollarSign,
  fine_settled: Banknote,
  account: UserRound,
  system: Info,
};

const TITLES: Record<NotificationType, string> = {
  due_reminder: "Due date",
  overdue: "Overdue",
  reservation_ready: "Reservation",
  fine_assessed: "Penalty assessed",
  fine_settled: "Penalty settled",
  account: "Account",
  system: "Library notice",
};

export function NotificationsPanel({ items }: { items: AppNotification[] }) {
  const [readIds, setReadIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [pendingId, setPendingId] = useState<number | "all" | null>(null);
  const [, startTransition] = useTransition();

  const isRead = (item: AppNotification) => item.is_read || readIds.includes(item.id);
  const visible = useMemo(
    () => (filter === "unread" ? items.filter((item) => !isRead(item)) : items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filter, readIds],
  );
  const unreadCount = items.filter((item) => !isRead(item)).length;

  const send = (action: typeof markNotificationRead, form: FormData, key: number | "all") => {
    setPendingId(key);
    startTransition(async () => {
      try {
        const result = await action(null, form);
        if (result.ok) {
          if (key === "all") setReadIds(items.map((item) => item.id));
          else setReadIds((current) => [...current, key]);
          if (result.message) toast.success(result.message);
        } else {
          toast.error(result.message ?? "Could not update that notification.");
        }
      } catch {
        toast.error("Your session expired. Please sign in again.");
      } finally {
        setPendingId(null);
      }
    });
  };

  const markOne = (item: AppNotification) => {
    const form = new FormData();
    form.set("notificationId", String(item.id));
    send(markNotificationRead, form, item.id);
  };

  const markAll = () => send(markAllNotificationsRead, new FormData(), "all");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "unread")}>
          <TabsList aria-label="Notification filter">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              <Badge variant={unreadCount > 0 ? "gold" : "secondary"} className="ml-1">
                {unreadCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="outline"
          size="sm"
          onClick={markAll}
          disabled={unreadCount === 0 || pendingId === "all"}
        >
          <Check className="size-4" />
          Mark all as read
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Info className="size-7" />}
          title={filter === "unread" ? "Nothing unread" : "No notifications yet"}
          description={
            filter === "unread"
              ? "You are caught up. New due-date and reservation notices appear here."
              : "Reminders are created when the desk issues a book, when a hold is ready and when a penalty is assessed."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((item, index) => {
            const Icon = ICONS[item.type] ?? Info;
            const read = isRead(item);
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.25) }}
              >
                <article
                  className={`surface-card hover-lift flex items-start gap-3 p-4 ${
                    read ? "opacity-70" : ""
                  }`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      read ? "bg-muted text-muted-foreground" : "bg-brand-100 text-brand-700"
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!read ? <span className="size-1.5 rounded-full bg-gold" /> : null}
                      <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                      <Badge variant="outline">{TITLES[item.type] ?? item.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.link ? (
                      <Button asChild variant="link" size="sm" className="justify-end px-0">
                        <Link href={item.link} onClick={() => (read ? undefined : markOne(item))}>
                          Open
                        </Link>
                      </Button>
                    ) : null}
                    {!read ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markOne(item)}
                        disabled={pendingId === item.id}
                        aria-label={`Mark "${item.title}" as read`}
                      >
                        <Check className="size-4" />
                        Mark read
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Read</span>
                    )}
                  </div>
                </article>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
