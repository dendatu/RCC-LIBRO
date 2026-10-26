"use client";

import * as React from "react";
import { Loader2, Save, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormAction } from "@/hooks/use-form-action";
import {
  BORROWER_TYPES,
  COLLEGE_PROGRAMS,
  EDUCATION_LEVELS,
  FACULTY_DEPARTMENTS,
  SENIOR_HIGH_TRACKS,
  isSeniorHighLevel,
  labelFor,
} from "@/lib/constants";
import { formatPeso } from "@/lib/utils";
import { updateBorrowerRecord } from "@/server/actions/circulation";
import type {
  AccountStatus,
  BorrowerType,
  CollegeProgram,
  EducationLevel,
  FacultyDepartment,
  SeniorHighTrack,
} from "@/lib/types";
import type { MemberRow } from "@/server/data/circulation";

const STANDING: { value: AccountStatus; label: string }[] = [
  { value: "active", label: "Active — may borrow" },
  { value: "suspended", label: "Suspended — held at the desk" },
  { value: "graduated", label: "Graduated — privileges closed" },
  { value: "inactive", label: "Inactive — not borrowing" },
];

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error?.length ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      {error?.length ? <p className="text-xs text-destructive">{error.join(" ")}</p> : null}
    </div>
  );
}

/**
 * Staff edit of a borrower record: classification, SBTR number, borrowing
 * entitlement and account status. Written through `updateBorrowerRecord`, which
 * validates against the same schemas the registration form uses and logs the
 * change in the audit trail.
 */
