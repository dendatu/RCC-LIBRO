import Link from "next/link";
import { BookPlus, Info, Library, LibraryBig, SearchX } from "lucide-react";
import { BookCard } from "@/components/catalog/book-card";
import { BookGrid } from "@/components/catalog/book-grid";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { Pagination } from "@/components/catalog/pagination";
import { buildQueryString, readCatalogFilters } from "@/components/catalog/filter-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shell/page-header";
import { SECTION_META } from "@/lib/constants";
import { isStaff, requireMember } from "@/lib/rbac";
import { listCategories, listLibraries, searchCatalogue } from "@/server/data/catalog";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalogue | RCC LIBRO",
  description:
    "Search every accessioned title across the Elementary, High School and College-Graduate branch libraries of Republic Central Colleges.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember();
  const staff = isStaff(member);
  const params = await searchParams;
  const { values, query, page, perPage } = readCatalogFilters(params);

  const [results, libraries, categories] = await Promise.all([
    searchCatalogue(query),
    listLibraries(),
    listCategories(),
  ]);

  const hrefFor = (next: number) =>
    `/dashboard/catalog${buildQueryString(params, { page: next > 1 ? String(next) : null })}`;

  const section = query.section ? SECTION_META[query.section] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={staff ? "Collection management" : "Find a book"}
        title="Catalogue"
        description={
          staff
            ? "Every accessioned title across the three RCC branch libraries. Accession, edit or withdraw a record from here."
            : "Browse the shelves of the Elementary, High School and College–Graduate libraries. Availability updates as books are issued at the circulation desk."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/opac">
                <Library className="size-4" /> Public catalogue
              </Link>
            </Button>
            {staff ? (
              <Button asChild>
                <Link href="/dashboard/catalog/new">
                  <BookPlus className="size-4" /> Add title
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <CatalogFilters
        values={values}
        libraries={libraries}
        categories={categories}
        allowStatus={staff}
        resultCount={results.total}
      />

      {staff ? (
        <Alert variant="info">
          <Info className="size-4" />
          <AlertTitle>Librarian view</AlertTitle>
          <AlertDescription>
            Staff also see unpublished and in-processing records, the rolled-up title status, and the
            inventory sheet behind each copy.
          </AlertDescription>
        </Alert>
      ) : null}

      {results.rows.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" />}
          title="No titles match this search"
          description={
            query.q
              ? `Nothing accessioned matches “${query.q}”. Try the author’s surname, a call number fragment, or clear the branch and section filters.`
              : "The catalogue is empty for this combination of filters. Adjust the section, branch or availability filter."
          }
          action={
            <>
              <Button variant="outline" asChild>
                <Link href="/dashboard/catalog">
                  <LibraryBig className="size-4" /> Reset filters
                </Link>
              </Button>
              {staff ? (
                <Button asChild>
                  <Link href="/dashboard/catalog/new">Accession the first copy</Link>
                </Button>
              ) : null}
            </>
          }
        />
      ) : (
        <>
          {section ? (
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-ink">{section.label}</span> — {section.rule}
            </p>
          ) : null}

          <BookGrid>
            {results.rows.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                href={`/dashboard/catalog/${book.id}`}
                actions={
                  staff ? (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/catalog/${book.id}/edit`}>Edit record</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/inventory?book=${book.id}`}>
                          Copies · {book.available_copies}/{book.total_copies}
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/catalog/${book.id}`}>See shelf location</Link>
                    </Button>
                  )
                }
              />
            ))}
          </BookGrid>

          <Pagination page={page} perPage={perPage} total={results.total} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
