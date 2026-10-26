"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Hourglass, Lock, Search, X } from "lucide-react";
import { cn, toneFromKey } from "@/lib/utils";
import { LIBRARY_BRANCHES, SECTION_META } from "@/lib/constants";
import type { CirculationSection } from "@/lib/types";
import { MarketingPill } from "./button";

/**
 * SAMPLE RECORDS ONLY. These rows exist so the public catalogue shell can be
 * reviewed before the live inventory is loaded; the signed-in OPAC reads the
 * real holdings from the database.
 */
const sampleBooks: SampleBook[] = [
  {
    id: "rc-0001",
    title: "Noli Me Tangere",
    author: "José Rizal",
    year: "1887",
    callNumber: "FIL 899.33 R42n",
    subject: "Filipiniana · Philippine novel",
    branch: "CGS",
    section: "filipiniana",
    copies: 6,
    onShelf: 4,
    status: "available",
  },
  {
    id: "rc-0002",
    title: "El Filibusterismo",
    author: "José Rizal",
    year: "1891",
    callNumber: "FIL 899.33 R42e",
    subject: "Filipiniana · Philippine novel",
    branch: "CGS",
    section: "filipiniana",
    copies: 5,
    onShelf: 0,
    status: "borrowed",
  },
  {
    id: "rc-0003",
    title: "Florante at Laura",
    author: "Francisco Balagtas",
    year: "1838",
    callNumber: "FIL 899.32 B175f",
    subject: "Filipiniana · Tagalog poetry",
    branch: "HS",
    section: "filipiniana",
    copies: 3,
    onShelf: 2,
    status: "available",
  },
  {
    id: "rc-0004",
    title: "Ibong Adarna",
    author: "Traditional Filipino epic",
    year: "n.d.",
    callNumber: "HR 398.2 I14",
    subject: "Home reading · Folklore",
    branch: "EL",
    section: "home_reading",
    copies: 12,
    onShelf: 9,
    status: "available",
  },
  {
    id: "rc-0005",
    title: "Kwentong Bayan: Grade 5 Home Reading Set",
    author: "RCC Elementary Reading Program",
    year: "2024",
    callNumber: "HR 398.209599 K58",
    subject: "Home reading · Filipino children's literature",
    branch: "EL",
    section: "home_reading",
    copies: 20,
    onShelf: 6,
    status: "borrowed",
  },
  {
    id: "rc-0006",
    title: "Ang Pag-ibig sa Tinubuang Lupa at Iba Pang Sipi",
    author: "Compiled for Senior High Philippine Literature",
    year: "2019",
    callNumber: "GEN 899.32 P147",
    subject: "General collection · Literature",
    branch: "HS",
    section: "general",
    copies: 4,
    onShelf: 1,
    status: "reserved",
  },
  {
    id: "rc-0007",
    title: "Kusina at Kwarto: Filipino Short Fiction for the Classroom",
    author: "RCC High School Library",
    year: "2023",
    callNumber: "FIC 899.321 K97",
    subject: "Fiction · Short stories",
    branch: "HS",
    section: "fiction",
    copies: 7,
    onShelf: 7,
    status: "available",
  },
  {
    id: "rc-0008",
    title: "First Light over the Rice Terraces",
    author: "RCC Newly Acquired Display",
    year: "2026",
    callNumber: "NEW 899.33 F123",
    subject: "Newly acquired · Contemporary Filipino novel",
    branch: "CGS",
    section: "newly_acquired",
    copies: 2,
    onShelf: 2,
    status: "available",
  },
  {
    id: "rc-0009",
    title: "Research Methodology for the College Student",
    author: "Curriculum Reserve Listing",
    year: "2021",
    callNumber: "RES 001.42 R318",
    subject: "Reserve books · Research",
    branch: "CGS",
    section: "reserve",
    copies: 8,
    onShelf: 3,
    status: "borrowed",
  },
  {
    id: "rc-0010",
    title: "Undergraduate Theses in Information Technology, 2025",
    author: "RCC College of Computer Studies",
    year: "2025",
    callNumber: "RO 001.43 U66",
    subject: "Research output · Theses",
    branch: "CGS",
    section: "research_output",
    copies: 3,
    onShelf: 3,
    status: "available",
  },
  {
    id: "rc-0011",
    title: "Diksyunaryong Filipino–Ingles Ingles–Filipino",
    author: "Reference Desk",
    year: "2018",
    callNumber: "REF 499.2123 D549",
    subject: "Reference · Language",
    branch: "EL",
    section: "reference",
    copies: 2,
    onShelf: 2,
    status: "library_use",
  },
  {
    id: "rc-0012",
    title: "Atlas of the Philippine Provinces and Cities",
    author: "Reference Desk",
    year: "2020",
    callNumber: "REF 912.59 A813",
    subject: "Reference · Geography",
    branch: "HS",
    section: "reference",
    copies: 1,
    onShelf: 1,
    status: "library_use",
  },
  {
    id: "rc-0013",
    title: "Bound Volume: National Dailies, January–June",
    author: "Periodicals Rack",
    year: "2026",
    callNumber: "PER 070.523 B693",
    subject: "Periodicals · Newspapers",
    branch: "CGS",
    section: "periodicals",
    copies: 1,
    onShelf: 1,
    status: "library_use",
  },
  {
    id: "rc-0014",
    title: "Philippine Journal of Education Studies, Volume 41",
    author: "Periodicals Rack",
    year: "2025",
    callNumber: "PER 370.5 P493",
    subject: "Periodicals · Journals · Education",
    branch: "CGS",
    section: "periodicals",
    copies: 2,
    onShelf: 0,
    status: "library_use",
  },
];

