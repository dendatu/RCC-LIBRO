"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle, Loader2, Save, Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCatalogFormAction } from "./catalog-action-hook";
import { SECTION_META, SECTION_ORDER } from "@/lib/constants";
import { bookSchema } from "@/lib/validators";
import { createBook, updateBook } from "@/server/actions/catalog";
import type { BookCategory, CirculationSection, Library } from "@/lib/types";

export type BookFormValues = {
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

const NONE = "none";

function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
          <AlertCircle className="size-3" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function BookForm({
  mode,
  bookId,
  defaults,
  libraries,
  categories,
}: {
  mode: "create" | "edit";
  bookId?: string;
  defaults: Partial<BookFormValues>;
  libraries: Pick<Library, "id" | "code" | "name">[];
  categories: BookCategory[];
}) {
  const createAction = useCatalogFormAction(createBook);
  const updateAction = useCatalogFormAction(updateBook);
  const action = mode === "create" ? createAction : updateAction;
  const [serverIssues, setServerIssues] = useState<Record<string, string[]>>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookFormValues>({
    // The catalogue schema coerces numbers and flattens a checkbox string,
    // so its inferred input shape differs from the controlled field values.
    resolver: zodResolver(bookSchema) as unknown as Resolver<BookFormValues>,
    defaultValues: {
      accessionNumber: "",
      callNumber: "",
      isbn: "",
      title: "",
      author: "",
      subject: "",
      publisher: "",
      edition: "",
      language: "English",
      description: "",
      coverImageUrl: "",
      copyCount: 1,
      isPublished: "true",
      libraryId: Number(libraries[0]?.id ?? 0),
      ...defaults,
    },
  });

  useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) {
      toast.success(action.state.message ?? "Catalogue record saved.");
    } else {
      toast.error(action.state.message ?? "Please review the form.");
      setServerIssues(action.state.errors ?? {});
    }
  }, [action.state]);

  const section = watch("section");
  const categoryId = watch("categoryId");
  const libraryId = watch("libraryId");
  const meta = SECTION_META[section];

  const errorFor = (name: keyof BookFormValues) =>
    errors[name]?.message ?? serverIssues[name]?.[0];

  const submit = handleSubmit((values) => {
    const payload: Record<string, unknown> = { ...values };
    if (values.categoryId === undefined || String(categoryId) === NONE) delete payload.categoryId;
    if (values.publicationYear === undefined) delete payload.publicationYear;
    if (values.acquisitionPrice === undefined) delete payload.acquisitionPrice;
    if (bookId) payload.id = bookId;
    void action.submit(payload);
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      {action.state && !action.state.ok && !Object.keys(serverIssues).length ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{action.state.message ?? "The record could not be saved."}</AlertTitle>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Accession details</CardTitle>
              <CardDescription>
                Recorded in the accession book. Accession numbers are unique across all three
                branches and may never be reused.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                id="accessionNumber"
                label="Accession number"
                error={errorFor("accessionNumber")}
                hint="Example: ACC-2026-0142"
              >
                <Input id="accessionNumber" placeholder="ACC-2026-0142" {...register("accessionNumber")} />
              </Field>

              <Field
                id="callNumber"
                label="Call number"
                error={errorFor("callNumber")}
                hint="Example: 004.18 PRE"
              >
                <Input id="callNumber" placeholder="004.18 PRE" {...register("callNumber")} />
              </Field>

              <Field
                id="isbn"
                label="ISBN"
                error={errorFor("isbn")}
                hint="ISBN-10 or ISBN-13, dashes allowed"
                className="sm:col-span-2"
              >
                <Input id="isbn" placeholder="978-0-13-595705-9" {...register("isbn")} />
              </Field>

              <Field id="title" label="Title" error={errorFor("title")} className="sm:col-span-2">
                <Input id="title" placeholder="Automated Library Circulation Using QR Codes" {...register("title")} />
              </Field>

              <Field id="author" label="Author" error={errorFor("author")}>
                <Input id="author" placeholder="RCC BSIT Research Group" {...register("author")} />
              </Field>

              <Field id="subject" label="Subject heading" error={errorFor("subject")}>
                <Input id="subject" placeholder="Information Technology" {...register("subject")} />
              </Field>

              <Field id="publisher" label="Publisher" error={errorFor("publisher")}>
                <Input id="publisher" placeholder="Republic Central Colleges" {...register("publisher")} />
              </Field>

              <Field id="edition" label="Edition" error={errorFor("edition")}>
                <Input id="edition" placeholder="5th edition" {...register("edition")} />
              </Field>

              <Field id="publicationYear" label="Publication year" error={errorFor("publicationYear")}>
                <Input
                  id="publicationYear"
                  type="number"
                  inputMode="numeric"
                  placeholder="2026"
                  {...register("publicationYear", {
                    setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                  })}
                />
              </Field>

              <Field id="language" label="Language" error={errorFor("language")}>
                <Input id="language" placeholder="English" {...register("language")} />
              </Field>

              <Field
                id="acquisitionPrice"
                label="Acquisition price per copy (PHP)"
                error={errorFor("acquisitionPrice")}
                hint="Used for the inventory valuation report"
              >
                <Input
                  id="acquisitionPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="850.00"
                  {...register("acquisitionPrice", {
                    setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                  })}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shelving and classification</CardTitle>
              <CardDescription>
                The section decides the loan rules applied at the circulation desk.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="libraryId" label="Owning branch" error={errorFor("libraryId")}>
                <Select
                  value={String(libraryId ?? "")}
                  onValueChange={(value) => setValue("libraryId", Number(value), { shouldDirty: true })}
                >
                  <SelectTrigger id="libraryId" className="w-full">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {libraries.map((library) => (
                      <SelectItem key={library.id} value={String(library.id)}>
                        {library.name} · {library.code}
                      </SelectItem>
                    ))}
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

              <Field id="section" label="Circulation section" error={errorFor("section")} className="sm:col-span-2">
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
                {meta ? (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-[11px] text-ink-soft">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
                    {meta.rule}
                  </p>
                ) : null}
              </Field>

              <Field
                id="description"
                label="Annotation"
                error={errorFor("description")}
                hint="Appears on the public catalogue card."
                className="sm:col-span-2"
              >
                <Textarea id="description" rows={3} placeholder="Short annotation for the OPAC card." {...register("description")} />
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{mode === "create" ? "Physical copies" : "Publication state"}</CardTitle>
              <CardDescription>
                {mode === "create"
                  ? "Each copy receives its own accession number, barcode and book card."
                  : "Copies are managed from the inventory table on the title page."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "create" ? (
                <Field id="copyCount" label="Number of copies" error={errorFor("copyCount")} hint="0 registers the title only, for yet-to-arrive stock.">
                  <Input
                    id="copyCount"
                    type="number"
                    min="0"
                    max="50"
                    {...register("copyCount", {
                      setValueAs: (value) => (value === "" || value === null ? 1 : Number(value)),
                    })}
                  />
                </Field>
              ) : null}

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5">
                <div>
                  <Label htmlFor="isPublished" className="cursor-pointer text-ink">
                    Published in OPAC
                  </Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Unpublish to hide from borrowers while processing.
                  </p>
                </div>
                <Switch
                  id="isPublished"
                  checked={watch("isPublished") === "true"}
                  onCheckedChange={(checked) =>
                    setValue("isPublished", checked ? "true" : "false", { shouldDirty: true })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Save record</CardTitle>
              <CardDescription>
                Every change is written to the audit trail with your name and the accession number.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="submit" className="w-full" disabled={action.pending}>
                {action.pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {mode === "create" ? "Accession title" : "Save changes"}
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link href={bookId ? `/dashboard/catalog/${bookId}` : "/dashboard/catalog"}>Cancel</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
