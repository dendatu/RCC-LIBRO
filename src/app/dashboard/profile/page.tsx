import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, IdCard, ScrollText, ShieldAlert, UserRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shell/page-header";
import { ProfileForm } from "@/components/member/profile-form";
import {
  BORROWER_TYPES,
  EDUCATION_LEVELS,
  POLICY,
  classificationLabel,
  labelFor,
} from "@/lib/constants";
import { formatDate, formatPeso } from "@/lib/utils";
import { isStaff, requireMember } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type {
  BorrowerType,
  CollegeProgram,
  EducationLevel,
  FacultyDepartment,
  SeniorHighTrack,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My profile",
  description: "Borrower classification, SBTR number and contact details.",
};

interface Eligibility {
  eligible?: boolean;
  reasons?: { code?: string; message?: string }[];
  active_loans?: number;
  borrowing_limit?: number;
  outstanding_fines?: number;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember();
  const params = await searchParams;
  const highlight = params.onboard === "1";

  const supabase = await createClient();
  const { data: eligibilityData } = await supabase.rpc("evaluate_borrow_eligibility", {
    p_user_id: member.user.id,
  });
  const eligibility = (eligibilityData ?? {}) as Eligibility;

  const profile = member.profile;
  const initial = {
    fullName: member.user.full_name ?? "",
    contactNumber: member.user.contact_number ?? "",
    borrowerType: (profile?.borrower_type ?? "") as BorrowerType | "",
    educationLevel: (profile?.education_level ?? "") as EducationLevel | "",
    seniorHighTrack: (profile?.senior_high_track ?? "") as SeniorHighTrack | "",
    collegeProgram: (profile?.college_program ?? "") as CollegeProgram | "",
    facultyDepartment: (profile?.faculty_department ?? "") as FacultyDepartment | "",
    section: profile?.section ?? "",
    idNumber: profile?.id_number ?? "",
    sbtrNumber: profile?.sbtr_number ?? "",
    enrollmentYear: profile?.enrollment_year ? String(profile.enrollment_year) : "",
  };

  const reasons = eligibility.reasons ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My library"
        title="My profile"
        description="The classification the circulation desk relies on: your level or department, your SBTR number and how to reach you."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/card">
                <IdCard className="size-4" />
                Library card
              </Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link href="/dashboard/sbtr">
                <ScrollText className="size-4" />
                My SBTR
              </Link>
            </Button>
          </>
        }
      />

      {!profile?.borrower_type ? (
        <Alert variant="warning">
          <ShieldAlert className="size-4" />
          <AlertTitle>Your record is incomplete</AlertTitle>
          <AlertDescription>
            Until a librarian can match your level or department, no loan can be released against
            your name.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ProfileForm
          initial={initial}
          avatarUrl={member.user.avatar_url}
          email={member.user.email}
          highlight={highlight}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Standing on record</CardTitle>
              <CardDescription>Read-only — maintained by the desk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Classification</span>
                <span className="text-right font-medium text-ink">
                  {classificationLabel(profile ?? {})}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Borrower type</span>
                <Badge variant="secondary">
                  {labelFor(BORROWER_TYPES, profile?.borrower_type ?? null)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Level</span>
                <span className="font-medium text-ink">
                  {labelFor(EDUCATION_LEVELS, profile?.education_level ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">SBTR number</span>
                <span className="font-mono text-ink">{profile?.sbtr_number ?? "not issued"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Card number</span>
                <span className="font-mono text-ink">{profile?.card_number ?? "not issued"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Loan limit</span>
                <span className="font-medium text-ink">
                  {member.record?.borrowing_limit ?? POLICY.maxBooks} books ·{" "}
                  {member.record?.loan_period_days ?? POLICY.loanDays} days
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Account status</span>
                <Badge variant={member.record?.status === "active" ? "success" : "warning"}>
                  {member.record?.status ?? "active"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Unsettled penalties</span>
                <span className="font-medium text-ink">
                  {formatPeso(member.record?.outstanding_fines ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Member since</span>
                <span className="text-ink">{formatDate(member.user.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Can I borrow right now?</CardTitle>
              <CardDescription>
                Checked live against the same rules the circulation desk sees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {eligibility.eligible ? (
                <p className="flex items-start gap-2 text-sm text-success">
                  <BadgeCheck className="mt-0.5 size-4" />
                  Yes — your record clears every requirement.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-ink-soft">
                  {reasons.length === 0 ? (
                    <li>Ask the desk to confirm your record before borrowing.</li>
                  ) : null}
                  {reasons.map((reason) => (
                    <li key={reason.code ?? reason.message} className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                      {reason.message}
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" size="sm" className="px-0">
                <Link href="/dashboard/borrowings">
                  See my open loans <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {isStaff(member) ? (
            <Card>
              <CardContent className="flex items-start gap-2 text-xs text-muted-foreground">
                <UserRound className="mt-0.5 size-4" />
                <p>
                  You are editing your own member record. Borrower administration, including card
                  and SBTR issue, lives under Borrower records.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
