import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookAccessionForm } from "@/components/catalog/book-accession-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { requireRole } from "@/lib/rbac";
import { listCategories, listLibraries } from "@/server/data/catalog";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accession a new title | RCC LIBRO",
  description:
    "Register a book in the accession book: catalogue record, call number, circulation section and physical copies with QR book cards.",
};

export default async function NewBookPage() {
  await requireRole("librarian", "admin");
  const [libraries, categories] = await Promise.all([listLibraries(), listCategories()]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Collection management"
        title="Accession a new title"
        description="Enter the details exactly as they appear in the accession book. Each copy you register gets its own sub-accession number, barcode and printable QR book card."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/catalog">
              <ArrowLeft className="size-4" /> Back to catalogue
            </Link>
          </Button>
        }
      />

      <Alert variant="info">
        <AlertTitle>Before you start</AlertTitle>
        <AlertDescription>
          Accession numbers are unique for the whole system and are never reused, even after a book
          is withdrawn. Have the book’s title page, copyright page and receipt ready so the publisher,
          publication year and PHP acquisition price are recorded correctly.
        </AlertDescription>
      </Alert>

      <BookAccessionForm
        mode="create"
        branches={libraries}
        categories={categories}
        cancelHref="/dashboard/catalog"
      />
    </div>
  );
}
