import { bookFilterSchema } from "@/lib/validators";
import { SECTION_ORDER } from "@/lib/constants";
import type { BookStatus, CirculationSection } from "@/lib/types";
import type { CatalogFilterValues, CatalogQuery } from "./types";

export const emptyCatalogFilters: CatalogFilterValues = {
  q: "",
  library: "all",
  section: "all",
  category: "all",
  status: "all",
  availableOnly: false,
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function positiveNumber(value: string): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const STATUSES: BookStatus[] = ["available", "borrowed", "reserved", "damaged", "lost", "processing"];

/**
 * Normalises a request query string into validated filter values plus the
 * argument bag for the `search_books` RPC. Malformed input degrades to "no filter".
 */
export function readCatalogFilters(searchParams: SearchParams): {
  values: CatalogFilterValues;
  query: CatalogQuery;
  page: number;
  perPage: number;
} {
  const rawQ = one(searchParams.q).slice(0, 120);
  const rawSection = one(searchParams.section);
  const rawStatus = one(searchParams.status);
  const rawLibrary = one(searchParams.branch);
  const rawCategory = one(searchParams.category);

  const parsed = bookFilterSchema.safeParse({
    q: rawQ,
    library: positiveNumber(rawLibrary),
    category: positiveNumber(rawCategory),
    section: SECTION_ORDER.includes(rawSection as CirculationSection) ? rawSection : undefined,
    status: STATUSES.includes(rawStatus as BookStatus) ? rawStatus : undefined,
    availableOnly: one(searchParams.available) === "true" ? "true" : undefined,
    page: positiveNumber(one(searchParams.page)),
  });

  const data = parsed.success ? parsed.data : bookFilterSchema.parse({});

  return {
    values: {
      q: rawQ,
      library: rawLibrary || "all",
      section: rawSection || "all",
      category: rawCategory || "all",
      status: rawStatus || "all",
      availableOnly: one(searchParams.available) === "true",
    },
    query: {
      q: data.q || undefined,
      library: data.library,
      section: data.section,
      category: data.category,
      status: data.status,
      onlyAvailable: data.availableOnly === "true",
      limit: data.perPage,
      offset: (data.page - 1) * data.perPage,
    },
    page: data.page,
    perPage: data.perPage,
  };
}

/** Rewrites the current query string, dropping keys set to null. */
export function buildQueryString(
  searchParams: SearchParams,
  updates: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const single = one(value);
    if (single) params.set(key, single);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}
