"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, PackageCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormAction } from "@/hooks/use-form-action";
import {
  cancelReservationAction,
  fulfilReservationAction,
  notifyReservationAction,
} from "@/server/actions/reservations";

interface Props {
  reservationId: string;
  status: "waiting" | "ready";
  title: string;
  borrowerName: string;
}

export function HoldShelfActions({ reservationId, status, title, borrowerName }: Props) {
  const notify = useFormAction(notifyReservationAction);
  const fulfil = useFormAction(fulfilReservationAction);
  const cancel = useFormAction(cancelReservationAction);
  const [barcode, setBarcode] = useState("");
  const [fulfilOpen, setFulfilOpen] = useState(false);

  useEffect(() => {
    if (notify.state?.ok) toast.success(notify.state.message ?? "Member notified.");
    else if (notify.state) toast.error(notify.state.message ?? "Could not notify the member.");
  }, [notify.state]);

  useEffect(() => {
    if (fulfil.state?.ok) {
      toast.success(fulfil.state.message ?? "Hold released.");
      setFulfilOpen(false);
      setBarcode("");
    } else if (fulfil.state) toast.error(fulfil.state.message ?? "The hold could not be released.");
  }, [fulfil.state]);

  useEffect(() => {
    if (cancel.state?.ok) toast.success(cancel.state.message ?? "Reservation cancelled.");
    else if (cancel.state) toast.error(cancel.state.message ?? "The reservation could not be cancelled.");
  }, [cancel.state]);

  const busy = notify.pending || fulfil.pending || cancel.pending;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => void notify.submit({}, { reservationId })}
        title={`Tell ${borrowerName} the copy is ready`}
      >
        <BellRing className="size-3.5" /> Notify
      </Button>

      <Dialog open={fulfilOpen} onOpenChange={setFulfilOpen}>
        <DialogTrigger asChild>
          <Button variant="gold" size="sm" disabled={busy || status !== "ready"}>
            <PackageCheck className="size-3.5" /> Fulfil
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release hold to {borrowerName}</DialogTitle>
            <DialogDescription>
              This opens a loan for “{title}” and marks the hold fulfilled. Scan the copy you are handing over, or leave
              it blank to release the first available copy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`barcode-${reservationId}`}>Copy barcode (optional)</Label>
            <Input
              id={`barcode-${reservationId}`}
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="BC000123"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFulfilOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              disabled={fulfil.pending}
              onClick={() => void fulfil.submit({}, { reservationId, barcode: barcode.trim() })}
            >
              {fulfil.pending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
              Hand over &amp; close hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost"
        size="sm"
        className="text-danger hover:bg-danger/10 hover:text-danger"
        disabled={busy}
        onClick={() => void cancel.submit({}, { reservationId })}
      >
        <XCircle className="size-3.5" /> Cancel
      </Button>
    </div>
  );
}
