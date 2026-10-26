"use client";

import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, BookMarked, Boxes, Layers, Loader2, Save } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LIBRARY_BRANCHES, SECTION_META, SECTION_ORDER } from "@/lib/constants";
import { bookSchema } from "@/lib/validators";
import type { BookCategory, CirculationSection, Library } from "@/lib/types";
import { createBookAction, updateBookAction } from "@/server/actions/catalog";
import type { AccessionResult } from "@/server/actions/catalog";
import { useCatalogAction } from "./use-catalog-action";

const NONE = "none";

export type AccessionValues = {
  accessionNumber: string;
  callNumber: string;
  isbn: string;
  title: string;
  author: string;
  subject: string;
  publisher: string;
  publicationYear?: number;
  edition: string;
  language: string;
  categoryId?: number;
  libraryId: number;
  section: CirculationSection;
  description: string;
  coverImageUrl: string;
  copyCount: number;
  acquisitionPrice?: number;
  isPublished: "true" | "false";
};

const BASE_VALUES: AccessionValues = {
  accessionNumber: "",
  callNumber: "",
  isbn: "",
  title: "",
  author: "",
  subject: "",
  publisher: "",
  edition: "",
  language: "English",
  section: "general",
  description: "",
  coverImageUrl: "",
  copyCount: 1,
  isPublished: "true",
  libraryId: 0,
};

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ?? "min-w-0 space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-[11px] font-medium text-destructive">
          <AlertCircle className="mt-px size-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Empty numeric inputs must become `undefined`, not `""`, or coercion fails. */
const optionalNumber = { setValueAs: (value: unknown) => (value === "" || value == null ? undefined : Number(value)) };