export function MemberEditor({ member }: { member: MemberRow }) {
  const action = useFormAction(updateBorrowerRecord);
  const errors = action.state?.errors ?? {};

  const [fullName, setFullName] = React.useState(member.full_name);
  const [contactNumber, setContactNumber] = React.useState(member.contact_number ?? "");
  const [borrowerType, setBorrowerType] = React.useState<BorrowerType>(
    member.profile?.borrower_type ?? "student",
  );
  const [educationLevel, setEducationLevel] = React.useState<EducationLevel | "">(
    member.profile?.education_level ?? "",
  );
  const [seniorHighTrack, setSeniorHighTrack] = React.useState<SeniorHighTrack | "">(
    member.profile?.senior_high_track ?? "",
  );
  const [collegeProgram, setCollegeProgram] = React.useState<CollegeProgram | "">(
    member.profile?.college_program ?? "",
  );
  const [facultyDepartment, setFacultyDepartment] = React.useState<FacultyDepartment | "">(
    member.profile?.faculty_department ?? "",
  );
  const [section, setSection] = React.useState(member.profile?.section ?? "");
  const [idNumber, setIdNumber] = React.useState(member.profile?.id_number ?? "");
  const [sbtrNumber, setSbtrNumber] = React.useState(member.profile?.sbtr_number ?? "");
  const [enrollmentYear, setEnrollmentYear] = React.useState(
    member.profile?.enrollment_year ? String(member.profile.enrollment_year) : "",
  );
  const [borrowingLimit, setBorrowingLimit] = React.useState(String(member.record?.borrowing_limit ?? 3));
  const [standing, setStanding] = React.useState<AccountStatus>(member.standing);
  const [isActive, setIsActive] = React.useState(member.is_active);

  React.useEffect(() => {
    if (action.state?.ok) toast.success(action.state.message ?? "Borrower record updated.");
  }, [action.state]);

  const isStudent = borrowerType === "student";
  const isSeniorHigh = isSeniorHighLevel(educationLevel);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    action.submit({
      userId: member.user_id,
      fullName,
      contactNumber,
      borrowerType,
      educationLevel: isStudent ? educationLevel : "",
      seniorHighTrack: isStudent && isSeniorHigh ? seniorHighTrack : "",
      collegeProgram: isStudent ? collegeProgram : "",
      facultyDepartment: isStudent ? "" : facultyDepartment,
      section: isStudent ? section : "",
      idNumber,
      sbtrNumber: isStudent ? sbtrNumber : "",
      enrollmentYear,
      borrowingLimit,
      status: standing,
      isActive,
    });
  };

  return (
    <form onSubmit={submit} className="surface-card space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-100 text-brand-700">
          <UserCog className="size-5" />
        </span>
        <div>
          <h2 className="font-serif text-lg text-ink">Edit borrower record</h2>
          <p className="text-xs text-ink-soft">
            {member.active_loans} loan(s) out · {formatPeso(member.outstanding_fines)} outstanding ·
            standing {member.standing}
          </p>
        </div>
      </div>

      {action.state && !action.state.ok ? (
        <Alert variant="destructive">
          <AlertTitle>The record was not saved</AlertTitle>
          <AlertDescription>{action.state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fullName" label="Full name" error={errors.fullName}>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={160}
            autoComplete="off"
          />
        </Field>
        <Field id="contactNumber" label="Contact number" error={errors.contactNumber}>
          <Input
            id="contactNumber"
            value={contactNumber}
            onChange={(event) => setContactNumber(event.target.value)}
            inputMode="tel"
            placeholder="+63 9XX XXX XXXX"
            maxLength={24}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="borrowerType" label="Borrower type" error={errors.borrowerType}>
          <Select value={borrowerType} onValueChange={(value) => setBorrowerType(value as BorrowerType)}>
            <SelectTrigger id="borrowerType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BORROWER_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {isStudent ? (
          <Field
            id="educationLevel"
            label="Level"
            error={errors.educationLevel}
            hint="Drives the loan rule the desk quotes; college and graduate learners also pick a programme."
          >
            <Select
              value={educationLevel || undefined}
              onValueChange={(value) => setEducationLevel(value as EducationLevel)}
            >
              <SelectTrigger id="educationLevel">
                <SelectValue placeholder="Select a level" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {EDUCATION_LEVELS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field id="facultyDepartment" label="Department" error={errors.facultyDepartment}>
            <Select
              value={facultyDepartment || undefined}
              onValueChange={(value) => setFacultyDepartment(value as FacultyDepartment)}
            >
              <SelectTrigger id="facultyDepartment">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {FACULTY_DEPARTMENTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {isStudent ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {isSeniorHigh ? (
            <Field id="seniorHighTrack" label="Senior high track" error={errors.seniorHighTrack}>
              <Select
                value={seniorHighTrack || undefined}
                onValueChange={(value) => setSeniorHighTrack(value as SeniorHighTrack)}
              >
                <SelectTrigger id="seniorHighTrack">
                  <SelectValue placeholder="Select a track" />
                </SelectTrigger>
                <SelectContent>
                  {SENIOR_HIGH_TRACKS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field id="collegeProgram" label="Programme" error={errors.collegeProgram}>
            <Select
              value={collegeProgram || undefined}
              onValueChange={(value) => setCollegeProgram(value as CollegeProgram)}
            >
              <SelectTrigger id="collegeProgram">
                <SelectValue placeholder={labelFor(COLLEGE_PROGRAMS, collegeProgram || null)} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {COLLEGE_PROGRAMS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="section" label="Class / section" error={errors.section}>
            <Input
              id="section"
              value={section}
              onChange={(event) => setSection(event.target.value)}
              maxLength={32}
              placeholder="e.g. 12-C"
            />
          </Field>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="sbtrNumber"
          label="SBTR number"
          error={errors.sbtrNumber}
          hint="Students need an active SBTR before a loan is released."
        >
          <Input
            id="sbtrNumber"
            value={sbtrNumber}
            onChange={(event) => setSbtrNumber(event.target.value)}
            maxLength={32}
            placeholder="SBTR-2026-0001"
            disabled={!isStudent}
          />
        </Field>
        <Field id="idNumber" label="ID number" error={errors.idNumber}>
          <Input
            id="idNumber"
            value={idNumber}
            onChange={(event) => setIdNumber(event.target.value)}
            maxLength={32}
            placeholder="Faculty / staff ID"
          />
        </Field>
        <Field id="enrollmentYear" label="Enrolment year" error={errors.enrollmentYear}>
          <Input
            id="enrollmentYear"
            value={enrollmentYear}
            onChange={(event) => setEnrollmentYear(event.target.value)}
            inputMode="numeric"
            placeholder="2026"
            maxLength={4}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="borrowingLimit"
          label="Borrowing limit"
          error={errors.borrowingLimit}
          hint="Policy default is three titles; raise it only with the head librarian's approval."
        >
          <Input
            id="borrowingLimit"
            value={borrowingLimit}
            onChange={(event) => setBorrowingLimit(event.target.value)}
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
          />
        </Field>

        <Field id="standing" label="Record standing" error={errors.status}>
          <Select value={standing} onValueChange={(value) => setStanding(value as AccountStatus)}>
            <SelectTrigger id="standing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STANDING.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="space-y-2">
          <Label>Account access</Label>
          <label
            htmlFor="isActive"
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 hover:border-brand-300"
          >
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <span className="text-sm text-ink">
              {isActive ? "Account may sign in and borrow" : "Account disabled at the desk"}
            </span>
          </label>
          {member.is_blocked ? (
            <p className="text-[11px] text-destructive">
              Held at the desk by policy: {member.record?.block_reason ?? "unresolved penalties"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={action.pending}>
          {action.pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save borrower record
        </Button>
        {action.state?.ok ? (
          <p className="text-sm text-success" role="status">
            {action.state.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Roles are managed in the admin console — this form never changes them.
          </p>
        )}
      </div>
    </form>
  );
}
