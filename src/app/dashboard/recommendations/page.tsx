import Link from "next/link";
import { Flame, Sparkles, WandSparkles } from "lucide-react";
import { BookCover } from "@/components/catalog/book-cover";
import { BookGrid } from "@/components/catalog/book-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ROLE_LABEL } from "@/lib/constants";
import { requireMember } from "@/lib/rbac";
import { formatNumber } from "@/lib/utils";
import { listPopularBooks, listRecommendations } from "@/server/data/catalog";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recommendations | RCC LIBRO",
  description:
    "Reading suggestions drawn from your borrowing history, or the most-borrowed titles across the RCC branch libraries.",
};

export default async function RecommendationsPage() {
  const member = await requireMember();
  const staff = member.role === "librarian" || member.role === "admin";

  const [picks, popular] = await Promise.all([
    staff ? Promise.resolve([]) : listRecommendations(member.user.id, 12),
    staff ? listPopularBooks(12) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Reading suggestions · ${ROLE_LABEL[member.role]}`}
        title={staff ? "Most borrowed titles" : "Recommended for you"}
        description={
          staff
            ? "Circulation leaders across all three branches, pulled from the lending ledger. Use it to plan duplicates, reading-room displays and reserve-stock purchases."
            : "Drawn from the categories and sections you have already borrowed, skipping titles you have taken before and showing only books on the shelf today."
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/catalog">Browse catalogue</Link>
          </Button>
        }
      />

      {staff ? (
        <p className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold-soft/40 px-4 py-2.5 text-xs text-brand-900">
          <Flame className="size-4 shrink-0" />
          Popularity is measured by completed loans, so a title that has just been accessioned will not
          appear until it circulates.
        </p>
      ) : null}

      {staff ? (
        popular.length === 0 ? (
          <EmptyState
            icon={<Flame className="size-6" />}
            title="Nothing has circulated yet"
            description="Once loans are recorded at the circulation desk, the most borrowed titles appear here."
            action={
              <Button asChild>
                <Link href="/dashboard/circulation">Open the circulation desk</Link>
              </Button>
            }
          />
        ) : (
          <BookGrid>
            {popular.map((row) => (
              <article key={row.book_id} className="surface-card hover-lift flex h-full flex-col p-4">
                <div className="flex gap-4">
                  <Link href={`/dashboard/catalog/${row.book_id}`} className="w-24 shrink-0">
                    <BookCover title={row.title} author={row.author} imageUrl={row.cover_image_url} sizes="96px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/catalog/${row.book_id}`}>
                      <h3 className="line-clamp-2 font-serif text-sm font-semibold text-ink hover:text-brand-700">
                        {row.title}
                      </h3>
                    </Link>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.author}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{row.library_name}</p>
                    <Badge variant="gold" className="mt-2">
                      {formatNumber(row.loans)} loans
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/inventory?book=${row.book_id}`}>Copies</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/qr?book=${row.book_id}`}>
                      <WandSparkles className="size-3.5" /> Labels
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </BookGrid>
        )
      ) : picks.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="We need a few more loans first"
          description="Recommendations build themselves from what you borrow. Borrow two or three titles and this shelf fills up with matching reads from the same section."
          action={
            <Button asChild>
              <Link href="/dashboard/catalog">Find something to read</Link>
            </Button>
          }
        />
      ) : (
        <BookGrid>
          {picks.map((row) => (
            <article key={row.id} className="surface-card hover-lift flex h-full flex-col p-4">
              <div className="flex gap-4">
                <Link href={`/dashboard/catalog/${row.id}`} className="w-24 shrink-0">
                  <BookCover title={row.title} author={row.author} imageUrl={row.cover_image_url} sizes="96px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/catalog/${row.id}`}>
                    <h3 className="line-clamp-2 font-serif text-sm font-semibold text-ink hover:text-brand-700">
                      {row.title}
                    </h3>
                  </Link>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.author}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-brand-700">
                    <WandSparkles className="mt-0.5 size-3 shrink-0" />
                    {row.reason}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="mt-4 self-start" asChild>
                <Link href={`/dashboard/catalog/${row.id}`}>Open title card</Link>
              </Button>
            </article>
          ))}
        </BookGrid>
      )}
    </div>
  );
}
