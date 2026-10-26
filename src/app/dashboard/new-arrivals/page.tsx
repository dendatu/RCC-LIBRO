import Link from "next/link";
import { Building2, Library, QrCode, Sparkles } from "lucide-react";
import { BookCover } from "@/components/catalog/book-cover";
import { BookGrid } from "@/components/catalog/book-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/shell/page-header";
import { SECTION_META } from "@/lib/constants";
import { getMember, isStaff } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { listNewArrivals } from "@/server/data/catalog";
import type { CirculationSection } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New arrivals | RCC LIBRO",
  description:
    "Titles recently accessioned into the Republic Central Colleges branch libraries.",
};

export default async function NewArrivalsPage() {
  const member = await getMember();
  const staff = isStaff(member);
  const arrivals = await listNewArrivals(staff ? 24 : 18);

  const byBranch = arrivals.reduce<Record<string, number>>((acc, row) => {
    acc[row.library_name] = (acc[row.library_name] ?? 0) + 1;
    return acc;
  }, {});
  const topBranch = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Find a book"
        title="New arrivals shelf"
        description="Freshly accessioned titles across the Elementary, High School and College–Graduate libraries, newest first. Borrowers may place these on hold straight away."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/catalog">
                <Library className="size-4" /> Full catalogue
              </Link>
            </Button>
            {staff ? (
              <Button variant="gold" asChild>
                <Link href="/dashboard/catalog/new">
                  <QrCode className="size-4" /> Accession a title
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Titles added recently"
          value={arrivals.length}
          hint="Last 14 days of accessioning"
          icon={<Sparkles />}
          tone="gold"
        />
        <StatTile
          label="Branches receiving"
          value={Object.keys(byBranch).length}
          hint="Elementary, High School, College–Graduate"
          icon={<Building2 />}
        />
        <StatTile
          label="Busiest shelf"
          value={topBranch ? topBranch[1] : 0}
          hint={topBranch ? topBranch[0] : "No arrivals yet"}
          icon={<Library />}
          tone="success"
        />
        <StatTile
          label="Browse everything"
          value="OPAC"
          hint="Open public catalogue search"
          icon={<QrCode />}
          href="/opac"
        />
      </section>

      {arrivals.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="No new arrivals yet"
          description="Titles appear here as soon as they are accessioned into the catalogue."
          action={
            staff ? (
              <Button asChild>
                <Link href="/dashboard/catalog/new">Accession the first title</Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/dashboard/catalog">Browse the catalogue</Link>
              </Button>
            )
          }
        />
      ) : (
        <BookGrid>
          {arrivals.map((row) => {
            const section = row.section as CirculationSection;
            const meta = SECTION_META[section];
            return (
              <article key={row.id} className="surface-card hover-lift flex h-full flex-col p-4">
                <div className="flex gap-4">
                  <Link href={`/dashboard/catalog/${row.id}`} className="w-20 shrink-0">
                    <BookCover title={row.title} author={row.author} imageUrl={row.cover_image_url} sizes="80px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/catalog/${row.id}`}>
                      <h3 className="line-clamp-2 font-serif text-sm font-semibold text-ink hover:text-brand-700">
                        {row.title}
                      </h3>
                    </Link>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.author}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {row.library_name} · added {formatDate(row.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant={meta?.borrowable ? "success" : "secondary"}>
                        {meta?.label ?? row.section}
                      </Badge>
                      {!meta?.borrowable ? (
                        <span className="text-[10px] text-muted-foreground">library use only</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {staff ? (
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/qr?book=${row.id}`}>
                        <QrCode className="size-3.5" /> Print labels
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/inventory?book=${row.id}`}>Inventory</Link>
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="mt-4 self-start" asChild>
                    <Link href={`/dashboard/catalog/${row.id}`}>See shelf details</Link>
                  </Button>
                )}
              </article>
            );
          })}
        </BookGrid>
      )}
    </div>
  );
}
