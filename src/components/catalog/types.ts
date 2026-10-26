import type { CatalogQuery } from "@/server/data/catalog";

/** Filter values as they live in the URL/controlled inputs (strings + sentinel). */
export type CatalogFilterValues = {
  q: string;
  library: string;
  section: string;
  category: string;
  status: string;
  availableOnly: boolean;
};

export type { CatalogQuery };
