"use client";

import { useEffect, useState } from "react";
import { Loader2, BookmarkCheck, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/hooks/use-form-action";
import { reserveBook } from "@/server/actions/member";

/**
 * Self-contained reserve control for the catalogue: it only needs a book id and
 * calls the member server action, which wraps the `reserve_book` RPC.
 */
export function ReserveButton({
  bookId,
  title,
  size = "sm",
  variant = "outline",
  className,
  disabled,
}: {
  bookId: string;
  title?: string;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "secondary" | "gold" | "default";
  className?: string;
  disabled?: boolean;
}) {
  const action = useFormAction(reserveBook);
  const [reserved, setReserved] = useState(false);

  useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) {
      setReserved(true);
      toast.success(action.state.message ?? "Added to your reservation queue.");
    } else {
      toast.error(action.state.message ?? "The desk could not reserve that title.");
    }
  }, [action.state]);

  if (reserved) {
    return (
      <Button
        size={size}
        variant="secondary"
        className={className}
        aria-label={`Reservation recorded for ${title ?? "this title"}`}
      >
        <BookmarkCheck className="size-4" />
        In your queue
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={disabled || action.pending}
      aria-label={`Reserve ${title ?? "this title"}`}
      onClick={() => void action.submit({ bookId })}
    >
      {action.pending ? <Loader2 className="size-4 animate-spin" /> : <BookMarked className="size-4" />}
      Reserve
    </Button>
  );
}
