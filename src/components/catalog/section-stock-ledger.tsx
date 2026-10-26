import Link from "next/link";
import { Boxes, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SECTION_META } from "@/lib/constants";
import type { CirculationSection, CopyStatus } from "@/lib/types";
import { listInventoryForBook, searchCatalogue } from "@/server/data/catalog";
import { CopyTable } from "./copy-table";
import { Pagination } from "./pagination";

const LEDGER_PAGE_SIZE = 12;

/**
 * Section-scoped copy ledger.
 *
 * `listInventory()` cannot filter copies on the parent title’s section, and the
 * section rules that decide "library use only" live on the title, so a section
 * view walks the other way: `search_books()` returns the section’s titles (and
 * its `total_count` drives pagination), then each title’s registered copies are
 * listed under it. All counting stays in the database.
 */
export async function SectionStockLedger({
  section,
  branch,
  q,
  page,
  hrefFor,
  statuses,
}: {
  section: CirculationSection;
  branch?: number;
  q?: string;
  page: number;
  hrefFor: (page: number) => string;
  /** Optional copy-status narrowing applied after the section’s titles are resolved. */
  statuses?: CopyStatus[];
}) {
  const meta = SECTION_META[section];
  const titles = await searchCatalogue({
    q,
    library: branch,
    section,
    limit: LEDGER_PAGE_SIZE,
    offset: (page - 1) * LEDGER_PAGE_SIZE,
  });

  if (titles.rows.length === 0) {
    return (
      <EmptyState
        icon={<Boxes className="size-6" />}
        title="No title in this section"
        description={
          q
            ? `Nothing in ${meta.label} matches “${q}”. Clear the search term, or check the branch filter — the section may be housed at another RCC library.`
            : `${meta.label} has no accessioned title for this branch yet. Accession titles into the section from the catalogue form.`
        }
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/inventory">Back to the full ledger</Link>
          </Button>
        }
      />
    );
  }

  const groups = await Promise.all(
    titles.rows.map(async (row) => ({
      title: row,
      copies: (await listInventoryForBook(row.id)).filter(
        (copy) => !statuses?.length || statuses.includes(copy.status),
      ),
    })),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-4 py-3">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.hue}`}>
            {meta.label}
          </span>
          {meta.borrowable ? (
            <Badge variant="success">Circulating</Badge>
          ) : (
            <Badge variant="warning">
              <Lock className="size-3" /> Library use only
            </Badge>
          )}
          <span className="truncate">{meta.rule}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          Copies are listed under their title; ticking them updates the whole selection at once.
        </p>
      </div>

      {groups.map((group) => {
        const onShelf = group.copies.filter((copy) => copy.status === "available").length;
        return (
          <section key={group.title.id} className="surface-card p-4">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/catalog/${group.title.id}`}
                  className="block truncate font-serif text-sm font-semibold text-ink hover:text-brand-700"
                >
                  {group.title.title}
                </Link>
                <p className="truncate text-[11px] text-muted-foreground">
                  {group.title.author} · {group.title.library_name} ·{" "}
                  <span className="font-mono">{group.title.call_number}</span> ·{" "}
                  <span className="font-mono">{group.title.accession_number}</span>
                </p>
              </div>
              <p className="shrink-0 text-[11px] text-muted-foreground">
                <span className="font-medium text-ink">{onShelf}</span> of{" "}
                {group.title.total_copies} on the shelf
              </p>
            </header>

            <CopyTable
              rows={group.copies}
              bookId={group.title.id}
              accessionNumber={group.title.accession_number}
              canManage
              selectable
              emptyMessage={
                statuses?.length
                  ? "No copy of this title carries the selected status."
                  : "This title is catalogued but no physical copy is registered yet."
              }
            />
          </section>
        );
      })}

      <Pagination
        page={page}
        perPage={LEDGER_PAGE_SIZE}
        total={titles.total}
        hrefFor={hrefFor}
      />
    </div>
  );
}
