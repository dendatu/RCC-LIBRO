"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { COPY_STATUS_LABEL, STATUS_TONE } from "@/lib/constants";
import { cn, formatPeso } from "@/lib/utils";
import { copySchema, copyUpdateSchema } from "@/lib/validators";
import type { BookCopy, CirculationSection, CopyStatus } from "@/lib/types";
import { useCatalogFormAction } from "./catalog-action-hook";
import {
  addCopiesAction,
  bulkUpdateCopiesAction,
  regenerateCardAction,
  updateCopyAction,
  type AccessionResult,
  type BulkCopyResult,
  type CopyResult,
} from "@/server/actions/catalog";

export type CopyRow = BookCopy & {
  book: {
    id: string;
    title: string;
    author: string;
    accession_number: string;
    call_number: string;
    section: CirculationSection;
    library_id: number;
    library_name?: string;
  } | null;
};

/** `copyUpdateSchema` output shape; "processing" is not an editable status. */
type CopyFormValues = {
  copyId: string;
  status: Exclude<CopyStatus, "processing">;
  condition?: string;
  shelfLocation?: string;
  notes?: string;
};

type BulkValues = {
  bookId: string;
  count: number;
  shelfLocation: string;
  condition: string;
  acquisitionPrice?: number;
};

/** Only the circulation desk may drive these two statuses. */
const DESK_OWNED: CopyStatus[] = ["borrowed", "reserved"];
const STATUS_OPTIONS: CopyFormValues["status"][] = [
  "available",
  "damaged",
  "lost",
  "maintenance",
  "borrowed",
  "reserved",
];

/** A copy still in processing has no cataloguing status the desk can edit. */
function editableStatus(status: CopyStatus): CopyFormValues["status"] {
  return status === "processing" ? "available" : status;
}

