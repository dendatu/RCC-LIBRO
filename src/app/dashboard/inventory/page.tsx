import Link from "next/link";
import { Boxes, PackageSearch, PackageX, Wrench } from "lucide-react";
import { CopyTable, type CopyRow } from "@/components/catalog/copy-table";
import { InventoryFilters } from "@/components/catalog/inventory-filters";
import { Pagination } from "@/components/catalog/pagination";
import { SectionStockLedger } from "@/components/catalog/section-stock-ledger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/shell/page-header";
import { COPY_STATUS_LABEL, SECTION_META, SECTION_ORDER } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import { formatPeso } from "@/lib/utils";
import type { CirculationSection, CopyStatus, Library } from "@/lib/types";
import {
  countCopiesByStatus,
  getBook,
  listInventory,
  listLibraries,
  type InventoryCopy,
  type InventoryPage,
} from "@/server/data/catalog";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory and copies | RCC LIBRO",
  description:
    "Physical stock across the three RCC branch libraries: barcodes, sub-accession numbers, shelf locations, condition and acquisition value.",
};

const PER_PAGE = 40;
const SECTION_STATUSES: CopyStatus[] = ["damaged", "lost", "maintenance"];

/** A section view is driven by `search_books()`, so the flat ledger is not queried. */
const EMPTY_INVENTORY: InventoryPage = { rows: [], total: 0, limit: PER_PAGE, offset: 0 };
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function readStatus(value: string): CopyStatus | null {
  return (Object.keys(COPY_STATUS_LABEL) as CopyStatus[]).includes(value as CopyStatus)
    ? (value as CopyStatus)
    : null;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("librarian", "admin");
  const params = await searchParams;

  const raw = (key: string) => (Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] ?? ""));
  const q = raw("q").slice(0, 80);
  const branch = raw("branch") && /^\d+$/.test(raw("branch")) ? Number(raw("branch")) : undefined;
  const status = readStatus(raw("status"));
  const rawSection = raw("section");
  const section = SECTION_ORDER.includes(rawSection as CirculationSection)
    ? (rawSection as CirculationSection)
    : undefined;
  const rawBookId = raw("book");
  const bookId = UUID_PATTERN.test(rawBookId) ? rawBookId : undefined;
  const page = Math.max(1, Number(raw("page") || 1) || 1);

  const [book, libraries, totals, inventory] = await Promise.all([
    bookId ? getBook(bookId) : Promise.resolve(null),
    listLibraries(),
    countCopiesByStatus(),
    section
      ? Promise.resolve(EMPTY_INVENTORY)
      : listInventory({
          branch,
          statuses: status ? [status] : undefined,
          q: q || undefined,
          bookId,
          limit: PER_PAGE,
          offset: (page - 1) * PER_PAGE,
        }),
  ]);

  const hrefFor = (next: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (branch) search.set("branch", String(branch));
    if (section) search.set("section", section);
    if (status) search.set("status", status);
    if (book?.id) search.set("book", book.id);
    if (next > 1) search.set("page", String(next));
    const suffix = search.toString();
    return suffix ? `/dashboard/inventory?${suffix}` : "/dashboard/inventory";
  };

  const shelvedValue = inventory.rows.reduce(
    (sum, row) => sum + Number(row.acquisition_price ?? 0),
    0,
  );
  const queueCount = SECTION_STATUSES.reduce((sum, key) => sum + totals[key], 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Collection management"
        title="Inventory and copies"
        description="The physical stock register: one row per barcode, with its sub-accession number, shelf location, condition and PHP acquisition price."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/catalog">Catalogue</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/catalog/new">Accession a title</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Copies registered"
          value={Object.values(totals).reduce((sum, count) => sum + count, 0)}
          hint="Across all three branches"
          icon={<Boxes />}
        />
        <StatTile
          label="On the shelf"
          value={totals.available}
          hint={`${totals.borrowed} on loan · ${totals.reserved} on hold`}
          icon={<PackageSearch />}
          tone="success"
        />
        <StatTile
          label="Lost copies"
          value={totals.lost}
          hint="Settled as lost-book penalties"
          icon={<PackageX />}
          tone={totals.lost > 0 ? "danger" : "default"}
          href="/dashboard/inventory?status=lost"
        />
        <StatTile
          label="Repair queue"
          value={totals.damaged + totals.maintenance}
          hint={`${totals.damaged} damaged · ${totals.maintenance} under maintenance`}
          icon={<Wrench />}
          tone={queueCount > 0 ? "warning" : "default"}
          href="/dashboard/inventory?status=damaged"
        />
      </div>

      {book ? (
        <Alert variant="info">
          <AlertTitle>Filtered to one title</AlertTitle>
          <AlertDescription>
            Showing the copy register of <span className="font-medium">{book.title}</span> (accession{" "}
            {book.accession_number}, {book.library_name}).{" "}
            <Link href="/dashboard/inventory" className="font-medium underline underline-offset-4">
              Clear this filter
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <InventoryFilters
        values={{
          q,
          branch: branch ? String(branch) : "all",
          status: status ?? "all",
          section: section ?? "all",
          bookId: book?.id,
        }}
        libraries={libraries as Pick<Library, "id" | "code" | "name">[]}
      />

      {section ? (
        <SectionStockLedger
          section={section}
          branch={branch}
          q={q || undefined}
          statuses={status ? [status] : undefined}
          page={page}
          hrefFor={hrefFor}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {status ? `${COPY_STATUS_LABEL[status]} copies` : "All physical copies"}
            </CardTitle>
            <CardDescription>
              {inventory.total} item{inventory.total === 1 ? "" : "s"} in view
              {shelvedValue > 0 ? ` · ${formatPeso(shelvedValue)} acquisition value on this page` : ""}.
              Tick copies to move them to one status at once, or use “Edit” for a single copy — loans
              and holds are set at the circulation desk.{" "}
              {SECTION_ORDER.filter((slug) => !SECTION_META[slug].borrowable)
                .map((slug) => SECTION_META[slug].label)
                .join(" and ")}{" "}
              copies are flagged “Library use only” and never leave the room.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CopyTable
              rows={inventory.rows as CopyRow[]}
              bookId={book?.id}
              accessionNumber={book?.accession_number}
              canManage
              selectable
              showTitle={!book}
              emptyMessage={
                q || status || branch
                  ? "No copies match this filter. Clear the search, or check the branch filter — the item may be housed at another RCC library."
                  : "Nothing has been accessioned yet. Start with the catalogue’s “Accession a title” form."
              }
            />
            {inventory.total > PER_PAGE ? (
              <Pagination page={page} perPage={PER_PAGE} total={inventory.total} hrefFor={hrefFor} className="mt-4" />
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {SECTION_STATUSES.map((key) => (
          <QueueCard key={key} status={key} total={totals[key]} libraries={libraries} />
        ))}
      </div>
    </div>
  );
}

async function QueueCard({
  status,
  total,
  libraries,
}: {
  status: CopyStatus;
  total: number;
  libraries: Library[];
}) {
  const rows = (await listInventory({ statuses: [status], limit: 5 }))
    .rows as InventoryCopy[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{COPY_STATUS_LABEL[status]} queue</CardTitle>
        <CardDescription>
          {total} cop{total === 1 ? "y" : "ies"} system-wide
          {total === 0 ? " — nothing to process." : "."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-ink">{row.book?.title ?? "Unknown title"}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {row.barcode} · {row.shelf_location ?? "Unshelved"}
              </p>
            </div>
            <Link
              href={`/book/${row.barcode}`}
              className="shrink-0 text-[11px] font-medium text-brand-600 hover:underline"
            >
              Open
            </Link>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-lg bg-secondary px-3 py-4 text-center text-[11px] text-muted-foreground">
            {libraries.length
              ? `No ${COPY_STATUS_LABEL[status].toLowerCase()} copies on record.`
              : "Branch libraries are not configured yet."}
          </p>
        ) : null}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/dashboard/inventory?status=${status}`}>
            Review the {COPY_STATUS_LABEL[status].toLowerCase()} queue
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
