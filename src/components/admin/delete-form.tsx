"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/types";

/** Server action shaped for `useFormAction`. */
type DeleteAction = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/**
 * Destructive confirmation for a single row. The hidden fields are posted to the
 * action, which re-checks the role and the referential guards on the server, so
 * the dialog cannot be used to delete something the database would refuse.
 */
export function DeleteForm({
  action,
  fields,
  title,
  description,
  confirmLabel = "Delete permanently",
  triggerLabel = "Delete",
}: {
  action: DeleteAction;
  fields: Record<string, string>;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { submit, state, pending } = useFormAction(action);

  const succeeded = Boolean(state?.ok);
  useEffect(() => {
    if (!succeeded) return;
    toast.success(state?.message ?? "Deleted.");
    setOpen(false);
    router.refresh();
  }, [succeeded, router, state?.message]);

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {state && !state.ok ? (
          <Alert variant="destructive">
            <AlertTitle>Not deleted</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Every deletion is written to the audit trail with your name and the timestamp.
        </p>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            aria-label={title}
            onClick={() => {
              submit(fields);
              toast.info("Deleting…");
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
