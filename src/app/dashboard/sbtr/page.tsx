import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/circulation/status-pill";
import { SbtrPdfButton } from "@/components/circulation/pdf-download";
import { requireMember } from "@/lib/rbac";
import { librarianNames, sbtrEntries } from "@/server/data/member";
import { SECTION_META, classificationLabel } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My SBTR",
  description: "Your digital Student Book Tracer Record.",
};

export default async function SbtrPage() {
  const member = await requireMember();
  const profile = member.profile;
  const sbtrNumber = profile?.sbtr_number?.trim() ?? "";
  const isFaculty = profile?.borrower_type === "faculty";

  const info = {
    name: member.user.full_name,
    email: member.user.email,
    classification: classificationLabel(profile ?? {}),
    sbtr: sbtrNumber || null,
    card: profile?.card_number ?? null,
  };

  const [rows, librarianMap] = await Promise.all([
    sbtrEntries(member.user.id),
    librarianNames(member.user.id),
  ]);

  const pdfRows = rows.map((row) => ({
    title: row.book_title,
    accession_number: row.accession_number,
    date_borrowed: row.date_borrowed,
    due_date: row.due_date,
    date_returned: row.date_returned,
    librarian: librarianMap[row.id] ?? "Circulation desk",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My library"
        title="Student Book Tracer Record"
        description="The digital copy of your tracer record — every title issued under your name, with dates and the desk that recorded it."
        actions={
          rows.length > 0 ? <SbtrPdfButton info={info} rows={pdfRows} /> : null
        }
      />

      <div className="surface-card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Student</p>
            <p className="mt-0.5 font-serif text-lg text-ink">{member.user.full_name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact</p>
            <p className="mt-0.5 text-sm text-ink">{member.user.contact_number ?? "Not recorded"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">E-mail</p>
            <p className="mt-0.5 break-all text-sm text-ink">{member.user.email}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Department / classification</p>
            <p className="mt-0.5 text-sm text-ink">{info.classification}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">SBTR number</p>
            <p className="mt-0.5 font-mono text-sm text-ink">{sbtrNumber || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Library card</p>
            <p className="mt-0.5 font-mono text-sm text-ink">{profile?.card_number ?? "—"}</p>
          </div>
        </div>
      </div>

      {!sbtrNumber ? (
        isFaculty ? (
          <Alert variant="info">
            <AlertDescription>
              Faculty borrow against their department ID, so a Student Book Tracer number is not required — this
              page still lists every title issued to you. Add a department in{" "}
              <Link href="/dashboard/profile" className="font-medium underline underline-offset-4">
                My profile
              </Link>{" "}
              to keep the record accurate.
            </AlertDescription>
          </Alert>
        ) : (
          <EmptyState
            icon={<ScrollText className="size-7" />}
            title="No SBTR number on your card"
            description="Students must hold an active Student Book Tracer Record before the desk can release loans. Ask a librarian to issue your SBTR, then add the number to your profile."
            action={
              <Button asChild variant="gold">
                <Link href="/dashboard/profile?onboard=1">Add my SBTR number</Link>
              </Button>
            }
          />
        )
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-7" />}
          title="No tracer entries yet"
          description="Once the circulation desk issues a book to you, it appears here and on your downloadable SBTR."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/catalog">Browse the catalogue</Link>
            </Button>
          }
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Book title</th>
                <th className="px-4 py-3 font-semibold">Accession</th>
                <th className="px-4 py-3 font-semibold">Borrowed</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Returned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, index) => (
                <tr key={row.id} className="align-top transition-colors hover:bg-muted/60">
                  <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                  <td className="px-4 py-3">
                    <p className="max-w-[18rem] truncate font-medium text-ink">{row.book_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.book_author} · {SECTION_META[row.section]?.label ?? row.library_name}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.accession_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.date_borrowed)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.due_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.date_returned ? (
                      formatDate(row.date_returned)
                    ) : (
                      <span className="flex flex-wrap items-center gap-1">
                        <StatusPill status={row.status} />
                        <span className="text-xs text-muted-foreground">Not returned</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{rows.length} tracer row(s)</Badge>
          <span>The paper tracer record remains the property of the library.</span>
        </div>
      ) : null}
    </div>
  );
}
