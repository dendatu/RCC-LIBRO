import Link from "next/link";
import { QrCode, Search, X } from "lucide-react";
import { QrLabelSheet, type QrLabelCopy } from "@/components/catalog/qr-label-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { copyUrl, qrSvg, scanUrl } from "@/lib/qr";
import { SECTION_META, SECTION_ORDER } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import {
  listBooksByIds,
  listInventoryForBook,
  listLibraries,
  searchCatalogue,
} from "@/server/data/catalog";
import type { InventoryCopy } from "@/server/data/catalog";
import type { CirculationSection } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QR code studio | RCC LIBRO",
  description:
    "Batch-print scannable QR labels for physical copies, or issue a crisp vector book card for a single item.",
};

const MAX_LABELS = 60;

interface CandidateRow {
  id: string;
  title: string;
  author: string;
  accession_number: string;
  section: CirculationSection;
  library_name: string;
  total_copies: number;
}

function selectedIds(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^[0-9a-f-]{36}$/i.test(item))
    .slice(0, 8);
}

export default async function QrStudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("librarian", "admin");
  const params = await searchParams;
  const raw = (key: string) => (Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] ?? ""));

  const q = raw("q").slice(0, 80);
  const branch = raw("branch") && /^\d+$/.test(raw("branch")) ? Number(raw("branch")) : undefined;
  const rawSection = raw("section");
  const section = SECTION_ORDER.includes(rawSection as CirculationSection)
    ? (rawSection as CirculationSection)
    : undefined;
  /** `scan` encodes the circulation-desk deep link; `copy` (default) encodes the copy page. */
  const payload = raw("payload") === "scan" ? ("scan" as const) : ("copy" as const);
  const chosen = selectedIds(raw("book"));

  const libraries = await listLibraries();

  let candidates: CandidateRow[] = [];
  if (chosen.length === 0) {
    const page = await searchCatalogue({
      q: q || undefined,
      library: branch,
      section,
      limit: 24,
    });
    candidates = page.rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      accession_number: row.accession_number,
      section: row.section,
      library_name: row.library_name,
      total_copies: row.total_copies,
    }));
  }

  const selectedBooks = chosen.length > 0 ? await listBooksByIds(chosen) : [];
  const copies: InventoryCopy[] = (
    await Promise.all(chosen.map(async (id) => await listInventoryForBook(id)))
  ).flat();

  const labels: QrLabelCopy[] = copies.slice(0, MAX_LABELS).map((copy) => {
    const book = selectedBooks.find((item) => item.id === copy.book_id);
    return {
      barcode: copy.barcode,
      copy_number: copy.copy_number,
      accession_number: copy.accession_number,
      title: copy.book?.title ?? book?.title ?? "Untitled",
      author: copy.book?.author ?? book?.author ?? "",
      call_number: copy.book?.call_number ?? book?.call_number ?? "",
      library_name: book?.library_name ?? "RCC library",
      section: copy.book?.section ?? book?.section ?? "general",
    };
  });

  const svgDataUrls: Record<string, string> = {};
  for (const label of labels) {
    const encoded = payload === "scan" ? scanUrl(label.barcode) : copyUrl(label.barcode);
    const svg = await qrSvg(encoded, 240);
    svgDataUrls[label.barcode] = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  }

  /** Facets must survive picking a title, or the picker loses its branch filter. */
  function facetParams(nextBooks: string[]) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (branch) search.set("branch", String(branch));
    if (section) search.set("section", section);
    if (payload === "scan") search.set("payload", "scan");
    if (nextBooks.length) search.set("book", nextBooks.join(","));
    const suffix = search.toString();
    return suffix ? `/dashboard/qr?${suffix}` : "/dashboard/qr";
  }

  function pickHref(id: string) {
    return facetParams([...chosen, id].slice(-8));
  }

  function dropHref(id: string) {
    return facetParams(chosen.filter((item) => item !== id));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Collection management"
        title="QR code studio"
        description={
          "Pick the titles you accessioned, then print a sheet of scannable labels. Every label points at /book/<barcode>, so the circulation desk and the borrower’s phone resolve the same copy record."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/catalog">Catalogue</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory">Inventory</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Choose titles</CardTitle>
            <CardDescription>
              Search the catalogue and add a title to the label sheet. Up to eight titles, sixty labels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form method="get" action="/dashboard/qr" className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="qr-q">Search titles</Label>
                <Input id="qr-q" name="q" defaultValue={q} placeholder="Title, author or accession number" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr-branch">Branch</Label>
                <select
                  id="qr-branch"
                  name="branch"
                  defaultValue={branch ? String(branch) : ""}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All branches</option>
                  {libraries.map((library) => (
                    <option key={library.id} value={String(library.id)}>
                      {library.name} · {library.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr-section">Section</Label>
                <select
                  id="qr-section"
                  name="section"
                  defaultValue={section ?? ""}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All sections</option>
                  {SECTION_ORDER.map((slug) => (
                    <option key={slug} value={slug}>
                      {SECTION_META[slug].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr-payload">Label payload</Label>
                <select
                  id="qr-payload"
                  name="payload"
                  defaultValue={payload}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="copy">Copy page — /book/&lt;barcode&gt; (shelf and borrower view)</option>
                  <option value="scan">Desk issue — /book/&lt;barcode&gt;?scan=borrow (SVG sheet only)</option>
                </select>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Printed PNG labels are always served by <span className="font-mono">/api/qr/&lt;barcode&gt;</span>{" "}
                  and carry the copy page; the issue-desk payload applies to the vector SVG sheet.
                </p>
              </div>
              <input type="hidden" name="book" value={chosen.join(",")} />
              <Button type="submit" variant="secondary" className="w-full">
                <Search className="size-4" /> Search titles
              </Button>
            </form>

            {chosen.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  On the sheet
                </p>
                {selectedBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">{book.title}</p>
                      <p className="truncate font-mono text-[11px] text-brand-700">
                        {book.accession_number} · {book.total_copies} copies
                      </p>
                    </div>
                    <Link href={dropHref(book.id)} aria-label={`Remove ${book.title} from the sheet`}>
                      <X className="size-4 text-muted-foreground hover:text-destructive" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {q ? `Results for “${q}”` : "Recently accessioned"}
                </p>
                {candidates.map((book) => (
                  <Link
                    key={book.id}
                    href={pickHref(book.id)}
                    className="block rounded-lg border border-border px-3 py-2 transition-colors hover:border-brand-300 hover:bg-muted"
                  >
                    <p className="truncate text-xs font-medium text-ink">{book.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {book.author} · {book.accession_number}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Badge variant="outline">{SECTION_META[book.section]?.label ?? book.section}</Badge>
                      {book.total_copies} label{book.total_copies === 1 ? "" : "s"}
                    </p>
                  </Link>
                ))}
                {candidates.length === 0 ? (
                  <p className="rounded-lg bg-secondary px-3 py-4 text-center text-[11px] text-muted-foreground">
                    Nothing matched. Adjust the search or clear the branch filter.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {labels.length === 0 ? (
            <EmptyState
              icon={<QrCode className="size-6" />}
              title="No labels selected"
              description="Choose one or more titles on the left. Each physical copy becomes its own label carrying the barcode, sub-accession number and call number."
            />
          ) : (
            <QrLabelSheet copies={labels} svgDataUrls={svgDataUrls} />
          )}
        </div>
      </div>
    </div>
  );
}
