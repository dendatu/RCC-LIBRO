"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COPY_STATUS_LABEL, SECTION_META, SECTION_ORDER } from "@/lib/constants";
import type { CirculationSection, Library } from "@/lib/types";

const ALL = "all";

export function InventoryFilters({
  values,
  libraries,
}: {
  values: { q: string; branch: string; status: string; section: string; bookId?: string };
  libraries: Pick<Library, "id" | "code" | "name">[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(values);

  function apply(next: typeof values) {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.branch !== ALL) params.set("branch", next.branch);
    if (next.section !== ALL) params.set("section", next.section);
    if (next.status !== ALL) params.set("status", next.status);
    if (values.bookId) params.set("book", values.bookId);
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  return (
    <div className="surface-card p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="inventory-q">Find a copy</Label>
          <Input
            id="inventory-q"
            value={draft.q}
            placeholder="Barcode, copy accession number or shelf location"
            onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
            onKeyDown={(event) => event.key === "Enter" && apply(draft)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inventory-branch">Branch</Label>
          <Select
            value={draft.branch}
            onValueChange={(value) => {
              const next = { ...draft, branch: value };
              setDraft(next);
              apply(next);
            }}
          >
            <SelectTrigger id="inventory-branch" className="w-full lg:w-56">
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
          <Label htmlFor="inventory-section">Section</Label>
          <Select
            value={draft.section}
            onValueChange={(value) => {
              const next = { ...draft, section: value };
              setDraft(next);
              apply(next);
            }}
          >
            <SelectTrigger id="inventory-section" className="w-full lg:w-52">
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sections</SelectItem>
              {SECTION_ORDER.map((slug: CirculationSection) => (
                <SelectItem key={slug} value={slug}>
                  {SECTION_META[slug].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inventory-status">Copy status</Label>
          <Select
            value={draft.status}
            onValueChange={(value) => {
              const next = { ...draft, status: value };
              setDraft(next);
              apply(next);
            }}
          >
            <SelectTrigger id="inventory-status" className="w-full lg:w-44">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              {(Object.keys(COPY_STATUS_LABEL) as (keyof typeof COPY_STATUS_LABEL)[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {COPY_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => apply(draft)}>
          <Search className="size-4" /> Apply
        </Button>
      </div>
    </div>
  );
}