function StatusBadge({ status }: { status: CopyStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        STATUS_TONE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {DESK_OWNED.includes(status) ? <ShieldAlert className="size-3" /> : null}
      {COPY_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function CopyTable({
  rows,
  bookId,
  accessionNumber,
  canManage = false,
  showTitle = false,
  selectable = false,
  emptyMessage = "No physical copies are registered for this title yet.",
}: {
  rows: CopyRow[];
  bookId?: string;
  accessionNumber?: string;
  canManage?: boolean;
  showTitle?: boolean;
  /** Ledger view: staff can tick copies and move many of them to one status at once. */
  selectable?: boolean;
  emptyMessage?: string;
}) {
  const editor = useCatalogFormAction<CopyResult>(updateCopyAction);
  const card = useCatalogFormAction<CopyResult>(regenerateCardAction);
  const bulk = useCatalogFormAction<AccessionResult>(addCopiesAction);
  const batch = useCatalogFormAction<BulkCopyResult>(bulkUpdateCopiesAction);

  const [editing, setEditing] = useState<CopyRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState<CopyStatus>("maintenance");
  const [batchShelf, setBatchShelf] = useState("");

  const selectableIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allSelected = selected.length > 0 && selected.length === rows.length;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CopyFormValues>({
    resolver: zodResolver(copyUpdateSchema) as unknown as Resolver<CopyFormValues>,
  });

  const {
    register: registerBulk,
    handleSubmit: submitBulk,
    reset: resetBulk,
    formState: { errors: bulkErrors },
  } = useForm<BulkValues>({
    resolver: zodResolver(copySchema) as unknown as Resolver<BulkValues>,
    defaultValues: { bookId: bookId ?? "", count: 1, shelfLocation: "", condition: "Good" },
  });

  useEffect(() => {
    if (!editor.state) return;
    if (editor.state.ok) {
      toast.success(editor.state.message ?? "Copy updated.");
      setEditing(null);
    } else {
      toast.error(editor.state.message ?? "The copy could not be updated.");
    }
  }, [editor.state]);

  useEffect(() => {
    if (!card.state) return;
    if (card.state.ok) toast.success(card.state.message ?? "Book card regenerated.");
    else toast.error(card.state.message ?? "The book card could not be regenerated.");
  }, [card.state]);

  useEffect(() => {
    if (!bulk.state) return;
    if (bulk.state.ok) {
      toast.success(bulk.state.message ?? "Copies accessioned.");
      setAdding(false);
      void resetBulk({ bookId: bookId ?? "", count: 1, shelfLocation: "", condition: "Good" });
    } else {
      toast.error(bulk.state.message ?? "The copies could not be registered.");
    }
  }, [bulk.state, resetBulk, bookId]);

  useEffect(() => {
    if (!batch.state) return;
    if (batch.state.ok) {
      toast.success(batch.state.message ?? "Copies updated.");
      setSelected([]);
      setBatchShelf("");
    } else {
      toast.error(batch.state.message ?? "The selected copies could not be updated.");
    }
  }, [batch.state]);

  /** A new page of rows replaces the ledger, so a stale tick list is dropped. */
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => selectableIds.includes(id)));
  }, [selectableIds]);

  function toggleCopy(copyId: string) {
    setSelected((prev) =>
      prev.includes(copyId) ? prev.filter((id) => id !== copyId) : [...prev, copyId],
    );
  }

  function applyBatch() {
    if (selected.length === 0) {
      toast.error("Tick at least one copy to move its status.");
      return;
    }
    void batch.submit({ copyIds: selected, status: batchStatus, shelfLocation: batchShelf });
  }

  function openEditor(row: CopyRow) {
    reset({
      copyId: row.id,
      status: editableStatus(row.status),
      condition: row.condition ?? "Good",
      shelfLocation: row.shelf_location ?? "",
      notes: row.notes ?? "",
    });
    setEditing(row);
  }

  const saveCopy = handleSubmit((values) => {
    const payload: Record<string, unknown> = { ...values };
    if (!values.shelfLocation) delete payload.shelfLocation;
    if (!values.notes) delete payload.notes;
    void editor.submit(payload);
  });

  const saveBulk = submitBulk((values) => {
    const payload: Record<string, unknown> = { ...values };
    if (values.acquisitionPrice === undefined) delete payload.acquisitionPrice;
    void bulk.submit(payload);
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} physical cop{rows.length === 1 ? "y" : "ies"}
          {accessionNumber ? ` under accession ${accessionNumber}` : ""}.
        </p>
        {canManage && bookId ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add copies
          </Button>
        ) : null}
      </div>

      {selectable && rows.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-secondary p-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) =>
                  setSelected(checked === true ? selectableIds : [])
                }
                aria-label="Select every copy on this page"
              />
              Select all on this page
            </label>
            <span className="text-[11px] text-muted-foreground">
              {selected.length} selected
              {selected.length > 0 ? ` · ${new Set(rows.filter((row) => selected.includes(row.id)).map((row) => row.book?.id)).size} title(s)` : ""}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="batch-status">Move to status</Label>
              <Select
                value={batchStatus}
                onValueChange={(value) => setBatchStatus(value as CopyStatus)}
              >
                <SelectTrigger id="batch-status" className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {COPY_STATUS_LABEL[status] ?? status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="batch-shelf">Shelf location (optional)</Label>
              <Input
                id="batch-shelf"
                value={batchShelf}
                onChange={(event) => setBatchShelf(event.target.value)}
                placeholder="Leave unchanged"
                className="w-full sm:w-52"
              />
            </div>

            <Button size="lg" onClick={applyBatch} disabled={batch.pending || selected.length === 0}>
              {batch.pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Update {selected.length || ""}
            </Button>

            {selected.length > 0 ? (
              <Button size="lg" variant="ghost" onClick={() => setSelected([])} disabled={batch.pending}>
                <X className="size-4" /> Clear
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <Table containerClassName="mt-3">
        <TableHeader>
          <TableRow>
            {selectable ? <TableHead className="w-10"><span className="sr-only">Select</span></TableHead> : null}
            <TableHead>Barcode</TableHead>
            {showTitle ? <TableHead className="hidden md:table-cell">Title</TableHead> : null}
            <TableHead>Copy</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Shelf location</TableHead>
            <TableHead className="hidden lg:table-cell">Condition</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Price</TableHead>
            {canManage ? <TableHead className="text-right">Manage</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {selectable ? (
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected.includes(row.id)}
                      onCheckedChange={() => toggleCopy(row.id)}
                      aria-label={`Select copy ${row.barcode}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Image
                      src={`/api/qr/${encodeURIComponent(row.barcode)}?size=96`}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 rounded border border-border bg-white p-0.5"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/book/${encodeURIComponent(row.barcode)}`}
                        className="block truncate font-mono text-xs font-medium text-ink hover:text-brand-700"
                      >
                        {row.barcode}
                      </Link>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {row.accession_number ?? "—"}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {showTitle ? (
                  <TableCell className="hidden max-w-56 md:table-cell">
                    <Link
                      href={`/dashboard/catalog/${row.book?.id ?? ""}`}
                      className="block truncate text-sm font-medium text-ink hover:text-brand-700"
                    >
                      {row.book?.title ?? "Unknown title"}
                    </Link>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {row.book?.author}
                    </span>
                  </TableCell>
                ) : null}

                <TableCell className="text-sm tabular-nums text-ink-soft">
                  <span className="block">#{row.copy_number}</span>
                  {row.is_library_use_only ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-[10px] font-medium text-warning">
                      <Lock className="size-2.5" /> Library use only
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="hidden text-xs text-ink-soft sm:table-cell">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3 text-brand-400" />
                    {row.shelf_location ?? "Unshelved"}
                  </span>
                </TableCell>
                <TableCell className="hidden text-xs text-ink-soft lg:table-cell">
                  {row.condition}
                </TableCell>
                <TableCell className="hidden text-right text-xs tabular-nums text-ink-soft lg:table-cell">
                  {row.acquisition_price === null ? "—" : formatPeso(row.acquisition_price)}
                </TableCell>

                {canManage ? (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" title="Download the QR label (PNG)" asChild>
                        <a
                          href={`/api/qr/${encodeURIComponent(row.barcode)}?size=512`}
                          download={`rcc-${row.barcode}.png`}
                        >
                          <Download className="size-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Regenerate the digital book card"
                        disabled={card.pending}
                        onClick={() => void card.submit({ copyId: row.id })}
                      >
                        {card.pending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditor(row)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit copy {editing?.barcode}</DialogTitle>
            <DialogDescription>
              These are collection-care changes. Loans and holds are recorded at the circulation desk.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveCopy} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="copy-status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) =>
                  setValue("status", value as CopyFormValues["status"], { shouldDirty: true })
                }
              >
                <SelectTrigger id="copy-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {COPY_STATUS_LABEL[status] ?? status}
                      {DESK_OWNED.includes(status) ? " — desk-controlled" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status ? (
                <p className="text-[11px] font-medium text-destructive">{errors.status.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="copy-condition">Physical condition</Label>
                <Input id="copy-condition" placeholder="Good" {...register("condition")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="copy-shelf">Shelf location</Label>
                <Input id="copy-shelf" placeholder="General Stack, Shelf 3" {...register("shelfLocation")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="copy-notes">Desk notes</Label>
              <Textarea
                id="copy-notes"
                rows={2}
                placeholder="Missing back cover; rebound with tape."
                {...register("notes")}
              />
            </div>

            {editor.state && !editor.state.ok ? (
              <p className="text-xs font-medium text-destructive">{editor.state.message}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editor.pending}>
                {editor.pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save copy
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add copies in bulk</DialogTitle>
            <DialogDescription>
              Each new copy takes the next barcode and a sub-accession of{" "}
              {accessionNumber ?? "the title"} — for example {accessionNumber ?? "ACC-2026-0142"}-04.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveBulk} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-count">How many copies?</Label>
              <Input
                id="bulk-count"
                type="number"
                min="1"
                max="50"
                {...registerBulk("count", {
                  setValueAs: (value) => (value === "" || value === null ? 1 : Number(value)),
                })}
              />
              {bulkErrors.count ? (
                <p className="text-[11px] font-medium text-destructive">{bulkErrors.count.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-shelf">Shelf location</Label>
              <Input id="bulk-shelf" placeholder="Filipiniana Stack, Shelf 1" {...registerBulk("shelfLocation")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-condition">Condition</Label>
                <Input id="bulk-condition" placeholder="Good" {...registerBulk("condition")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-price">Price per copy (PHP)</Label>
                <Input
                  id="bulk-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="850.00"
                  {...registerBulk("acquisitionPrice", {
                    setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                  })}
                />
              </div>
            </div>

            {bulk.state && !bulk.state.ok ? (
              <p className="text-xs font-medium text-destructive">{bulk.state.message}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={bulk.pending || !bookId}>
                {bulk.pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Register copies
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
