import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";
import { BookForm, type BookFormValues } from "@/components/catalog/book-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { requireRole } from "@/lib/rbac";
import { getBook, listCategories, listLibraries } from "@/server/data/catalog";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit catalogue record | RCC LIBRO",
  description:
    "Amend an accessioned title: call number, classification, section and publication details.",
};

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("librarian", "admin");
  const { id } = await params;

  const book = await getBook(id);
  if (!book) notFound();

  const [libraries, categories] = await Promise.all([listLibraries(), listCategories()]);

  const defaults: Partial<BookFormValues> = {
    accessionNumber: book.accession_number,
    callNumber: book.call_number,
    isbn: book.isbn ?? "",
    title: book.title,
    author: book.author,
    subject: book.subject ?? "",
    publisher: book.publisher ?? "",
    publicationYear: book.publication_year ?? undefined,
    edition: book.edition ?? "",
    language: book.language,
    categoryId: book.category_id ?? undefined,
    libraryId: book.library_id,
    section: book.section,
    description: book.description ?? "",
    coverImageUrl: book.cover_image_url ?? "",
    isPublished: book.is_published ? "true" : "false",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Collection management"
        title={`Edit ${book.title}`}
        description="Changing the title, author or call number is mirrored on every book card issued for this title. Accession numbers stay unique."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/catalog/${book.id}`}>
                <ArrowLeft className="size-4" /> Back to record
              </Link>
            </Button>
            <Button variant="gold" asChild>
              <Link href={`/dashboard/qr?book=${book.id}`}>
                <QrCode className="size-4" /> QR labels
              </Link>
            </Button>
          </>
        }
      />

      <BookForm
        mode="edit"
        bookId={book.id}
        defaults={defaults}
        libraries={libraries}
        categories={categories}
      />
    </div>
  );
}
