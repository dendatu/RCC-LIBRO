import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, Hourglass, ScanBarcode } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ReservationQueue } from "@/components/circulation/reservation-queue";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { requireRole } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { listReservationQueue } from "@/server/data/circulation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservation queue",
  description: "Titles borrowers are waiting for, the hold shelf, and issuing a reserved copy.",
};

export default async function RequestsPage() {
  await requireRole("librarian", "admin");
  const rows = await listReservationQueue();

  const ready = rows.filter((row) => row.status === "ready");
  const waiting = rows.filter((row) => row.status === "waiting");
  const expired = ready.filter((row) => row.held_until && new Date(row.held_until).getTime() < Date.now());
  const blocked = rows.filter((row) => !row.copy_barcode);
  const nextExpiry = ready
    .map((row) => row.held_until)
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Circulation desk"
        title="Reservation queue"
        description="Every title on hold, grouped by title and ordered by queue position. Put a copy on the hold shelf, release a hold, or walk the borrower straight to the issue desk."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/catalog">
              <BookMarked className="size-4" /> Catalogue
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Waiting"
          value={waiting.length}
          hint="No copy released yet"
          icon={<Hourglass className="size-4" />}
        />
        <StatTile
          label="On the hold shelf"
          value={ready.length}
          tone={ready.length ? "success" : "default"}
          hint={nextExpiry ? `Next expiry ${formatDate(nextExpiry)}` : "Nothing reserved for collection"}
        />
        <StatTile
          label="Expired holds"
          value={expired.length}
          tone={expired.length ? "danger" : "default"}
          hint="Past the collection date — issue or release"
        />
        <StatTile
          label="No copy to hand"
          value={blocked.length}
          tone={blocked.length ? "warning" : "default"}
          hint="Queue entries with nothing available to issue"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          “Issue to holder” opens the circulation desk with the copy barcode and the borrower already
          loaded.
        </span>
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/circulation">
            <ScanBarcode className="size-3.5" /> Issue desk
          </Link>
        </Button>
      </div>

      <ReservationQueue rows={rows} />
    </div>
  );
}
