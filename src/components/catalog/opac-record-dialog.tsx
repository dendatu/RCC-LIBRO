"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, MapPin, QrCode, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BOOK_STATUS_LABEL, SECTION_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { BookStatus, CirculationSection } from "@/lib/types";
import { BookCover } from "./book-cover";

/** Serialisable projection of one `search_books` row, built on the server. */
export type OpacRecord = {
  id: string;
  title: string;
  author: string;
  callNumber: string;
  accessionNumber: string;
  section: CirculationSection;
  status: BookStatus;
  libraryName: string;
  categoryName: string | null;
  totalCopies: number;
  availableCopies: number;
  publicationYear: number | null;
  coverImageUrl: string | null;
  copyHref: string;
};

export function OpacRecordDialog({ record }: { record: OpacRecord }) {
  const [open, setOpen] = useState(false);
  const section = SECTION_META[record.section];
  const borrowable = section?.borrowable ?? true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="size-3.5" /> Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl leading-snug">{record.title}</DialogTitle>
          <DialogDescription>
            {record.author || "Unattributed"}
            {record.publicationYear ? ` · ${record.publicationYear}` : ""}
            {record.categoryName ? ` · ${record.categoryName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="w-32 shrink-0">
            <BookCover
              title={record.title}
              author={record.author}
              imageUrl={record.coverImageUrl}
              sizes="128px"
            />
          </div>

          <dl className="min-w-0 flex-1 space-y-2 text-sm">
            {[
              { term: "Call number", detail: record.callNumber, mono: true },
              { term: "Accession number", detail: record.accessionNumber, mono: true },
              { term: "Branch", detail: record.libraryName },
              { term: "Section", detail: section?.label ?? record.section },
              {
                term: "Copies on the shelf",
                detail: `${record.availableCopies} of ${record.totalCopies}`,
              },
              { term: "Catalogue status", detail: BOOK_STATUS_LABEL[record.status] ?? record.status },
            ].map((row) => (
              <div
                key={row.term}
                className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-1.5"
              >
                <dt className="shrink-0 text-xs text-muted-foreground">{row.term}</dt>
                <dd
                  className={cn(
                    "truncate text-right font-medium text-ink",
                    row.mono && "font-mono text-[13px]",
                  )}
                >
                  {row.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-lg bg-secondary px-4 py-3">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink">
            {borrowable ? (
              <Badge variant="success">Circulating</Badge>
            ) : (
              <>
                <Badge variant="warning">Library use only</Badge>
                <Lock className="size-3.5 text-muted-foreground" aria-hidden />
              </>
            )}
            <span className="min-w-0 flex-1 text-ink-soft">
              {section?.rule ?? "Ask at the circulation desk for the rules of this section."}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={record.copyHref}>
              <QrCode className="size-3.5" /> Copies and shelf list
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={record.copyHref}>
              <ScanLine className="size-3.5" /> Scan label
            </Link>
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Holdings change while you read: a copy issued at the desk disappears from the shelf list on
          the next refresh. Sign in to place a hold on a title that is fully out.
        </p>
      </DialogContent>
    </Dialog>
  );
}
