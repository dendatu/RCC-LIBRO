import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CalendarPlus,
  Library,
  Pencil,
  QrCode,
  ShieldQuestion,
} from "lucide-react";
import { BookActions } from "@/components/catalog/book-actions";
import { BookCover } from "@/components/catalog/book-cover";
import { BookEditDialog, PublishToggle } from "@/components/catalog/book-record-actions";
import { CopyTable } from "@/components/catalog/copy-table";
import { LoanHistoryTable } from "@/components/catalog/loan-history-table";
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
import { PageHeader } from "@/components/shell/page-header";
import { Progress } from "@/components/ui/progress";
import { BOOK_STATUS_LABEL, COPY_STATUS_LABEL, SECTION_META } from "@/lib/constants";
import { getMember, isStaff } from "@/lib/rbac";
import { formatDate, formatPeso } from "@/lib/utils";
import type { CopyStatus } from "@/lib/types";
import {
  countOpenLoansForBook,
  getBook,
  listBookRecords,
  listBorrowHistory,
  listCategories,
  listInventoryForBook,
  listLibraries,
} from "@/server/data/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) return { title: "Title not found | RCC LIBRO" };
  return {
    title: `${book.title} | RCC LIBRO Catalogue`,
    description: `${book.author || "Unattributed"} · Call number ${book.call_number} · ${
      SECTION_META[book.section]?.label ?? book.section
    } at ${book.library_name}.`,
  };
}

