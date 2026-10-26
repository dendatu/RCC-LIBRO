"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  archiveBookAction,
  deleteBookAction,
  type BookIdResult,
} from "@/server/actions/catalog";
import { useCatalogFormAction } from "./catalog-action-hook";

/** Staff-only catalogue maintenance: withdraw a title, or remove it for good. */
export function BookActions({ bookId, title }: { bookId: string; title: string }) {
  const router = useRouter();
  const archive = useCatalogFormAction<BookIdResult>(archiveBookAction);
  const remove = useCatalogFormAction<BookIdResult>(deleteBookAction);
  const [open, setOpen] = useState<"archive" | "delete" | null>(null);

  useEffect(() => {
    if (archive.state?.ok) {
      toast.success(archive.state.message ?? "Title withdrawn.");
      setOpen(null);
      router.push("/dashboard/catalog");
      router.refresh();
    } else if (archive.state && !archive.state.ok) {
      toast.error(archive.state.message ?? "The title could not be withdrawn.");
    }
  }, [archive.state, router]);

  useEffect(() => {
    if (remove.state?.ok) {
      toast.success(remove.state.message ?? "Title deleted.");
      setOpen(null);
      router.push("/dashboard/catalog");
      router.refresh();
    } else if (remove.state && !remove.state.ok) {
      toast.error(remove.state.message ?? "Deletion is blocked.");
    }
  }, [remove.state, router]);

  const pending = archive.pending || remove.pending;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen("archive")} disabled={pending}>
        <Archive className="size-3.5" /> Withdraw
      </Button>
      <Button variant="destructive" size="sm" onClick={() => setOpen("delete")} disabled={pending}>
        <Trash2 className="size-3.5" /> Delete
      </Button>

      <Dialog open={open === "archive"} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw “{title}”?</DialogTitle>
            <DialogDescription>
              The title leaves the public catalogue and OPAC immediately. Copies, book cards and
              lending history are kept for the accession record, and the title can be republished
              from the edit form.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Keep published
            </Button>
            <Button onClick={() => void archive.submit({ id: bookId })} disabled={pending}>
              {archive.pending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
              Withdraw title
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "delete"} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{title}” permanently?</DialogTitle>
            <DialogDescription>
              This removes the catalogue record, every physical copy and its book cards. Titles with
              an open or overdue loan cannot be deleted — clear the loan at the circulation desk
              first. Withdraw the title instead if you only need it off the OPAC.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove.submit({ id: bookId })}
              disabled={pending}
            >
              {remove.pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