type BookStatus = "available" | "borrowed" | "reserved" | "library_use";

type SampleBook = {
  id: string;
  title: string;
  author: string;
  year: string;
  callNumber: string;
  subject: string;
  branch: (typeof LIBRARY_BRANCHES)[number]["code"];
  section: CirculationSection;
  copies: number;
  onShelf: number;
  status: BookStatus;
};

const STATUS_LABEL: Record<BookStatus, string> = {
  available: "On the shelf",
  borrowed: "On loan",
  reserved: "Reserved",
  library_use: "Library use only",
};

const STATUS_TONE: Record<BookStatus, "success" | "info" | "gold" | "warning"> = {
  available: "success",
  borrowed: "info",
  reserved: "gold",
  library_use: "warning",
};

const AVAILABILITY_FILTERS = [
  { value: "all", label: "All availability" },
  { value: "available", label: "On the shelf" },
  { value: "borrowed", label: "On loan" },
  { value: "reserved", label: "Reserved" },
  { value: "library_use", label: "Library use only" },
];

const SECTION_FILTERS = [
  { value: "all", label: "All sections" },
  { value: "Circulation", label: "Circulation" },
  { value: "Reference", label: "Reference" },
  { value: "Periodicals", label: "Periodicals" },
];

export function CatalogBrowser({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [branch, setBranch] = useState("all");
  const [sectionGroup, setSectionGroup] = useState("all");
  const [availability, setAvailability] = useState("all");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sampleBooks.filter((book) => {
      const matchesQuery =
        needle.length === 0 ||
        [book.title, book.author, book.callNumber, book.subject]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return (
        matchesQuery &&
        (branch === "all" || book.branch === branch) &&
        (sectionGroup === "all" || SECTION_META[book.section].group === sectionGroup) &&
        (availability === "all" || book.status === availability)
      );
    });
  }, [query, branch, sectionGroup, availability]);

  const filtersActive =
    query.trim().length > 0 || branch !== "all" || sectionGroup !== "all" || availability !== "all";

  function clearAll() {
    setQuery("");
    setBranch("all");
    setSectionGroup("all");
    setAvailability("all");
  }

  return (
    <div>
      <form action="/catalog" method="get" role="search" className="surface-card flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-brand-400"
              aria-hidden
            />
            <label htmlFor="catalog-q" className="sr-only">
              Search the catalogue by title, author, subject or call number
            </label>
            <input
              id="catalog-q"
              name="q"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, author, subject or call number…"
              autoComplete="off"
              className="h-12 w-full rounded-full border border-brand-200 bg-white pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-soft/70 focus:border-brand-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-brand-600 px-6 text-sm font-medium text-cream transition-colors hover:bg-brand-700"
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <ChipGroup
            legend="Branch"
            options={[{ value: "all", label: "All branches" }, ...LIBRARY_BRANCHES.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` }))]}
            value={branch}
            onChange={setBranch}
          />
          <ChipGroup legend="Section" options={SECTION_FILTERS} value={sectionGroup} onChange={setSectionGroup} />
          <ChipGroup
            legend="Availability"
            options={AVAILABILITY_FILTERS}
            value={availability}
            onChange={setAvailability}
          />
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-ink-soft" aria-live="polite">
          <strong className="font-serif text-lg text-ink">{results.length}</strong>{" "}
          {results.length === 1 ? "sample record" : "sample records"}
          {query.trim() ? (
            <>
              {" "}for “<span className="text-brand-700">{query.trim()}</span>”
            </>
          ) : null}
        </p>
        {filtersActive ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-[13px] font-medium text-brand-700 transition-colors hover:border-brand-400"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[0.875rem] bg-cream/80 p-4 text-[13px] leading-6 text-ink-soft ring-1 ring-brand-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
        <p>
          These are sample records with fixed availability, shown so the public search can be reviewed
          before the inventory is loaded. Live catalogue search — real copies, real shelf locations and
          reservation queues — is available once you{" "}
          <Link href="/login" className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4">
            sign in
          </Link>
          .
        </p>
      </div>

      {results.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </ul>
      ) : (
        <div className="surface-card mt-6 p-8 text-center">
          <p className="font-serif text-xl text-ink">No sample record matches that</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-ink-soft">
            Try the author’s surname alone, a subject word such as “Filipiniana”, or a call number
            fragment. The desk can also search the accession list for a title that is still being
            catalogued.
          </p>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearAll}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-medium text-cream transition-colors hover:bg-brand-700"
            >
              Reset the search
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BookCard({ book }: { book: SampleBook }) {
  const meta = SECTION_META[book.section];

  return (
    <li className="surface-card hover-lift flex list-none items-stretch gap-4 p-4">
      <div
        aria-hidden
        className={cn(
          "flex h-28 w-[4.5rem] shrink-0 flex-col justify-between overflow-hidden rounded-md bg-gradient-to-br p-2 text-cream shadow-[0_10px_20px_-14px_rgba(47,32,21,0.9)]",
          toneFromKey(book.callNumber),
        )}
      >
        <span className="truncate text-[8px] font-semibold uppercase tracking-[0.14em] text-cream/80">
          {book.branch}
        </span>
        <span className="font-serif text-[10px] leading-tight line-clamp-3">{book.title}</span>
        <span className="h-0.5 w-8 rounded-full bg-cream/50" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] leading-snug text-ink">{book.title}</h3>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          {book.author} · {book.year}
        </p>
        <p className="mt-2 font-mono text-[11.5px] text-brand-600">{book.callNumber}</p>
        <p className="mt-1 text-[12px] leading-5 text-ink-soft">{book.subject}</p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <MarketingPill tone={STATUS_TONE[book.status]}>{STATUS_LABEL[book.status]}</MarketingPill>
          <MarketingPill tone="muted">{meta.label}</MarketingPill>
          {book.status === "available" ? (
            <span className="text-[12px] text-ink-soft">
              {book.onShelf} of {book.copies} copies on the shelf
            </span>
          ) : null}
        </div>

        {book.section === "reserve" ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] leading-5 text-warning">
            <Hourglass className="h-3.5 w-3.5" aria-hidden />
            1 hour in the library · take home from 4 p.m.
          </p>
        ) : null}
        {!meta.borrowable ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] leading-5 text-ink-soft">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {meta.rule}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function ChipGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-brand-600 bg-brand-600 text-cream"
                  : "border-brand-200 bg-white text-ink-soft hover:border-brand-400 hover:text-brand-800",
              )}
            >
              {legend === "Branch" && option.value !== "all" ? (
                <span className={cn("mr-1.5 font-mono text-[11px]", active ? "text-gold-soft" : "text-brand-500")}>
                  {option.value}
                </span>
              ) : null}
              {option.value === "all" ? option.label : option.label.replace(`${option.value} — `, "")}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
