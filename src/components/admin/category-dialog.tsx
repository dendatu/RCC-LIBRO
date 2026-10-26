"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { slugify } from "@/lib/utils";
import { saveCategoryAction } from "@/server/actions/admin";

/** Editable shape of one `book_categories` row. */
export interface CategoryDraft {
  categoryId?: number;
  name: string;
  slug: string;
  description: string;
  parentId?: number;
  isActive: boolean;
}

/** Parent choices, supplied by the page so the dialog stays presentational. */
export interface CategoryOption {
  id: number;
  name: string;
}

const EMPTY: CategoryDraft = { name: "", slug: "", description: "", isActive: true };

function ErrorText({ name, errors }: { name: string; errors?: Record<string, string[]> }) {
  const message = errors?.[name]?.[0];
  if (!message) return null;
  return (
    <p className="mt-1 text-[11px] font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

/**
 * Create or edit one node of the subject taxonomy. Slug is derived from the name
 * while blank, and the parent list excludes the category being edited so a node
 * can never be dropped inside itself.
 */
export function CategoryDialog({
  category,
  options,
  triggerLabel,
}: {
  category?: CategoryDraft;
  options: CategoryOption[];
  triggerLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft>(category ?? EMPTY);
  const { submit, state, pending } = useFormAction(saveCategoryAction);

  const editing = Boolean(category?.categoryId);

  useEffect(() => {
    if (open) setDraft(category ?? EMPTY);
  }, [open, category]);

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Category saved.");
    setOpen(false);
    router.refresh();
  }, [state, router]);

  const set = <K extends keyof CategoryDraft>(key: K) => (value: CategoryDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm">
            <FolderTree />
            {triggerLabel}
          </Button>
        ) : (
          <Button variant="gold" size="sm">
            <Plus />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${category?.name ?? "category"}` : "Add a subject category"}</DialogTitle>
          <DialogDescription>
            Categories drive the browse pages, the public catalogue facets and the subject mix on the
            analytics dashboard. The slug becomes part of the catalogue URL.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit({
              name: draft.name,
              slug: draft.slug || slugify(draft.name),
              description: draft.description,
              parentId: draft.parentId ?? undefined,
              isActive: draft.isActive,
              id: draft.categoryId ?? undefined,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Category name</Label>
            <Input
              id="category-name"
              value={draft.name}
              maxLength={80}
              disabled={pending}
              onChange={(event) => set("name")(event.target.value)}
              placeholder="Filipiniana"
            />
            <ErrorText name="name" errors={state?.errors} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-slug">URL slug</Label>
            <Input
              id="category-slug"
              value={draft.slug}
              maxLength={80}
              disabled={pending}
              onChange={(event) => set("slug")(slugify(event.target.value))}
              placeholder="filipiniana"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank to derive it from the name. Lower-case letters, numbers and hyphens only.
            </p>
            <ErrorText name="slug" errors={state?.errors} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-parent">Parent category</Label>
            <select
              id="category-parent"
              value={draft.parentId == null ? "" : String(draft.parentId)}
              disabled={pending}
              onChange={(event) =>
                set("parentId")(event.target.value ? Number(event.target.value) : undefined)
              }
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              <option value="">None — top-level category</option>
              {options
                .filter((option) => option.id !== draft.categoryId)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
            </select>
            <ErrorText name="parentId" errors={state?.errors} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-description">Shelf-guide note</Label>
            <Textarea
              id="category-description"
              rows={3}
              value={draft.description}
              maxLength={500}
              disabled={pending}
              onChange={(event) => set("description")(event.target.value)}
              placeholder="Shown to borrowers browsing the category in the public catalogue."
            />
            <ErrorText name="description" errors={state?.errors} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-input bg-muted/40 px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="category-active">Visible in the catalogue</Label>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                A hidden category keeps its titles but disappears from browse pages and analytics.
              </p>
            </div>
            <Switch
              id="category-active"
              checked={draft.isActive}
              disabled={pending}
              onCheckedChange={set("isActive")}
              aria-label="Visible in the catalogue"
            />
          </div>

          {state && !state.ok ? (
            <Alert variant="destructive">
              <AlertTitle>Category not saved</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="gold" disabled={pending || draft.name.trim().length < 2}>
              {pending ? <Loader2 className="animate-spin" /> : <FolderTree />}
              {pending ? "Saving…" : editing ? "Save category" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
