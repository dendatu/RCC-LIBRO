import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Library,
  MapPin,
  QrCode,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookCover } from "@/components/catalog/book-cover";
import { LoanHistoryTable } from "@/components/catalog/loan-history-table";
import { COPY_STATUS_LABEL, INSTITUTION, SECTION_META } from "@/lib/constants";
import { getMember, isStaff } from "@/lib/rbac";
import { formatDate, formatPeso } from "@/lib/utils";
import {
  getBook,
  getBookByAccession,
  getCopyByBarcode,
  listBookRecordByCopy,
  listBorrowHistory,
  listCopiesByBook,
} from "@/server/data/catalog";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function resolveCode(barcode: string) {
  return decodeURIComponent(barcode).trim();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ barcode: string }>;
}): Promise<Metadata> {
  const { barcode } = await params;
  const code = resolveCode(barcode);
  const copy = await getCopyByBarcode(code);
  const book = copy ? await getBook(copy.book_id) : await getBookByAccession(code);

  if (!book) {
    return {
      title: "Unknown copy | RCC LIBRO",
      description:
        "This barcode is not attached to a copy in the Republic Central Colleges catalogue.",
    };
  }

  return {
    title: `${book.title} | ${copy ? copy.barcode : book.accession_number}`,
    description: `${book.author || "Unattributed"} · ${
      SECTION_META[book.section]?.label ?? book.section
    } · ${book.library_name}. Call number ${book.call_number}.`,
  };
}

