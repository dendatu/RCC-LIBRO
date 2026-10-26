"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOK_STATUS_LABEL, SECTION_META, SECTION_ORDER } from "@/lib/constants";
import type { BookCategory, BookStatus, Library } from "@/lib/types";
import { emptyCatalogFilters } from "./filter-state";
import type { CatalogFilterValues } from "./types";

export type { CatalogFilterValues };
export const emptyFilterValues = emptyCatalogFilters;

/** Query-string keys the filter bar owns — every other param is preserved. */
const FILTER_KEYS = ["q", "branch", "section", "category", "status", "available", "page"] as const;
const ALL = "all";

type Props = {
  values: CatalogFilterValues;
  libraries: Pick<Library, "id" | "code" | "name">[];
  categories: BookCategory[];
  /** Staff may filter on the rolled-up title status; borrowers search availability only. */
  allowStatus?: boolean;
  resultCount?: number;
  placeholder?: string;
};

export function CatalogFilters({
  values,
  libraries,
  categories,
  allowStatus = false,
  resultCount,
  placeholder = "Title, author, call number or accession number",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<CatalogFilterValues>(values);
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(() => {
    let count = 0;
    if (values.q.trim()) count += 1;
    if (values.library !== ALL) count += 1;
    if (values.section !== ALL) count += 1;
    if (values.category !== ALL) count += 1;
    if (values.status !== ALL) count += 1;
    if (values.availableOnly) count += 1;
    return count;
  }, [values]);

  function apply(next: CatalogFilterValues) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.library !== ALL) params.set("branch", next.library);
    if (next.section !== ALL) params.set("section", next.section);
    if (next.category !== ALL) params.set("category", next.category);
    if (next.status !== ALL) params.set("status", next.status);
    if (next.availableOnly) params.set("available", "true");

    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
    setOpen(false);
  }

  function renderFields(idPrefix: string) {
    const selectClass = "w-full";
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-q`}>Search</Label>
          <Input
            id={`${idPrefix}-q`}
            value={draft.q}
            placeholder={placeholder}
            onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply(draft);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-branch`}>Branch</Label>
          <Select
            value={draft.library}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, library: value }))}
          >
            <SelectTrigger id={`${idPrefix}-branch`} className={selectClass}>
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All branches</SelectItem>
              {libraries.map((library) => (
                <SelectItem key={library.id} value={String(library.id)}>
                  {library.name} · {library.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-section`}>Section</Label>
          <Select
            value={draft.section}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, section: value }))}
          >
            <SelectTrigger id={`${idPrefix}-section`} className={selectClass}>
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sections</SelectItem>
              {SECTION_ORDER.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {SECTION_META[slug].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Subject category</Label>
          <Select
            value={draft.category}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}
          >
            <SelectTrigger id={`${idPrefix}-category`} className={selectClass}>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {allowStatus ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-status`}>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger id={`${idPrefix}-status`} className={selectClass}>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any status</SelectItem>
                {(Object.keys(BOOK_STATUS_LABEL) as BookStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {BOOK_STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5 sm:col-span-2">
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-available`} className="cursor-pointer text-ink">
              On the shelf right now
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Hide titles whose copies are all out, lost or in maintenance.
            </p>
          </div>
          <Switch
            id={`${idPrefix}-available`}
            checked={draft.availableOnly}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, availableOnly: checked }))}
          />
        </div>
      </div>
    );
  }

  const clear = () => {
    setDraft(emptyFilterValues);
    apply(emptyFilterValues);
  };

  return (
    <section className="surface-card p-4">
      <div className="hidden gap-4 lg:flex lg:items-start">
        <div className="min-w-0 flex-1">{renderFields("desk")}</div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 pt-6">
          <Button onClick={() => apply(draft)}>
            <Search className="size-4" /> Search
          </Button>
          {activeCount > 0 ? (
            <Button variant="ghost" onClick={clear}>
              <RotateCcw className="size-4" /> Clear {activeCount}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
          <Filter className="size-4 shrink-0 text-brand-500" />
          <span className="truncate">
            {typeof resultCount === "number"
              ? `${resultCount} title${resultCount === 1 ? "" : "s"}`
              : "Narrow the catalogue"}
            {activeCount > 0 ? ` · ${activeCount} filter(s)` : ""}
          </span>
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="size-3.5" /> Filters
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Filter the catalogue</DialogTitle>
              <DialogDescription>
                Search the accessioned collection of the three RCC branch libraries.
              </DialogDescription>
            </DialogHeader>
            {renderFields("drawer")}
            <DialogFooter>
              <Button variant="ghost" onClick={clear}>
                Clear all
              </Button>
              <Button onClick={() => apply(draft)}>
                <Search className="size-4" /> Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
