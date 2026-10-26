import Link from "next/link";
import {
  BookMarked,
  Library,
  LogIn,
  Search,
  SearchX,
  ServerCrash,
  Layers,
} from "lucide-react";
import { BookCard } from "@/components/catalog/book-card";
import { BookGrid } from "@/components/catalog/book-grid";
import { OpacRecordDialog, type OpacRecord } from "@/components/catalog/opac-record-dialog";
import { buildQueryString, readCatalogFilters } from "@/components/catalog/filter-state";
import { Pagination } from "@/components/catalog/pagination";
import { PageHeader, Prose } from "@/components/marketing/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  APP_NAME,
  INSTITUTION,
  LIBRARY_BRANCHES,
  POLICY,
  SECTION_META,
  SECTION_ORDER,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { getMember } from "@/lib/rbac";
import { cn, formatNumber } from "@/lib/utils";
import type { BookCategory, BookStatus, Library as Branch } from "@/lib/types";
import {
  CATALOGUE_PAGE_SIZE,
  listCategories,
  listLibraries,
  searchCatalogue,
  type CataloguePage,
  type CatalogQuery,
} from "@/server/data/catalog";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Public catalogue (OPAC) | ${APP_NAME}`,
  description: `Open public access catalogue for the ${INSTITUTION} branch libraries — Elementary, High School and College–Graduate. Search titles, authors, call numbers and live shelf availability without signing in.`,
  alternates: { canonical: "/opac" },
};

const EMPTY_PAGE: CataloguePage = { rows: [], total: 0, limit: CATALOGUE_PAGE_SIZE, offset: 0 };

/**
 * The OPAC is the only unauthenticated surface that touches Supabase, so every
 * read is guarded: a missing environment, an unreachable project or an
 * un-migrated RPC must render an empty catalogue rather than an error page.
 */
async function attempt<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error("[opac] read failed", error);
    return fallback;
  }
}

const ALL = "all";

export default async function OpacPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const configured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const params = await searchParams;
  const { values, query, page, perPage } = readCatalogFilters(params);

  const availableQuery: CatalogQuery = { ...query, onlyAvailable: true, limit: 1, offset: 0 };

  const [member, results, availableTitles, libraries, categories] = await Promise.all([
    configured ? attempt(null, () => getMember()) : Promise.resolve(null),
    configured ? attempt(EMPTY_PAGE, () => searchCatalogue(query)) : Promise.resolve(EMPTY_PAGE),
    configured
      ? attempt(EMPTY_PAGE, () => searchCatalogue(availableQuery))
      : Promise.resolve(EMPTY_PAGE),
    configured ? attempt<Branch[]>([], () => listLibraries()) : Promise.resolve<Branch[]>([]),
    configured ? attempt<BookCategory[]>([], () => listCategories()) : Promise.resolve<BookCategory[]>([]),
  ]);

  const hrefFor = (next: number) =>
    `/opac${buildQueryString(params, { page: next > 1 ? String(next) : null })}`;
  const chip = (updates: Record<string, string | null>) => `/opac${buildQueryString(params, updates)}`;

  const activeSection = query.section ? SECTION_META[query.section] : null;
  const shelfCopies = results.rows.reduce((sum, row) => sum + Number(row.available_copies ?? 0), 0);
  const registeredCopies = results.rows.reduce((sum, row) => sum + Number(row.total_copies ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Open public access catalogue"
        title="What is on the shelf at RCC LIBRO?"
        intro="Search every accessioned title of the Republic Central Colleges libraries — Elementary, High School and College–Graduate — without signing in. Availability is live: it updates as books are issued and returned at the circulation desk."
        breadcrumb={[
          { href: "/", label: "Home" },
          { href: "/opac", label: "OPAC" },
        ]}
        className="pb-8"
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <form method="get" action="/opac" role="search" className="surface-card mt-8 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-400"
                aria-hidden
              />
              <Label htmlFor="opac-q" className="sr-only">
                Search the catalogue by title, author, subject, call number or accession number
              </Label>
              <Input
                id="opac-q"
                name="q"
                type="search"
                defaultValue={values.q}
                placeholder="Title, author, subject, call number or accession number"
                autoComplete="off"
                className="h-12 flex-1 pl-9 text-base"
              />
            </div>

            {values.library !== ALL ? <input type="hidden" name="branch" value={values.library} /> : null}
            {values.section !== ALL ? <input type="hidden" name="section" value={values.section} /> : null}
            {values.availableOnly ? <input type="hidden" name="available" value="true" /> : null}

            <Button type="submit" size="lg" className="h-12 shrink-0 px-6" disabled={!configured}>
              <Search className="size-4" /> Search
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="opac-category">Subject category</Label>
              <select
                id="opac-category"
                name="category"
                defaultValue={values.category}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink focus:border-brand-400 focus:outline-none"
              >
                <option value={ALL}>All subjects</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Branch
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Chip label="All branches" active={values.library === ALL} href={chip({ branch: null })} />
                {(libraries.length ? libraries : LIBRARY_BRANCHES.map((b, i) => ({ id: i + 1, code: b.code, name: b.name }))).map(
                  (library) => (
                    <Chip
                      key={library.id}
                      label={`${library.code} — ${library.name}`}
                      active={values.library === String(library.id)}
                      href={chip({ branch: String(library.id), page: null })}
                    />
                  ),
                )}
              </div>
            </div>

            <div className="flex items-end">
              <Chip
                label="On the shelf right now"
                active={values.availableOnly}
                tone="success"
                href={chip({ available: values.availableOnly ? null : "true", page: null })}
              />
            </div>
          </div>
        </form>

        <section className="mt-5 space-y-3" aria-label="Section facets">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Section
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Chip label="All sections" active={values.section === ALL} href={chip({ section: null })} />
            {SECTION_ORDER.map((slug) => (
              <Chip
                key={slug}
                label={SECTION_META[slug].label}
                active={values.section === slug}
                href={chip({ section: slug, page: null })}
              />
            ))}
          </div>
        </section>

        {!configured ? (
          <Alert variant="warning" className="mt-6">
            <ServerCrash className="size-4" />
            <AlertTitle>The catalogue is temporarily offline</AlertTitle>
            <AlertDescription>
              The library database is not configured on this deployment, so no records can be read.
              Search will resume as soon as the connection is restored — the circulation desk can still
              issue and return books in person.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-ink">
                {query.q ? `Results for “${query.q}”` : "All accessioned titles"}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {formatNumber(results.total)} title{results.total === 1 ? "" : "s"} matched
                </span>
                {configured && results.total > 0 ? (
                  <span>
                    {formatNumber(availableTitles.total)} with a copy on the shelf
                  </span>
                ) : null}
                {shelfCopies > 0 ? (
                  <span className="flex items-center gap-1">
                    <Layers className="size-3" />
                    {shelfCopies} of {registeredCopies} copies on this page are shelved
                  </span>
                ) : null}
                {activeSection ? <span>{activeSection.rule}</span> : null}
              </p>
            </div>

            <Link
              href="/dashboard/catalog"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
            >
              <Library className="size-3.5" /> Signed-in catalogue
            </Link>
          </div>

          {results.rows.length === 0 ? (
            <div className="surface-card">
              <EmptyOpac query={query.q} configured={configured} />
            </div>
          ) : (
            <>
              <BookGrid>
                {results.rows.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    href={`/book/${encodeURIComponent(book.accession_number)}`}
                    actions={
                      <>
                        <OpacRecordDialog record={toRecord(book)} />
                        {book.available_copies === 0 ? (
                          <ReserveLink signedIn={Boolean(member)} />
                        ) : (
                          <Badge variant="success">{book.available_copies} on shelf</Badge>
                        )}
                      </>
                    }
                  />
                ))}
              </BookGrid>

              <Pagination
                page={page}
                perPage={perPage}
                total={results.total}
                hrefFor={hrefFor}
                className="mt-6"
              />
            </>
          )}
        </section>

        <section className="surface-card mt-10 bg-cream/70 p-5 sm:p-6" aria-labelledby="opac-helping">
          <h2 id="opac-helping" className="font-serif text-lg text-ink">
            How to read these results
          </h2>
          <Prose className="mt-3 text-[14px]">
            <p>
              A record shows the title’s call number and the branch that houses it.{" "}
              <strong>Circulating sections</strong> leave the library: borrowers hold up to{" "}
              {POLICY.maxBooks} books for {POLICY.loanDays} days, at{" "}
              {POLICY.finePerDay.toFixed(2)} pesos per day overdue. Reserve titles are read in the
              library for {POLICY.reserveMinutes} minutes and may go home from 4 p.m.
            </p>
            <p>
              <strong>Reference and periodicals</strong> never leave the room, so a copy marked
              “library use only” is not unavailable — it is waiting on the shelf for you to consult at
              a table. Sign in to place a hold when every circulating copy is out.
            </p>
            <p>
              Branches: {LIBRARY_BRANCHES.map((branch) => `${branch.code} — ${branch.name}`).join(
                " · ",
              )}
            </p>
          </Prose>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/policies">Borrowing policy</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign in to reserve</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function toRecord(book: CataloguePage["rows"][number]): OpacRecord {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    callNumber: book.call_number,
    accessionNumber: book.accession_number,
    section: book.section,
    status: book.status as BookStatus,
    libraryName: book.library_name,
    categoryName: book.category_name,
    totalCopies: Number(book.total_copies ?? 0),
    availableCopies: Number(book.available_copies ?? 0),
    publicationYear: book.publication_year,
    coverImageUrl: book.cover_image_url,
    copyHref: `/book/${encodeURIComponent(book.accession_number)}`,
  };
}

function Chip({
  label,
  href,
  active,
  tone = "brand",
}: {
  label: string;
  href: string;
  active: boolean;
  tone?: "brand" | "success";
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? tone === "success"
            ? "border-success bg-success/15 text-success"
            : "border-brand-600 bg-brand-600 text-cream"
          : "border-border bg-card text-ink-soft hover:border-brand-300 hover:text-brand-800",
      )}
    >
      {label}
    </Link>
  );
}

function EmptyOpac({ query, configured }: { query?: string; configured: boolean }) {
  if (!configured) {
    return (
      <div className="px-6 py-12 text-center">
        <SearchX className="mx-auto size-7 text-muted-foreground" />
        <h3 className="mt-3 font-serif text-lg text-ink">Nothing to show yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">
          The public catalogue reads the live inventory. Once the database connection is configured,
          accessioned titles appear here for every branch.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-12 text-center">
      <SearchX className="mx-auto size-7 text-muted-foreground" />
      <h3 className="mt-3 font-serif text-lg text-ink">No record matches that search</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">
        {query ? (
          <>
            The OPAC holds no accessioned title matching “{query}” with these filters. Try the
            author’s surname alone, a subject word such as “Filipiniana”, or a call-number fragment
            like 899.33.
          </>
        ) : (
          "No titles match these filters yet. Clear the branch, section or availability filter to see the whole collection."
        )}
      </p>
      <Button variant="outline" className="mt-5" asChild>
        <Link href="/opac">Clear all filters</Link>
      </Button>
    </div>
  );
}

/** Reservation writes live in the reservations module — the OPAC only links to it. */
function ReserveLink({ signedIn }: { signedIn: boolean }) {
  if (!signedIn) {
    return (
      <Button variant="gold" size="sm" asChild>
        <Link href="/login?next=/dashboard/reservations">
          <LogIn className="size-3.5" /> Sign in to reserve
        </Link>
      </Button>
    );
  }
  return (
    <Button variant="gold" size="sm" asChild>
      <Link href="/dashboard/reservations">
        <BookMarked className="size-3.5" /> Reserve this title
      </Link>
    </Button>
  );
}
