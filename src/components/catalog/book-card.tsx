import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BOOK_STATUS_LABEL, SECTION_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { BookStatus, CirculationSection } from "@/lib/types";
import { BookCover } from "./book-cover";

export interface BookCardBook {
  id: string;
  title: string;
  author: string;
  cover_image_url: string | null;
  section: CirculationSection | string;
  status: BookStatus | string;
  call_number?: string;
  accession_number?: string;
  library_name?: string | null;
  category_name?: string | null;
  total_copies?: number;
  available_copies?: number;
  publication_year?: number | null;
}

const statusBadge: Record<string, "success" | "info" | "warning" | "destructive" | "secondary" | "gold"> = {
  available: "success",
  borrowed: "info",
  reserved: "gold",
  damaged: "warning",
  lost: "destructive",
  processing: "secondary",
};

export function BookCard({
  book,
  href,
  actions,
  showAvailability = true,
  className,
}: {
  book: BookCardBook;
  href: string;
  actions?: React.ReactNode;
  showAvailability?: boolean;
  className?: string;
}) {
  const section = book.section as CirculationSection;
  const meta = SECTION_META[section];
  const available = Number(book.available_copies ?? 0);
  const total = Number(book.total_copies ?? 0);

  return (
    <article
      className={cn(
        "surface-card hover-lift flex h-full flex-col gap-4 p-4",
        className,
      )}
    >
      <div className="flex gap-4">
        <Link href={href} className="w-24 shrink-0" aria-label={`Open ${book.title}`}>
          <BookCover title={book.title} author={book.author} imageUrl={book.cover_image_url} sizes="96px" />
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={href} className="block">
            <h3 className="line-clamp-2 font-serif text-[15px] leading-snug font-semibold text-ink hover:text-brand-700">
              {book.title}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{book.author || "Unattributed"}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={statusBadge[book.status] ?? "secondary"}>
              {BOOK_STATUS_LABEL[book.status as BookStatus] ?? book.status}
            </Badge>
            {meta ? (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", meta.hue)}>
                {meta.label}
              </span>
            ) : null}
          </div>

          <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            {book.call_number ? (
              <div className="flex justify-between gap-2">
                <dt>Call no.</dt>
                <dd className="truncate font-mono text-ink-soft">{book.call_number}</dd>
              </div>
            ) : null}
            {book.accession_number ? (
              <div className="flex justify-between gap-2">
                <dt>Accession</dt>
                <dd className="truncate font-mono text-ink-soft">{book.accession_number}</dd>
              </div>
            ) : null}
            {book.library_name ? (
              <div className="flex justify-between gap-2">
                <dt>Branch</dt>
                <dd className="truncate text-right text-ink-soft">{book.library_name}</dd>
              </div>
            ) : null}
            {book.category_name ? (
              <div className="flex justify-between gap-2">
                <dt>Subject</dt>
                <dd className="truncate text-right text-ink-soft">{book.category_name}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {showAvailability && total > 0 ? (
        <div className="rounded-lg bg-secondary px-3 py-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-ink-soft">
            <span>
              {available > 0 ? `${available} on shelf` : "All copies out"}
            </span>
            <span className="tabular-nums">
              {available}/{total}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-dark">
            <div
              className={cn("h-full rounded-full", available > 0 ? "bg-success" : "bg-danger/60")}
              style={{ width: `${Math.round((available / Math.max(1, total)) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {actions ? <div className="mt-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </article>
  );
}
