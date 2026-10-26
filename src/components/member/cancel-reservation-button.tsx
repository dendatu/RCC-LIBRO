"use client";

import { useEffect } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";
import { cancelReservation } from "@/server/actions/member";

export function CancelReservationButton({
  reservationId,
  title,
}: {
  reservationId: string;
  title: string;
}) {
  const action = useFormAction(cancelReservation);

  useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) toast.success(action.state.message ?? "Reservation cancelled.");
    else toast.error(action.state.message ?? "That reservation could not be cancelled.");
  }, [action.state]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-danger hover:bg-danger/10 hover:text-danger"
      disabled={action.pending}
      aria-label={`Cancel the reservation for ${title}`}
      onClick={() => void action.submit({ reservationId })}
    >
      {action.pending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
      Cancel
    </Button>
  );
}
