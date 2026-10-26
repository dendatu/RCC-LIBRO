"use client";

import * as React from "react";
import Link from "next/link";
import { BookMarked, CircleSlash, Loader2, ScanBarcode, Timer } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { SECTION_META } from "@/lib/constants";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { cancelReservation, markReservationReady } from "@/server/actions/circulation";
import type { QueueRow } from "@/server/data/circulation";

const HOLD_OPTIONS = [1, 2, 3, 5, 7];

function groupByTitle(rows: QueueRow[]) {
  const groups = new Map<string, { book_id: string; title: string; author: string; section: string; rows: QueueRow[] }>();
  for (const row of rows) {
    const group = groups.get(row.book_id) ?? {
      book_id: row.book_id,
      title: row.book_title,
      author: row.book_author,
      section: row.section,
      rows: [],
    };
    group.rows.push(row);
    groups.set(row.book_id, group);
  }
  return [...groups.values()];
}

/** Hold shelf and queue. Ready, release, or walk the borrower straight to the issue desk. */
export function ReservationQueue({ rows }: { rows: QueueRow[] }) {
  const [readyTarget, setReadyTarget] = React.useState<QueueRow | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<QueueRow | null>(null);
  const groups = React.useMemo(() => groupByTitle(rows), [rows]);

  const onHoldShelf = rows.filter((row) => row.status === "ready");
  const expired = onHoldShelf.filter((row) => row.held_until && new Date(row.held_until).getTime() < Date.now());

  if (!rows.length) {
    return (
      <EmptyState
        icon={<BookMarked className="size-5" />}
        title="No titles are being held"
        description="Reservations borrowers place from the catalogue land here in queue order."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <Badge variant="secondary">{rows.length} in the queue</Badge>
        <Badge variant={onHoldShelf.length ? "success" : "secondary"}>{onHoldShelf.length} on the hold shelf</Badge>
        {expired.length ? <Badge variant="destructive">{expired.length} hold(s) past their expiry</Badge> : null}
      </div>

      {expired.length ? (
        <Alert variant="warning">
          <AlertTitle>Expired holds still on the shelf</AlertTitle>
          <AlertDescription>
            {expired.length} reservation(s) ran past the date they were due to be collected. Issue the
            copy, or release the hold so the next borrower in line is notified.
          </AlertDescription>
        </Alert>
      ) : null}

      {groups.map((group) => (
        <section key={group.book_id} className="surface-card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-cream px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-lg text-ink">{group.title}</h2>
              <p className="mt-0.5 truncate text-xs text-ink-soft">
                {group.author} · {group.rows[0]?.accession_number}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{SECTION_META[group.section as keyof typeof SECTION_META]?.label ?? group.section}</Badge>
              <span>{group.rows[0]?.available_copies ?? 0} of {group.rows[0]?.total_copies ?? 0} copies available</span>
            </div>
          </header>

          <ul className="divide-y divide-border">
            {group.rows
              .slice()
              .sort((a, b) => a.queue_position - b.queue_position)
              .map((row) => {
                const isExpired = Boolean(row.held_until && new Date(row.held_until).getTime() < Date.now());
                return (
                  <li key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        <span className="grid size-7 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                          {row.queue_position}
                        </span>
                        {row.borrower_name}
                        <Badge variant={row.status === "ready" ? "success" : "gold"}>{row.status}</Badge>
                        {isExpired ? <Badge variant="destructive">Hold expired</Badge> : null}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {row.sbtr_number ? `SBTR ${row.sbtr_number} · ` : ""}
                        requested {formatDate(row.requested_at)}
                        {row.ready_at ? ` · ready ${formatDateTime(row.ready_at)}` : ""}
                        {row.held_until ? ` · hold until ${formatDateTime(row.held_until)}` : ""}
                      </p>
                      {row.notes ? <p className="mt-1 text-[11px] text-ink-soft">Note: {row.notes}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {row.copy_barcode ? (
                        <Button asChild size="sm" variant="gold">
                          <Link
                            href={`/dashboard/circulation?barcode=${encodeURIComponent(row.copy_barcode)}&borrower=${encodeURIComponent(row.borrower_id)}`}
                          >
                            <ScanBarcode className="size-3.5" /> Issue to holder
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          No copy on the shelf
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setReadyTarget(row)}>
                        <Timer className="size-3.5" />
                        {row.status === "ready" ? "Renew hold" : "Mark ready"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setCancelTarget(row)}>
                        <CircleSlash className="size-3.5" /> Release
                      </Button>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <ReadyDialog row={readyTarget} onClose={() => setReadyTarget(null)} />
      <CancelDialog row={cancelTarget} onClose={() => setCancelTarget(null)} />
    </div>
  );
}

function ReadyDialog({ row, onClose }: { row: QueueRow | null; onClose: () => void }) {
  const action = useFormAction(markReservationReady);
  const [holdDays, setHoldDays] = React.useState("2");

  React.useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) {
      toast.success(action.state.message ?? "Hold placed on the shelf.");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.state]);

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.status === "ready" ? "Renew the hold" : "Place on the hold shelf"}</DialogTitle>
          <DialogDescription>
            {row.book_title} for {row.borrower_name}. The borrower is notified and the copy is kept off
            the general shelf for the period you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hold-days">Keep it for</Label>
            <Select value={holdDays} onValueChange={setHoldDays}>
              <SelectTrigger id="hold-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOLD_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} day{option === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {action.state && !action.state.ok ? (
            <Alert variant="destructive">
              <AlertTitle>The hold was not placed</AlertTitle>
              <AlertDescription>{action.state.message}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            size="lg"
            className="w-full"
            disabled={action.pending}
            onClick={() => action.submit({ reservationId: row.id, holdDays })}
          >
            {action.pending ? <Loader2 className="size-4 animate-spin" /> : <Timer className="size-4" />}
            Confirm the hold
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ row, onClose }: { row: QueueRow | null; onClose: () => void }) {
  const action = useFormAction(cancelReservation);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) {
      toast.success(action.state.message ?? "Hold released.");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.state]);

  if (!row) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release this reservation</DialogTitle>
          <DialogDescription>
            {row.book_title} — {row.borrower_name}, queue position {row.queue_position}. The reason is
            written to the audit trail and the queue renumbers itself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Hold expired and the borrower could not be reached"
            />
          </div>

          {action.state && !action.state.ok ? (
            <Alert variant="destructive">
              <AlertTitle>Reservation not released</AlertTitle>
              <AlertDescription
                className={cn(action.state.errors?.reason?.length ? "text-destructive" : undefined)}
              >
                {action.state.message}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            size="lg"
            variant="destructive"
            className="w-full"
            disabled={action.pending || reason.trim().length < 3}
            onClick={() => action.submit({ reservationId: row.id, reason })}
          >
            {action.pending ? <Loader2 className="size-4 animate-spin" /> : <CircleSlash className="size-4" />}
            Release the hold
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
