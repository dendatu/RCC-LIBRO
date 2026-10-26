"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  EyeOff,
  Loader2,
  PlusCircle,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copySchema } from "@/lib/validators";
import type { BookCategory, CatalogueBook, Library } from "@/lib/types";
import {
  addCopiesAction,
  deleteBookAction,
  setBookPublishAction,
  type AccessionResult,
} from "@/server/actions/catalog";
import { BookAccessionForm, type AccessionValues } from "./book-accession-form";
import { useCatalogAction } from "./use-catalog-action";

/** Catalogue record → the controlled field values the accession form expects. */
function toFormValues(book: CatalogueBook): Partial<AccessionValues> {
  return {
    accessionNumber: book.accession_number,
    callNumber: book.call_number,
    isbn: book.isbn ?? "",
    title: book.title,
    author: book.author,
    subject: book.subject ?? "",
    publisher: book.publisher ?? "",
    publicationYear: book.publication_year ?? undefined,
    edition: book.edition ?? "",
    language: book.language,
    categoryId: book.category_id ?? undefined,
    libraryId: book.library_id,
    section: book.section,
    description: book.description ?? "",
    coverImageUrl: book.cover_image_url ?? "",
    acquisitionPrice: undefined,
    isPublished: book.is_published ? "true" : "false",
  };
}

export function BookEditDialog({
  book,
  branches,
  categories,
}: {
  book: CatalogueBook;
  branches: Pick<Library, "id" | "code" | "name">[];
  categories: Pick<BookCategory, "id" | "name">[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Save className="size-3.5" /> Edit record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit catalogue record</DialogTitle>
          <DialogDescription>
            Accession {book.accession_number}. Changes are written to the audit trail and synced to
            every issued book card.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <BookAccessionForm
            mode="edit"
            bookId={book.id}
            defaults={toFormValues(book)}
            branches={branches}
            categories={categories}
            onSaved={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface CopyFormValues {
  count: number;
  shelfLocation: string;
  condition: string;
  acquisitionPrice?: number;
}

export function AddCopiesDialog({ book }: { book: CatalogueBook }) {
  const [open, setOpen] = useState(false);
  const action = useCatalogAction<AccessionResult>(addCopiesAction, {
    onSuccess: () => setOpen(false),
  });

  const { register, handleSubmit, formState } = useForm<CopyFormValues>({
    resolver: zodResolver(
      copySchema.omit({ bookId: true }).pick({
        count: true,
        shelfLocation: true,
        condition: true,
        acquisitionPrice: true,
      }),
    ) as unknown as Resolver<CopyFormValues>,
    defaultValues: { count: 1, shelfLocation: "", condition: "Good" },
  });

  const submit = handleSubmit((values) =>
    void action.submit({
      bookId: book.id,
      count: values.count,
      shelfLocation: values.shelfLocation,
      condition: values.condition,
      acquisitionPrice: values.acquisitionPrice,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="size-3.5" /> Add copies
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register physical copies</DialogTitle>
          <DialogDescription>
            Each copy receives the next barcode and an accession number suffixed with its copy number
            (e.g. {book.accession_number}-01), plus a book card ready to print from the QR studio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="copy-count">Number of copies</Label>
              <Input id="copy-count" type="number" min="1" max="50" {...register("count")} />
              <p className="text-[11px] text-muted-foreground">{formState.errors.count?.message ?? action.errors.count?.[0]}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="copy-condition">Condition</Label>
              <Input id="copy-condition" placeholder="Good" {...register("condition")} />
              <p className="text-[11px] text-muted-foreground">
                {formState.errors.condition?.message ?? action.errors.condition?.[0]}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="copy-shelf">Shelf location</Label>
              <Input id="copy-shelf" placeholder="CGS — Reference aisle 3, bay B" {...register("shelfLocation")} />
              <p className="text-[11px] text-muted-foreground">
                {formState.errors.shelfLocation?.message ?? action.errors.shelfLocation?.[0]}
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="copy-price">Acquisition price per copy (₱)</Label>
              <Input
                id="copy-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="850.00"
                {...register("acquisitionPrice", {
                  setValueAs: (value: unknown) => (value === "" || value == null ? undefined : Number(value)),
                })}
              />
              <p className="text-[11px] text-muted-foreground">
                {formState.errors.acquisitionPrice?.message ?? action.errors.acquisitionPrice?.[0]}
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
              Register copies
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PublishToggle({ book }: { book: CatalogueBook }) {
  const action = useCatalogAction<{ bookId: string; isPublished: boolean }>(setBookPublishAction);
  const nextPublished = !book.is_published;

  return (
    <Button
      variant={nextPublished ? "default" : "secondary"}
      size="sm"
      disabled={action.pending}
      onClick={() =>
        void action.submit({ id: book.id, isPublished: nextPublished ? "true" : "false" })
      }
    >
      {action.pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : nextPublished ? (
        <Upload className="size-3.5" />
      ) : (
        <EyeOff className="size-3.5" />
      )}
      {nextPublished ? "Publish in OPAC" : "Withdraw from OPAC"}
    </Button>
  );
}

export function DeleteBookDialog({ book }: { book: CatalogueBook }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const action = useCatalogAction<undefined>(deleteBookAction, {
    onSuccess: () => {
      setOpen(false);
      router.push("/dashboard/catalog");
    },
  });

  const ready = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" /> Delete this title permanently?
          </DialogTitle>
          <DialogDescription>
            “{book.title}” and its {book.total_copies} physical cop
            {book.total_copies === 1 ? "y" : "ies"}, book cards and shelf locations are removed. The
            borrowing history stays in the audit trail. Titles with open loans cannot be deleted —
            withdraw them instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">
              Keep the record
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            type="button"
            disabled={!ready || action.pending}
            onClick={() => {
              if (!ready) {
                toast.error("Type DELETE to confirm the removal.");
                return;
              }
              void action.submit({ id: book.id });
            }}
          >
            {action.pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete permanently
          </Button>
        </DialogFooter>

        {action.state?.ok ? (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="size-3.5" /> {action.state.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