export default async function BookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const flags = await searchParams;

  const member = await getMember();
  if (!member) notFound();
  const staff = isStaff(member);

  const book = await getBook(id);
  if (!book) notFound();

  const [copies, records, history, openLoans, branches, categories] = await Promise.all([
    listInventoryForBook(book.id),
    staff ? listBookRecords(book.id) : Promise.resolve([]),
    listBorrowHistory(book.id, staff ? 12 : 5),
    staff ? countOpenLoansForBook(book.id) : Promise.resolve(0),
    staff ? listLibraries() : Promise.resolve([]),
    staff ? listCategories() : Promise.resolve([]),
  ]);

  const section = SECTION_META[book.section];
  const onShelf = copies.filter((copy) => copy.status === "available").length;
  const valuation = copies.reduce((sum, copy) => sum + Number(copy.acquisition_price ?? 0), 0);
  const statusCounts = copies.reduce<Record<string, number>>((acc, copy) => {
    acc[copy.status] = (acc[copy.status] ?? 0) + 1;
    return acc;
  }, {});

  const notice =
    flags.created === "1" ? "created" : flags.saved === "1" ? "saved" : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={staff ? "Catalogue record" : "Catalogue"}
        title={book.title}
        description={book.author || "Unattributed"}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/catalog">
                <ArrowLeft className="size-4" /> Catalogue
              </Link>
            </Button>
            {staff ? (
              <>
                <BookEditDialog book={book} branches={branches} categories={categories} />
                <Button variant="gold" asChild>
                  <Link href={`/dashboard/qr?book=${book.id}`}>
                    <QrCode className="size-4" /> Print labels
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {notice ? (
        <Alert variant="info">
          <AlertTitle>
            {notice === "created" ? "Title accessioned" : "Catalogue record updated"}
          </AlertTitle>
          <AlertDescription>
            {notice === "created"
              ? `Book cards were issued automatically for every copy. Print the QR labels from the QR studio.`
              : `Changes are recorded in the audit trail and mirrored on each copy’s book card.`}
          </AlertDescription>
        </Alert>
      ) : null}

      {!book.is_published ? (
        <Alert variant="warning">
          <ShieldQuestion className="size-4" />
          <AlertTitle>Withdrawn from the public catalogue</AlertTitle>
          <AlertDescription>
            This record is hidden in the OPAC and in borrower search results. Republish it from the
            edit form once the title returns to the shelf.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-5 sm:flex-row">
            <div className="w-36 shrink-0">
              <BookCover
                title={book.title}
                author={book.author}
                imageUrl={book.cover_image_url}
                imprint={book.publisher}
                priority
                sizes="144px"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    book.status === "available"
                      ? "success"
                      : book.status === "lost"
                        ? "destructive"
                        : book.status === "damaged"
                          ? "warning"
                          : book.status === "reserved"
                            ? "gold"
                            : "info"
                  }
                >
                  {BOOK_STATUS_LABEL[book.status]}
                </Badge>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${section?.hue ?? ""}`}>
                  {section?.label ?? book.section}
                </span>
                <span className="text-xs text-muted-foreground">{book.library_name}</span>
              </div>

              {book.description ? (
                <p className="text-sm leading-relaxed text-ink-soft">{book.description}</p>
              ) : null}

              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  { term: "Accession number", detail: book.accession_number },
                  { term: "Call number", detail: book.call_number },
                  { term: "ISBN", detail: book.isbn || "—" },
                  { term: "Publisher", detail: book.publisher || "—" },
                  { term: "Published", detail: book.publication_year ? String(book.publication_year) : "—" },
                  { term: "Edition", detail: book.edition || "—" },
                  { term: "Language", detail: book.language },
                  { term: "Subject", detail: book.category_name ?? book.subject ?? "—" },
                ].map((row) => (
                  <div key={row.term} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
                    <dt className="text-xs text-muted-foreground">{row.term}</dt>
                    <dd className="truncate text-right font-medium text-ink">{row.detail}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/inventory?book=${book.id}`}>
                    <Boxes className="size-3.5" /> Inventory sheet
                  </Link>
                </Button>
                {!staff && onShelf === 0 && section?.borrowable ? (
                  <Button variant="gold" size="sm" asChild>
                    <Link href="/dashboard/reservations">
                      <CalendarPlus className="size-3.5" /> Reserve this title
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Holding status</CardTitle>
              <CardDescription>{book.total_copies} copy register{book.total_copies === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={book.total_copies ? (onShelf / book.total_copies) * 100 : 0}
                indicatorClassName={onShelf > 0 ? "bg-success" : "bg-danger"}
              />
              <p className="text-sm text-ink-soft">
                <span className="font-serif text-xl text-ink">{onShelf}</span> of{" "}
                {book.total_copies} on the shelf right now.
              </p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span>{COPY_STATUS_LABEL[status as CopyStatus] ?? status}</span>
                    <span className="tabular-nums text-ink-soft">{count}</span>
                  </li>
                ))}
                {Object.keys(statusCounts).length === 0 ? <li>No copies registered yet.</li> : null}
              </ul>

              {staff ? (
                <p className="rounded-lg bg-secondary px-3 py-2 text-[11px] text-ink-soft">
                  {openLoans > 0
                    ? `${openLoans} open loan(s). Deletion stays blocked until they are checked in.`
                    : section
                      ? section.rule
                      : "No open loans on this title."}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-ink-soft">
              <p>{section?.rule ?? "Standard circulation rules apply."}</p>
              <p className="text-[11px] text-muted-foreground">
                Accessioned {formatDate(book.created_at)} · last edited {formatDate(book.updated_at)}
                {staff && valuation > 0 ? ` · collection value ${formatPeso(valuation)}` : ""}
              </p>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link href="/opac">
                  <Library className="size-3.5" /> Search the public catalogue
                </Link>
              </Button>
            </CardContent>
          </Card>

          {staff ? (
            <Card>
              <CardHeader>
                <CardTitle>Catalogue maintenance</CardTitle>
                <CardDescription>Recorded in the audit trail under your name.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PublishToggle book={book} />
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/catalog/${book.id}/edit`}>
                      <Pencil className="size-3.5" /> Full edit form
                    </Link>
                  </Button>
                </div>
                <BookActions bookId={book.id} title={book.title} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Physical copies</CardTitle>
          <CardDescription>
            Barcode, sub-accession number, shelf location, condition and the PHP acquisition price of
            each copy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyTable
            rows={copies}
            bookId={book.id}
            accessionNumber={book.accession_number}
            canManage={staff}
          />
        </CardContent>
      </Card>

      {staff && records.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Digital book cards</CardTitle>
            <CardDescription>
              Issued automatically when a copy is accessioned — the modern equivalent of the pocket card.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {records.map((record) => (
              <div key={record.id} className="rounded-lg border border-border bg-parchment p-3">
                <p className="truncate font-serif text-sm font-semibold text-ink">{record.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{record.author}</p>
                <dl className="mt-2 space-y-0.5 text-[11px] text-ink-soft">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Accession</dt>
                    <dd className="font-mono">{record.accession_number ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Call no.</dt>
                    <dd className="font-mono">{record.call_number ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Card issued</dt>
                    <dd>{formatDate(record.issued_at)}</dd>
                  </div>
                </dl>
                <p className="mt-2 truncate rounded bg-white px-2 py-1 font-mono text-[10px] text-brand-700">
                  {record.qr_payload}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lending history</CardTitle>
          <CardDescription>
            {staff
              ? "Recent issues and check-ins for this title, pulled from the circulation ledger."
              : "Your own loans of this title, newest first."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoanHistoryTable rows={history} hideTitle />
        </CardContent>
      </Card>
    </div>
  );
}
