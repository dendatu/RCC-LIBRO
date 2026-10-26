import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/marketing/catalog-browser";
import { PageHeader } from "@/components/marketing/page-header";
import { Reveal } from "@/components/marketing/reveal";
import { LIBRARY_BRANCHES } from "@/lib/constants";
import { BookOpen, Hourglass, QrCode, SearchCode } from "lucide-react";

export const metadata: Metadata = {
  title: "Public catalogue (OPAC) — RCC LIBRO",
  description:
    "Search the holdings of the Republic Central Colleges Elementary, High School and College & Graduate School libraries by title, author, subject or call number, and see which branch keeps a copy on the shelf.",
};

const TIPS = [
  {
    icon: SearchCode,
    title: "Search the way a librarian shelf-checks",
    body: "Surname first works better than a phrase: “rizal”, “balagtas”. A call-number fragment such as “899.33” returns a whole section of Filipiniana.",
  },
  {
    icon: BookOpen,
    title: "Read the section label before you walk",
    body: "Circulation titles leave the library. Reference works and periodicals are consulted at the table, so a “Library use only” copy is never truly unavailable.",
  },
  {
    icon: QrCode,
    title: "Bring the QR to the desk",
    body: "Every catalogued copy carries a sticker on the lower spine. Scanning it at the counter opens the item, confirms the shelf and issues the loan on your card.",
  },
  {
    icon: Hourglass,
    title: "A borrowed copy can still be yours",
    body: "Sign in to place a hold. The reservation queue is honoured in order, and the next free copy is set aside at the branch you chose for collection.",
  },
];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 120) : "";

  return (
    <>
      <PageHeader
        eyebrow="Public catalogue · OPAC"
        title="Find a title before you leave the classroom"
        intro="The online public access catalogue of Republic Central Colleges — Angeles City Campus. Search by title, author, subject or call number, then check which branch keeps the copy and whether it is on the shelf today."
        breadcrumb={[
          { href: "/", label: "Home" },
          { href: "/catalog", label: "Catalog" },
        ]}
        className="pb-10"
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <CatalogBrowser initialQuery={query} />

        <Reveal>
          <section aria-labelledby="catalog-tips-heading" className="mt-16">
            <div className="max-w-2xl">
              <h2 id="catalog-tips-heading" className="text-2xl text-ink sm:text-3xl">
                How to read a catalogue record
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-ink-soft">
                Three branch shelves, one list of rules. Knowing which section a title belongs to tells
                you what happens next — whether it can go home with you, and for how long.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TIPS.map((tip) => (
                <article key={tip.title} className="surface-card hover-lift p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <tip.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-[16px] leading-snug text-ink">{tip.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">{tip.body}</p>
                </article>
              ))}
            </div>

            <div className="surface-card mt-6 flex flex-col gap-4 bg-cream/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h3 className="text-[17px] text-ink">Where the shelves are</h3>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-soft">
                  {LIBRARY_BRANCHES.map((branch) => (
                    <li key={branch.code} className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-brand-500">{branch.code}</span>
                      {branch.name}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="/policies"
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-brand-300 bg-white px-5 text-sm font-medium text-brand-800 transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                Borrowing rules
              </a>
            </div>
          </section>
        </Reveal>
      </div>
    </>
  );
}
