import { cn } from "@/lib/utils";
import { STATUS_TONE } from "@/lib/constants";
import type { BorrowStatus, FineStatus } from "@/lib/types";

const LABELS: Record<string, string> = {
  active: "On loan",
  overdue: "Overdue",
  returned: "Returned",
  lost: "Lost",
  damaged: "Damaged",
  cancelled: "Cancelled",
  pending: "Pending",
  paid: "Paid",
  waived: "Waived",
  disputed: "Disputed",
};

/** A status chip coloured from the shared STATUS_TONE map. */
export function StatusPill({
  status,
  className,
}: {
  status: BorrowStatus | FineStatus | string;
  className?: string;
}) {
  const tone = STATUS_TONE[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
