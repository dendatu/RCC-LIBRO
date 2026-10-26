import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { NotificationsPanel } from "@/components/member/notifications-panel";
import { POLICY } from "@/lib/constants";
import { requireMember } from "@/lib/rbac";
import { memberNotifications } from "@/server/data/member";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Due-date reminders, reservation notices and account messages.",
};

export default async function NotificationsPage() {
  const member = await requireMember();
  const items = await memberNotifications(member.user.id);
  const unread = items.filter((item) => !item.is_read).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My library"
        title="Notifications"
        description="Everything RCC LIBRO has sent you. Read notices stay in the list — nothing here is deleted."
        actions={
          <Badge variant={unread > 0 ? "gold" : "secondary"}>
            <Bell className="size-3" />
            {unread} unread
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Newest first, up to 150 notices.</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationsPanel items={items} />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What triggers a notice</CardTitle>
            <CardDescription>Automated, never spam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ink-soft">
            <p className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 size-4 text-brand-600" />
              Due reminders {POLICY.reminderLeadDays.join(", ")} days before a book is due.
            </p>
            <p className="flex items-start gap-2">
              <MailWarning className="mt-0.5 size-4 text-brand-600" />
              One overdue notice per loan, plus the penalty recorded at check-in.
            </p>
            <p className="flex items-start gap-2">
              <Bell className="mt-0.5 size-4 text-brand-600" />
              Reservation confirmations, queue promotion and hold expiry.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keep the record tidy</CardTitle>
            <CardDescription>Notices point straight at the page that fixes them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link href="/dashboard/borrowings">
                Review due dates <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link href="/dashboard/penalties">
                Check penalties <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link href="/dashboard/reservations">
                Claim a hold <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
