import { cn, titleCase } from "@/lib/utils";
import { STATUS_TONE } from "@/lib/constants";

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_TONE[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {titleCase(status)}
    </span>
  );
}
