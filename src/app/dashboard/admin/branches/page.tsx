import type { Metadata } from "next";
import { Building2, FolderTree, Library, Tags } from "lucide-react";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { LibraryDialog } from "@/components/admin/library-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INSTITUTION } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";
import { formatNumber } from "@/lib/utils";
import {
  getCollectionCounts,
  listCategories,
  listLibraries,
} from "@/server/data/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Branches and categories",
  description:
    "Manage the RCC library branches and the subject taxonomy that organises every catalogue record.",
};

export default async function BranchesPage() {
  await requireRole("admin");

  const [libraries, categories, counts] = await Promise.all([
    listLibraries(),
    listCategories(),
    getCollectionCounts(),
  ]);

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Branches and subject categories"
        description={`The three branches of ${INSTITUTION} each own their own holdings, desk and usage figures. Categories drive catalogue filters, the OPAC browse list and the subject mix in analytics.`}
        actions={
          <>
            <Badge variant="secondary" className="gap-1.5">
              <Building2 className="size-3.5" />
              {formatNumber(libraries.length)} branch(es)
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              <Tags className="size-3.5" />
              {formatNumber(categories.length)} categories
            </Badge>
          </>
        }
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Library branches</CardTitle>
            <CardDescription>
              Branch codes are the prefix used on call numbers, and the value printed on receipts.
              Deactivating a branch hides it from the catalogue without touching its titles.
            </CardDescription>
          </div>
          <LibraryDialog triggerLabel="Add branch" />
        </CardHeader>
        <CardContent>
          {libraries.length === 0 ? (
            <EmptyState
              icon={<Library className="size-7" />}
              title="No branch registered yet"
              description="Add the Elementary, High School and College & Graduate School libraries before cataloguing titles."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Code</TableHead>
                  <TableHead scope="col">Branch</TableHead>
                  <TableHead scope="col">Contact</TableHead>
                  <TableHead scope="col" className="text-right">
                    Titles
                  </TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">
                    Edit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {libraries.map((library) => (
                  <TableRow key={library.id}>
                    <TableCell className="font-mono text-xs font-semibold text-brand-700">
                      {library.code}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-ink">{library.name}</p>
                      {library.description ? (
                        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                          {library.description}
                        </p>
                      ) : null}
                      {library.address ? (
                        <p className="text-xs text-muted-foreground">{library.address}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <p>{library.contact_number ?? "—"}</p>
                      <p className="truncate">{library.email ?? "—"}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(counts.booksByLibrary[String(library.id)] ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={library.is_active ? "success" : "outline"}>
                        {library.is_active ? "Open" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <LibraryDialog
                        triggerLabel="Edit branch"
                        library={{
                          libraryId: library.id,
                          code: library.code,
                          name: library.name,
                          description: library.description ?? "",
                          address: library.address ?? "",
                          contactNumber: library.contact_number ?? "",
                          email: library.email ?? "",
                          isActive: library.is_active,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Subject categories</CardTitle>
            <CardDescription>
              A category can sit under a parent to build the hierarchy readers browse in the OPAC.
              Slugs appear in catalogue URLs, so change them only when a title is not yet in use.
            </CardDescription>
          </div>
          <CategoryDialog
            triggerLabel="Add category"
            options={categories.map((category) => ({ id: category.id, name: category.name }))}
          />
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={<FolderTree className="size-7" />}
              title="No subject category yet"
              description="Categories are required before a title can be shelved by subject."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Category</TableHead>
                  <TableHead scope="col">Slug</TableHead>
                  <TableHead scope="col">Parent</TableHead>
                  <TableHead scope="col" className="text-right">
                    Titles
                  </TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="text-right">
                    Edit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <p className="font-medium text-ink">{category.name}</p>
                      {category.description ? (
                        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                          {category.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {category.slug}
                    </TableCell>
                    <TableCell className="text-sm text-ink-soft">
                      {category.parent_id ? (categoryNames.get(category.parent_id) ?? "—") : "Top level"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(counts.booksByCategory[String(category.id)] ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.is_active ? "success" : "outline"}>
                        {category.is_active ? "Visible" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <CategoryDialog
                        triggerLabel="Edit category"
                        options={categories.map((item) => ({ id: item.id, name: item.name }))}
                        category={{
                          categoryId: category.id,
                          name: category.name,
                          slug: category.slug,
                          description: category.description ?? "",
                          parentId: category.parent_id ?? undefined,
                          isActive: category.is_active,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
