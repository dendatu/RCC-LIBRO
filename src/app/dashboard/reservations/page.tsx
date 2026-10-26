import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  Clock,
  Hourglass,
  Library,
  PackageCheck,
  Search,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/shell/page-header";
import { CancelReservationButton } from "@/components/member/cancel-reservation-button";
import { StatusPill } from "@/components/member/status-pill";
import { POLICY, SECTION_META } from "@/lib/constants";
import { daysUntil, formatDateTime } from "@/lib/utils";
import { requireMember } from "@/lib/rbac";
import { memberReservations } from "@/server/data/member";
import type { MemberReservation } from "@/server/data/member";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservations",
  description: "Titles queued or held for you, with queue position and hold expiry.",
};

function catalogueSearch(title: string) {
  return `/dashboard/catalog?q=${encodeURIComponent(title)}`;
}

function holdLabel(hold: string) {
  const days = daysUntil(hold);
  if (days < 0) return "Hold expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Held for ${days} more days`;
}

function ReservationRow({ item, open }: { item: MemberReservation; open: boolean }) {
  const hold = item.held_until;
  const expiring = hold ? daysUntil(hold) <= 1 : false;

  return (
    <li
      id={item.id}
      className="surface-card hover-lift flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-base font-semibold text-ink">
          <Link
            href={catalogueSearch(item.book?.title ?? "")}
            className="underline-offset-4 hover:text-brand-700 hover:underline"
          >
            {item.book?.title ?? "Withdrawn title"}
          </Link>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.book?.author ?? "Author unrecorded"}
          {item.book?.call_number ? ` · ${item.book.call_number}` : ""}
          {item.book?.section ? ` · ${SECTION_META[item.book.section]?.label ?? item.book.section}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>Requested {formatDateTime(item.requested_at)}</span>
          {item.status === "waiting" ? (
            <span className="inline-flex items-center gap-1 font-medium text-brand-700">
              <Hourglass className="size-3" />
              Queue position {item.queue_position}
            </span>
          ) : null}
          {item.ready_at ? <span>Held since {formatDateTime(item.ready_at)}</span> : null}
          {item.fulfilled_at ? <span>Collected {formatDateTime(item.fulfilled_at)}</span> : null}
          {item.cancelled_at ? <span>Cancelled {formatDateTime(item.cancelled_at)}</span> : null}
          {item.book && item.book.available_copies > 0 ? (
            <span className="text-success">{item.book.available_copies} copy(s) on shelf</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <StatusPill status={item.status} />
        {hold && item.status === "ready" ? (
          <Badge variant={expiring ? "destructive" : "gold"}>
            <Clock className="size-3" />
            {holdLabel(hold)}
          </Badge>
        ) : null}
        {open ? (
          <CancelReservationButton reservationId={item.id} title={item.book?.title ?? "this title"} />
        ) : null}
      </div>
    </li>
  );
}

export default async function ReservationsPage() {
  const member = await requireMember();
  const reservations = await memberReservations(member.user.id);

  const ready = reservations.filter((item) => item.status === "ready");
  const waiting = reservations.filter((item) => item.status === "waiting");
  const closed = reservations.filter((item) =>
    ["fulfilled", "cancelled", "expired"].includes(item.status),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My library"
        title="Reservations"
        description="Titles you have queued. A reservation holds a copy for you at the desk — it is not a loan until a librarian checks it out."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/catalog">
                <Library className="size-4" />
                Reserve from the catalogue
              </Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link href="/dashboard/borrowings">
                <BookMarked className="size-4" />
                My borrowings
              </Link>
            </Button>
          </>
        }
      />

      {ready.length > 0 ? (
        <Alert variant="info">
          <PackageCheck className="size-4" />
          <AlertTitle>{ready.length} title(s) are waiting for you at the desk</AlertTitle>
          <AlertDescription>
            Present your library card at circulation. Holds expire automatically — an unclaimed copy
            goes back to the shelf and to the next borrower in the queue.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Ready for pickup"
          value={String(ready.length)}
          hint="Collect at any branch desk"
          icon={<PackageCheck />}
          tone={ready.length > 0 ? "success" : "default"}
        />
        <StatTile
          label="In the queue"
          value={String(waiting.length)}
          hint={`You may hold ${POLICY.maxBooks} books at a time`}
          icon={<Hourglass />}
          tone={waiting.length > 0 ? "gold" : "default"}
        />
        <StatTile
          label="Closed requests"
          value={String(closed.length)}
          hint="Collected, cancelled or expired"
          icon={<Clock />}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Open requests</CardTitle>
          <CardDescription>
            Ready holds first, then the queue. Cancel a request any time — the line moves up
            immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready.length + waiting.length === 0 ? (
            <EmptyState
              icon={<BookMarked className="size-7" />}
              title="Nothing queued right now"
              description="Open a title in the catalogue and use Reserve when every copy is on loan — you will be notified the moment one frees up."
              action={
                <Button asChild size="sm">
                  <Link href="/dashboard/catalog">
                    <Search className="size-4" /> Find a title
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {[...ready, ...waiting].map((item) => (
                <ReservationRow key={item.id} item={item} open />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request history</CardTitle>
          <CardDescription>Fulfilled, cancelled and expired reservations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {closed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No closed reservations yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {closed.map((item) => (
                <ReservationRow key={item.id} item={item} open={false} />
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Badge variant="secondary">{reservations.length} total request(s)</Badge>
            <Button asChild variant="link" size="sm">
              <Link href="/dashboard/notifications">
                Reservation notices land in your notifications <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