export default async function CopyLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ barcode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { barcode } = await params;
  const flags = await searchParams;
  const code = resolveCode(barcode);

  const member = await getMember();
  const staff = isStaff(member);

  const copy = await getCopyByBarcode(code);
  const book = copy ? await getBook(copy.book_id) : await getBookByAccession(code);
  if (!book) notFound();

  const copies = copy ? [copy] : await listCopiesByBook(book.id);
  const labelCopy = copies[0];
  const identifier = labelCopy?.barcode ?? book.accession_number;

  const [record, history] = await Promise.all([
    labelCopy ? listBookRecordByCopy(labelCopy.id) : Promise.resolve(null),
    listBorrowHistory(book.id, staff ? 10 : 4),
  ]);

  const section = SECTION_META[book.section];
  const scanMode = String(flags.scan ?? "") === "borrow";
  const onShelf = copies.filter((item) => item.status === "available").length;

  return (
    <main className="paper-texture min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/opac"
            className="inline-flex items-center gap-2 text-xs font-medium text-brand-600 hover:underline"
          >
            <Library className="size-4" /> {INSTITUTION} — public catalogue
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground">
            {copy ? `copy ${copy.barcode}` : `accession ${book.accession_number}`}
          </span>
        </header>

        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="space-y-4">
            <div className="print-sheet surface-card p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${encodeURIComponent(identifier)}?size=320`}
                alt={`QR code of ${book.title}`}
                className="mx-auto size-40 rounded border border-border bg-white p-2"
              />
              <p className="mt-3 text-center font-mono text-[11px] text-brand-700">{identifier}</p>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                {COPY_STATUS_LABEL[labelCopy?.status ?? book.status]}
              </p>
            </div>

            {staff ? (
              <Card className="no-print">
                <CardHeader>
                  <CardTitle>Circulation desk</CardTitle>
                  <CardDescription>Issue this exact copy from the borrow screen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="gold" className="w-full" asChild>
                    <Link
                      href={`/dashboard/circulation?barcode=${encodeURIComponent(identifier)}`}
                    >
                      <ScanLine className="size-4" /> Borrow this copy
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/inventory?book=${book.id}`}>
                      <QrCode className="size-4" /> Open copy records
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-5">
            <Card>
              <CardContent className="flex flex-col gap-5 sm:flex-row">
                <div className="w-28 shrink-0">
                  <BookCover
                    title={book.title}
                    author={book.author}
                    imageUrl={book.cover_image_url}
                    imprint={book.publisher}
                    priority
                    sizes="112px"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h1 className="font-serif text-2xl leading-tight text-ink">{book.title}</h1>
                    <p className="mt-1 text-sm text-ink-soft">{book.author || "Unattributed"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        book.status === "available"
                          ? "success"
                          : book.status === "lost"
                            ? "destructive"
                            : "info"
                      }
                    >
                      {book.status === "available"
                        ? "On the shelf"
                        : COPY_STATUS_LABEL[book.status]}
                    </Badge>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${section?.hue ?? ""}`}
                    >
                      {section?.label ?? book.section}
                    </span>
                    <span className="text-xs text-muted-foreground">{book.library_name}</span>
                  </div>

                  <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    {[
                      { term: "Call number", detail: book.call_number },
                      { term: "Accession number", detail: book.accession_number },
                      { term: "Publisher", detail: book.publisher ?? "—" },
                      {
                        term: "Published",
                        detail: book.publication_year ? String(book.publication_year) : "—",
                      },
                      { term: "ISBN", detail: book.isbn ?? "—" },
                      { term: "Language", detail: book.language },
                    ].map((row) => (
                      <div
                        key={row.term}
                        className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1"
                      >
                        <dt className="text-xs text-muted-foreground">{row.term}</dt>
                        <dd className="truncate text-right font-medium text-ink">{row.detail}</dd>
                      </div>
                    ))}
                  </dl>

                  {book.description ? (
                    <p className="text-sm leading-relaxed text-ink-soft">{book.description}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {scanMode ? (
              <Alert variant="info" className="no-print">
                <BookOpenCheck className="size-4" />
                <AlertTitle>This copy was scanned for borrowing</AlertTitle>
                <AlertDescription>
                  {copy ? (
                    <>
                      Barcode <span className="font-mono">{copy.barcode}</span> ·{" "}
                      {copy.accession_number ?? book.accession_number} is{" "}
                      <span className="font-medium">{COPY_STATUS_LABEL[copy.status]}</span>
                      {copy.shelf_location ? ` at ${copy.shelf_location}` : ""}.{" "}
                    </>
                  ) : (
                    <>No single copy was selected — the desk will pick the next available one. </>
                  )}
                  {staff ? (
                    <Link
                      href={`/dashboard/circulation?barcode=${encodeURIComponent(identifier)}`}
                      className="font-medium underline underline-offset-4"
                    >
                      Continue at the circulation desk
                    </Link>
                  ) : (
                    "Hand this book to the librarian at the desk; a borrower’s card and an active SBTR are required."
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            {!section?.borrowable ? (
              <Alert variant="warning">
                <ShieldAlert className="size-4" />
                <AlertTitle>Library use only</AlertTitle>
                <AlertDescription>{section?.rule}</AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Availability</CardTitle>
                <CardDescription>
                  {copies.length === 0
                    ? "No physical copy is registered against this record yet."
                    : `${onShelf} of ${copies.length} copy${copies.length === 1 ? "" : "s"} on the shelf right now.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {copies.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs text-ink">{item.barcode}</span>
                      <span className="text-[11px] text-muted-foreground">
                        copy {item.copy_number} · {item.accession_number ?? book.accession_number}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                        <MapPin className="size-3 text-brand-400" />
                        {item.shelf_location ?? "Unshelved"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{item.condition}</span>
                      {item.acquisition_price !== null ? (
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {formatPeso(item.acquisition_price)}
                        </span>
                      ) : null}
                      <Badge
                        variant={
                          item.status === "available"
                            ? "success"
                            : item.status === "lost"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {COPY_STATUS_LABEL[item.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {record ? (
              <Card>
                <CardHeader>
                  <CardTitle>Digital book card</CardTitle>
                  <CardDescription>
                    Issued automatically when the copy was accessioned — the modern pocket card.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <p className="font-serif text-base text-ink">{record.title}</p>
                  <p className="text-xs text-muted-foreground">{record.author}</p>
                  <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Accession</dt>
                      <dd className="font-mono text-ink-soft">{record.accession_number ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Call number</dt>
                      <dd className="font-mono text-ink-soft">{record.call_number ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Card issued</dt>
                      <dd className="text-ink-soft">{formatDate(record.issued_at)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">QR payload</dt>
                      <dd className="truncate font-mono text-brand-700">{record.qr_payload}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Borrowing history</CardTitle>
                <CardDescription>
                  {staff
                    ? "Recent loans of this title from the circulation ledger."
                    : "Loans you can see for this title, newest first."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LoanHistoryTable rows={history} hideTitle />
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" asChild>
                <Link href="/opac">
                  Search the catalogue <ArrowRight className="size-4" />
                </Link>
              </Button>
              {book.is_published ? (
                <Button asChild>
                  <Link href={`/dashboard/catalog/${book.id}`}>
                    <CalendarClock className="size-4" /> Full catalogue record
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
