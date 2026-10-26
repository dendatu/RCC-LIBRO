"use client";

import * as React from "react";
import { FileDown, Loader2, Receipt, ShieldBan } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fineTypeLabel } from "@/components/circulation/section-rule";
import { useFormAction } from "@/hooks/use-form-action";
import { downloadFineStatement } from "@/lib/pdf";
import { formatDateTime, formatPeso } from "@/lib/utils";
import { settleFine, waiveFine } from "@/server/actions/circulation";
import type { FineRow } from "@/server/data/circulation";

const PAY_VIA = [
  { value: "cash", label: "Cash at the desk" },
  { value: "online", label: "Online / GCash" },
  { value: "counter", label: "Branch counter" },
] as const;

type Mode = "settle" | "waive";

/**
 * Penalty ledger. Settlement is a staff action, waiver is administrator-only;
 * both go through `settle_fine()` / `waive_fine()` so the money and the audit
 * entry are written by Postgres.
 */
export function FineLedger({ fines, canWaive }: { fines: FineRow[]; canWaive: boolean }) {
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [target, setTarget] = React.useState<FineRow | null>(null);

  const pending = fines.filter((fine) => fine.status === "pending");
  const disputed = fines.filter((fine) => fine.status === "disputed");
  const settled = fines.filter((fine) => fine.status === "paid");
  const waived = fines.filter((fine) => fine.status === "waived");

  const open = (next: Mode, fine: FineRow) => {
    setTarget(fine);
    setMode(next);
  };

  const statement = (fine: FineRow) => {
    const rows = fines
      .filter((row) => row.borrower_id === fine.borrower_id)
      .map((row) => ({
        type: row.type,
        book: row.book_title ?? "Unlinked penalty",
        amount: row.amount,
        status: row.status,
        created: row.created_at,
      }));
    downloadFineStatement(
      {
        name: fine.borrower_name,
        email: fine.borrower_email,
        classification: fine.classification,
        sbtr: fine.sbtr_number,
        card: fine.borrower_card,
      },
      rows,
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pending">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="pending">
            Pending
            <Badge variant={pending.length ? "destructive" : "secondary"}>{pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="disputed">
            Disputed
            <Badge variant="secondary">{disputed.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paid">
            Settled
            <Badge variant="secondary">{settled.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="waived">
            Waived
            <Badge variant="secondary">{waived.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <FineTable fines={pending} canWaive={canWaive} onAction={open} onStatement={statement} />
        </TabsContent>
        <TabsContent value="disputed">
          <FineTable fines={disputed} canWaive={canWaive} onAction={open} onStatement={statement} />
        </TabsContent>
        <TabsContent value="paid">
          <FineTable fines={settled} canWaive={canWaive} onAction={open} onStatement={statement} />
        </TabsContent>
        <TabsContent value="waived">
          <FineTable fines={waived} canWaive={canWaive} onAction={open} onStatement={statement} />
        </TabsContent>
      </Tabs>

      <FineActionDialog mode={mode} fine={target} onClose={() => setMode(null)} />
    </div>
  );
}

function FineTable({
  fines,
  canWaive,
  onAction,
  onStatement,
}: {
  fines: FineRow[];
  canWaive: boolean;
  onAction: (mode: Mode, fine: FineRow) => void;
  onStatement: (fine: FineRow) => void;
}) {
  if (!fines.length) {
    return (
      <EmptyState
        icon={<Receipt className="size-5" />}
        title="Nothing in this column"
        description="Penalties move here as the return desk and the overdue job assess or clear them."
      />
    );
  }

  const total = fines.reduce((sum, fine) => sum + Number(fine.amount ?? 0), 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        {fines.length} entry(ies) · <span className="font-semibold text-ink">{formatPeso(total)}</span>
      </p>
      <Table containerClassName="overflow-x-auto rounded-xl border border-border">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[15rem]">Borrower</TableHead>
            <TableHead className="min-w-[14rem]">Penalty</TableHead>
            <TableHead className="min-w-[9rem] text-right">Amount</TableHead>
            <TableHead className="min-w-[14rem]">Desk actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fines.map((fine) => (
            <TableRow key={fine.id} className="align-top">
              <TableCell>
                <p className="font-medium text-ink">{fine.borrower_name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{fine.classification}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fine.reference_no ? `${fine.reference_no} · ` : ""}
                  {formatDateTime(fine.created_at)}
                </p>
              </TableCell>
              <TableCell>
                <p className="text-sm text-ink">{fineTypeLabel(fine.type)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{fine.book_title ?? "No title linked"}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      fine.status === "pending"
                        ? "destructive"
                        : fine.status === "paid"
                          ? "success"
                          : fine.status === "disputed"
                            ? "warning"
                            : "secondary"
                    }
                  >
                    {fine.status}
                  </Badge>
                  {fine.unit_count > 0 ? (
                    <span className="text-[11px] text-muted-foreground">{fine.unit_count} unit(s)</span>
                  ) : null}
                  {fine.paid_via ? (
                    <span className="text-[11px] text-muted-foreground">via {fine.paid_via}</span>
                  ) : null}
                </div>
                {fine.waiver_reason ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">Waived: {fine.waiver_reason}</p>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <p className="font-semibold text-ink">{formatPeso(fine.amount)}</p>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {fine.status === "pending" || fine.status === "disputed" ? (
                    <Button size="sm" onClick={() => onAction("settle", fine)}>
                      Settle
                    </Button>
                  ) : null}
                  {fine.status !== "paid" && fine.status !== "waived" ? (
                    <WaiveButton canWaive={canWaive} onClick={() => onAction("waive", fine)} />
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => onStatement(fine)}>
                    <FileDown className="size-3.5" /> Statement
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Waiver is an administrator right; librarians see why the button is disabled. */
function WaiveButton({ canWaive, onClick }: { canWaive: boolean; onClick: () => void }) {
  const button = (
    <Button size="sm" variant="secondary" disabled={!canWaive} onClick={onClick}>
      <ShieldBan className="size-3.5" /> Waive
    </Button>
  );
  if (canWaive) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent>Only an administrator may waive a penalty.</TooltipContent>
    </Tooltip>
  );
}

function FineActionDialog({
  mode,
  fine,
  onClose,
}: {
  mode: Mode | null;
  fine: FineRow | null;
  onClose: () => void;
}) {
  const settle = useFormAction(settleFine);
  const waive = useFormAction(waiveFine);
  const [paidVia, setPaidVia] = React.useState<string>("cash");
  const [reason, setReason] = React.useState("");

  const state = mode === "settle" ? settle.state : waive.state;
  const pending = mode === "settle" ? settle.pending : waive.pending;

  React.useEffect(() => {
    if (!mode) return;
    setPaidVia("cash");
    setReason("");
    settle.reset();
    waive.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fine?.id]);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Penalty updated.");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!mode || !fine) return null;

  const submit = () => {
    if (mode === "settle") {
      settle.submit({ fineId: fine.id, paidVia });
      return;
    }
    waive.submit({ fineId: fine.id, paidVia: "waiver", reason });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "settle" ? "Record a payment" : "Waive this penalty"}</DialogTitle>
          <DialogDescription>
            {fine.borrower_name} · {fineTypeLabel(fine.type)} · {formatPeso(fine.amount)}
            {fine.book_title ? ` — ${fine.book_title}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "settle" ? (
            <div className="space-y-2">
              <Label htmlFor="paid-via">Paid through</Label>
              <Select value={paidVia} onValueChange={setPaidVia}>
                <SelectTrigger id="paid-via">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_VIA.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                The receipt reference and the clearing of any borrowing block are written by
                <span className="font-mono"> settle_fine()</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="waive-reason">Reason for the waiver</Label>
              <Textarea
                id="waive-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Book returned on time but the date stamp was misread at the desk"
              />
              <p className="text-[11px] text-muted-foreground">
                Waivers are permanent and appear in the audit trail against your account.
              </p>
            </div>
          )}

          {state && !state.ok ? (
            <Alert variant="destructive">
              <AlertTitle>{mode === "settle" ? "Payment not recorded" : "Waiver not accepted"}</AlertTitle>
              <AlertDescription>
                <p>{state.message}</p>
                {mode === "settle" && state.errors?.paidVia ? (
                  <p className="mt-1 text-xs">{state.errors.paidVia.join(" ")}</p>
                ) : null}
                {mode === "waive" && state.errors?.reason ? (
                  <p className="mt-1 text-xs">{state.errors.reason.join(" ")}</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            size="lg"
            className="w-full"
            disabled={pending || (mode === "waive" && reason.trim().length < 5)}
            onClick={submit}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "settle" ? `Confirm ${formatPeso(fine.amount)} received` : "Waive this penalty"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
