"use client";

import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function normalise(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  if (typeof metadata === "string") {
    try {
      const parsed: unknown = JSON.parse(metadata);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function AuditMetadataDialog({
  action,
  entityType,
  entityId,
  createdAt,
  actorName,
  metadata,
}: {
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actorName: string;
  metadata: unknown;
}) {
  const details = normalise(metadata);
  const entries = Object.entries(details);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Show details for ${action}`}>
          <Braces />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{action}</DialogTitle>
          <DialogDescription>
            {actorName} · {entityType}
            {entityId ? ` · ${entityId}` : ""} · {createdAt}
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This event was recorded without additional metadata.
          </p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-border bg-parchment px-3 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {key.replaceAll("_", " ")}
                </dt>
                <dd className="mt-1 break-words font-mono text-xs text-ink">
                  {typeof value === "object" && value !== null
                    ? JSON.stringify(value)
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <details className="rounded-lg border border-border bg-secondary px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-ink">
            Raw JSON payload
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-ink p-3 text-[11px] leading-relaxed text-cream">
            {JSON.stringify(details, null, 2)}
          </pre>
        </details>

        <DialogFooter>
          <p className="mr-auto text-[11px] text-muted-foreground">
            Audit rows are append-only; administrators cannot edit or delete them.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
