import { SECTION_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Lock, Timer } from "lucide-react";
import type { CirculationSection, FineType } from "@/lib/types";

/** Penalty kinds, worded the way they read on a statement of penalties. */
const FINE_TYPES: Record<FineType, string> = {
  overdue_daily: "Overdue — daily rate",
  reserve_hourly: "Overdue — reserve hourly rate",
  lost_book: "Lost book — replacement",
  damaged_book: "Damaged book — repair",
  manual: "Manual assessment",
};

export function fineTypeLabel(type: FineType | string) {
  return FINE_TYPES[type as FineType] ?? type.replace(/_/g, " ");
}

/**
 * The circulation rule for a section, rendered straight from SECTION_META so
 * the desk always quotes the same policy the database enforces.
 */
export function SectionRule({
  section,
  className,
  withLabel = true,
}: {
  section: CirculationSection | string;
  className?: string;
  withLabel?: boolean;
}) {
  const meta = SECTION_META[section as CirculationSection] ?? SECTION_META.general;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-xs font-medium",
        meta.hue,
        className,
      )}
    >
      {withLabel ? <span className="font-semibold">{meta.label}</span> : null}
      <span className="inline-flex items-center gap-1.5">
        {meta.borrowable ? <Timer className="size-3.5" /> : <Lock className="size-3.5" />}
        {meta.rule}
      </span>
    </div>
  );
}