export function BookAccessionForm({
  mode,
  bookId,
  defaults,
  branches,
  categories,
  cancelHref,
  onSaved,
}: {
  mode: "create" | "edit";
  bookId?: string;
  defaults?: Partial<AccessionValues>;
  branches: Pick<Library, "id" | "code" | "name">[];
  categories: Pick<BookCategory, "id" | "name">[];
  cancelHref?: string;
  /** Edit dialogs close themselves; full-page forms navigate to the new record. */
  onSaved?: (result: AccessionResult) => void;
}) {
  const router = useRouter();
  const action = useCatalogAction<AccessionResult>(mode === "create" ? createBookAction : updateBookAction, {
    onSuccess: (result) => {
      if (onSaved) {
        onSaved(result);
        return;
      }
      if (mode === "create") router.push(`/dashboard/catalog/${result.bookId}?created=1`);
      else router.push(`/dashboard/catalog/${result.bookId}?saved=1`);
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccessionValues>({
    // `bookSchema` coerces numbers and flattens the checkbox string, so its
    // inferred input type is wider than these controlled field values.
    resolver: zodResolver(bookSchema) as unknown as Resolver<AccessionValues>,
    defaultValues: {
      ...BASE_VALUES,
      libraryId: Number(branches[0]?.id ?? 0),
      ...defaults,
    },
  });

  const section = watch("section");
  const libraryId = watch("libraryId");
  const categoryId = watch("categoryId");
  const isPublished = watch("isPublished");
  const meta = SECTION_META[section];

  const errorFor = (name: keyof AccessionValues) => errors[name]?.message ?? action.errors[name]?.[0];

  const submit = handleSubmit((values) => {
    const payload: Record<string, unknown> = { ...values };
    if (values.categoryId === undefined || String(categoryId) === NONE) delete payload.categoryId;
    if (bookId) payload.id = bookId;
    void action.submit(payload);
  });

  return (
    <form onSubmit={submit} className="space-y-5">
      {!action.state?.ok && action.state && Object.keys(action.errors).length === 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{action.state.message ?? "The record could not be saved."}</AlertTitle>
        </Alert>
      ) : null}

      <fieldset disabled={action.pending} className="space-y-5">
        <legend className="sr-only">
          {mode === "create" ? "New accession record" : "Edit accession record"}
        </legend>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookMarked className="size-4 text-brand-500" /> Bibliographic
            </CardTitle>
            <CardDescription>
              What the accession book and the catalogue card say about the title.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="title" label="Title" error={errorFor("title")} className="sm:col-span-2">
              <Input id="title" placeholder="Information Technology for the Classroom" {...register("title")} />
            </Field>

            <Field id="author" label="Author" error={errorFor("author")}>
              <Input id="author" placeholder="Dela Cruz, Maria Elena" {...register("author")} />
            </Field>

            <Field id="subject" label="Subject heading" error={errorFor("subject")}>
              <Input id="subject" placeholder="Education — Educational technology" {...register("subject")} />
            </Field>

            <Field id="publisher" label="Publisher" error={errorFor("publisher")}>
              <Input id="publisher" placeholder="RCC Press" {...register("publisher")} />
            </Field>

            <Field id="publicationYear" label="Publication year" error={errorFor("publicationYear")}>
              <Input
                id="publicationYear"
                type="number"
                inputMode="numeric"
                placeholder="2024"
                {...register("publicationYear", optionalNumber)}
              />
            </Field>

            <Field id="edition" label="Edition" error={errorFor("edition")}>
              <Input id="edition" placeholder="3rd edition" {...register("edition")} />
            </Field>

            <Field id="language" label="Language" error={errorFor("language")}>
              <Input id="language" placeholder="English" {...register("language")} />
            </Field>

            <Field
              id="isbn"
              label="ISBN"
              error={errorFor("isbn")}
              hint="ISBN-10 or ISBN-13, dashes allowed."
              className="sm:col-span-2"
            >
              <Input id="isbn" placeholder="978-971-000-000-0" {...register("isbn")} />
            </Field>

            <Field
              id="description"
              label="Annotation"
              error={errorFor("description")}
              hint="Shown on the public catalogue card."
              className="sm:col-span-2"
            >
              <Textarea id="description" rows={3} placeholder="Short annotation for borrowers." {...register("description")} />
            </Field>

            <Field
              id="coverImageUrl"
              label="Cover image path"
              error={errorFor("coverImageUrl")}
              hint="Leave empty for the generated typographic cover."
              className="sm:col-span-2"
            >
              <Input id="coverImageUrl" placeholder="/covers/alchemist.jpg" {...register("coverImageUrl")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="size-4 text-brand-500" /> Holding
            </CardTitle>
            <CardDescription>
              Where the physical stock lives. Every copy is stamped with its own accession number,
              barcode and book card.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              id="accessionNumber"
              label="Accession number"
              error={errorFor("accessionNumber")}
              hint="Unique across all three branches — copy it from the accession book."
            >
              <Input id="accessionNumber" placeholder="ACC-2026-0142" {...register("accessionNumber")} />
            </Field>

            <Field id="callNumber" label="Call number" error={errorFor("callNumber")} hint="Example: 004.18 DEL">
              <Input id="callNumber" placeholder="004.18 DEL" {...register("callNumber")} />
            </Field>

            <Field id="libraryId" label="Owning branch" error={errorFor("libraryId")}>
              <Select
                value={String(libraryId ?? "")}
                onValueChange={(value) => setValue("libraryId", Number(value), { shouldDirty: true })}
              >
                <SelectTrigger id="libraryId" className="w-full">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => {
                    const branded = LIBRARY_BRANCHES.find((item) => item.code === branch.code);
                    return (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branded?.name ?? branch.name} · {branch.code}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>

            <Field id="categoryId" label="Subject category" error={errorFor("categoryId")}>
              <Select
                value={categoryId === undefined ? NONE : String(categoryId)}
                onValueChange={(value) =>
                  setValue("categoryId", value === NONE ? undefined : Number(value), { shouldDirty: true })
                }
              >
                <SelectTrigger id="categoryId" className="w-full">
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Uncategorised</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {mode === "create" ? (
              <>
                <Field
                  id="copyCount"
                  label="Number of copies"
                  error={errorFor("copyCount")}
                  hint="0 accessiones the title only, for stock still on order."
                >
                  <Input
                    id="copyCount"
                    type="number"
                    min="0"
                    max="50"
                    {...register("copyCount", {
                      setValueAs: (value: unknown) => (value === "" || value == null ? 1 : Number(value)),
                    })}
                  />
                </Field>

                <Field
                  id="acquisitionPrice"
                  label="Acquisition price per copy (₱)"
                  error={errorFor("acquisitionPrice")}
                  hint="Feeds the inventory valuation report."
                >
                  <Input id="acquisitionPrice" type="number" step="0.01" min="0" placeholder="850.00" {...register("acquisitionPrice", optionalNumber)} />
                </Field>
              </>
            ) : (
              <p className="rounded-lg bg-secondary px-3 py-2.5 text-[11px] leading-relaxed text-ink-soft sm:col-span-2">
                Physical copies — barcode, shelf location, condition and status — are managed one row
                at a time in the copies table on this title&apos;s record page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-4 text-brand-500" /> Circulation
            </CardTitle>
            <CardDescription>
              The section decides the loan rules the desk applies to this title.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="section">Circulation section</Label>
              <Select
                value={section}
                onValueChange={(value) => setValue("section", value as CirculationSection, { shouldDirty: true })}
              >
                <SelectTrigger id="section" className="w-full">
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_ORDER.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {SECTION_META[slug].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errorFor("section") ? (
                <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <AlertCircle className="size-3" /> {errorFor("section")}
                </p>
              ) : null}
            </div>

            {meta ? (
              <div className="rounded-lg border border-brand-100 bg-parchment p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.hue}`}>{meta.group}</span>
                  <Badge variant={meta.borrowable ? "success" : "warning"}>
                    {meta.borrowable ? "Borrowable" : "Library use only"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">{meta.rule}</p>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5">
              <div className="min-w-0">
                <Label htmlFor="isPublished" className="cursor-pointer">
                  Published in the catalogue
                </Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Unpublished titles stay out of OPAC search and the new-arrivals shelf.
                </p>
              </div>
              <Switch
                id="isPublished"
                checked={isPublished === "true"}
                onCheckedChange={(checked) => setValue("isPublished", checked ? "true" : "false", { shouldDirty: true })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={action.pending}>
            {action.pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {mode === "create" ? "Accession title" : "Save changes"}
          </Button>
          {cancelHref ? (
            <Button variant="ghost" type="button" onClick={() => router.push(cancelHref)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
