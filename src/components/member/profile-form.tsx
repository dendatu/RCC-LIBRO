"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  BORROWER_TYPES,
  COLLEGE_PROGRAMS,
  EDUCATION_LEVELS,
  FACULTY_DEPARTMENTS,
  LEVEL_GROUPS,
  SENIOR_HIGH_TRACKS,
  classificationLabel,
  isCollegeLevel,
  isSeniorHighLevel,
  levelNeedsProgramme,
} from "@/lib/constants";
import { initials } from "@/lib/utils";
import { useFormAction } from "@/hooks/use-form-action";
import { updateProfile } from "@/server/actions/member";
import type {
  BorrowerType,
  CollegeProgram,
  EducationLevel,
  FacultyDepartment,
  SeniorHighTrack,
} from "@/lib/types";

const NONE = "none";

export interface ProfileFormInitial {
  fullName: string;
  contactNumber: string;
  borrowerType: BorrowerType | "";
  educationLevel: EducationLevel | "";
  seniorHighTrack: SeniorHighTrack | "";
  collegeProgram: CollegeProgram | "";
  facultyDepartment: FacultyDepartment | "";
  section: string;
  idNumber: string;
  sbtrNumber: string;
  enrollmentYear: string;
}

type Draft = ProfileFormInitial;

function Field({
  id,
  label,
  hint,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function EmptySelect({
  id,
  value,
  placeholder,
  onChange,
  children,
}: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not applicable</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}

export function ProfileForm({
  initial,
  avatarUrl,
  email,
  highlight = false,
}: {
  initial: ProfileFormInitial;
  avatarUrl: string | null;
  email: string;
  highlight?: boolean;
}) {
  const action = useFormAction(updateProfile);
  const [draft, setDraft] = useState<Draft>(initial);

  const errors = action.state?.errors ?? {};
  const isStudent = draft.borrowerType !== "faculty";
  const seniorHigh = isSeniorHighLevel(draft.educationLevel);
  const collegeYear = isCollegeLevel(draft.educationLevel);
  const needsProgram = levelNeedsProgramme(draft.educationLevel);
  const showProgram = isStudent && (!draft.educationLevel || needsProgram);
  // A college year is never a graduate-school seat, and vice versa.
  const programOptions = COLLEGE_PROGRAMS.filter((program) =>
    collegeYear ? program.value !== "graduate_school" : true,
  );

  function programmeFor(level: EducationLevel | "", program: CollegeProgram | ""): CollegeProgram | "" {
    if (level && !levelNeedsProgramme(level)) return "";
    if (isCollegeLevel(level) && program === "graduate_school") return "";
    return program;
  }

  const set = <Key extends keyof Draft>(key: Key) => (value: Draft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const preview = useMemo(
    () =>
      classificationLabel({
        borrower_type: draft.borrowerType || undefined,
        education_level: draft.educationLevel || undefined,
        senior_high_track: draft.seniorHighTrack || undefined,
        college_program: draft.collegeProgram || undefined,
        faculty_department: draft.facultyDepartment || undefined,
        section: draft.section || null,
      }),
    [draft],
  );

  useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) toast.success(action.state.message ?? "Profile saved.");
    else if (action.state.message) toast.error(action.state.message);
  }, [action.state]);

  const submit = () => {
    const payload: Record<string, unknown> = {
      fullName: draft.fullName,
      contactNumber: draft.contactNumber,
      borrowerType: draft.borrowerType,
      section: isStudent ? draft.section : "",
      idNumber: draft.idNumber,
      sbtrNumber: draft.sbtrNumber,
      enrollmentYear: draft.enrollmentYear,
    };
    if (isStudent) {
      if (draft.educationLevel) payload.educationLevel = draft.educationLevel;
      if (seniorHigh && draft.seniorHighTrack) payload.seniorHighTrack = draft.seniorHighTrack;
      if (draft.collegeProgram) payload.collegeProgram = draft.collegeProgram;
    } else if (draft.facultyDepartment) {
      payload.facultyDepartment = draft.facultyDepartment;
    }

    action.submit(payload);
  };

  return (
    <div className="space-y-6">
      {highlight ? (
        <Alert className="border-gold/40 bg-gold-soft/30 text-brand-900">
          <Sparkles className="size-4" />
          <AlertTitle>One step left: tell the library who you are</AlertTitle>
          <AlertDescription>
            Students need a level and an SBTR number; faculty need a department. The desk uses this
            to set your borrowing limit and branch access.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className={highlight ? "ring-2 ring-gold/60" : undefined}>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>
            Your e-mail is your sign-in identity and cannot be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-base font-semibold text-cream">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-14 object-cover" />
              ) : (
                initials(draft.fullName || email)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{draft.fullName || "Your full name"}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Google sign-in keeps this avatar in sync automatically.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="fullName"
              label="Full name"
              error={errors.fullName?.[0]}
              hint="As printed on your school ID"
            >
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                value={draft.fullName}
                onChange={(event) => set("fullName")(event.target.value)}
              />
            </Field>

            <Field
              id="contactNumber"
              label="Mobile number"
              optional
              error={errors.contactNumber?.[0]}
              hint="Used for overdue reminders only"
            >
              <Input
                id="contactNumber"
                name="contactNumber"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+63 9XX XXX XXXX"
                value={draft.contactNumber}
                onChange={(event) => set("contactNumber")(event.target.value)}
              />
            </Field>
          </div>

          <Separator />

          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-ink">Classification</h3>
              <Badge variant="secondary">{preview}</Badge>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="borrowerType"
                label="I am a"
                error={errors.borrowerType?.[0]}
                hint="Drives your loan limit and the tracer record"
              >
                <Select
                  value={draft.borrowerType || NONE}
                  onValueChange={(next) => {
                    const value = next === NONE ? "" : (next as BorrowerType);
                    setDraft((current) => ({
                      ...current,
                      borrowerType: value,
                      educationLevel: value === "faculty" ? "" : current.educationLevel,
                      collegeProgram: value === "faculty" ? "" : current.collegeProgram,
                      seniorHighTrack: value === "faculty" ? "" : current.seniorHighTrack,
                      facultyDepartment: value === "student" ? "" : current.facultyDepartment,
                    }));
                  }}
                >
                  <SelectTrigger id="borrowerType">
                    <SelectValue placeholder="Choose student or faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    {BORROWER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {isStudent ? (
                <Field
                  id="educationLevel"
                  label="Level"
                  optional
                  error={errors.educationLevel?.[0]}
                  hint="College and graduate learners pick a programme below"
                >
                  <EmptySelect
                    id="educationLevel"
                    value={draft.educationLevel}
                    placeholder="Select your level"
                    onChange={(value) => {
                      const level = (value || "") as EducationLevel | "";
                      setDraft((current) => ({
                        ...current,
                        educationLevel: level,
                        seniorHighTrack: isSeniorHighLevel(level) ? current.seniorHighTrack : "",
                        collegeProgram: programmeFor(level, current.collegeProgram),
                      }));
                    }}
                  >
                    {LEVEL_GROUPS.map((group) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {EDUCATION_LEVELS.filter((level) => level.group === group).map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </EmptySelect>
                </Field>
              ) : (
                <Field
                  id="facultyDepartment"
                  label="Department"
                  error={errors.facultyDepartment?.[0]}
                  hint="Faculty borrow against their department ID"
                >
                  <Select
                    value={draft.facultyDepartment || NONE}
                    onValueChange={(next) =>
                      set("facultyDepartment")((next === NONE ? "" : next) as FacultyDepartment | "")
                    }
                  >
                    <SelectTrigger id="facultyDepartment">
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not applicable</SelectItem>
                      {FACULTY_DEPARTMENTS.map((department) => (
                        <SelectItem key={department.value} value={department.value}>
                          {department.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {seniorHigh ? (
                <Field
                  id="seniorHighTrack"
                  label="Senior high track"
                  error={errors.seniorHighTrack?.[0]}
                  hint="Required for Grade 11 and 12"
                >
                  <Select
                    value={draft.seniorHighTrack || NONE}
                    onValueChange={(next) =>
                      set("seniorHighTrack")((next === NONE ? "" : next) as SeniorHighTrack | "")
                    }
                  >
                    <SelectTrigger id="seniorHighTrack">
                      <SelectValue placeholder="Select your track" />
                    </SelectTrigger>
                    <SelectContent>
                      {SENIOR_HIGH_TRACKS.map((track) => (
                        <SelectItem key={track.value} value={track.value}>
                          {track.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              {showProgram ? (
                <Field
                  id="collegeProgram"
                  label="Programme"
                  optional={!needsProgram}
                  error={errors.collegeProgram?.[0]}
                  hint={
                    collegeYear
                      ? "College members are classified by year and course"
                      : "Graduate School learners select the graduate programme"
                  }
                >
                  <EmptySelect
                    id="collegeProgram"
                    value={draft.collegeProgram}
                    placeholder="Select your programme"
                    onChange={(value) => set("collegeProgram")((value || "") as CollegeProgram | "")}
                  >
                    {programOptions.map((program) => (
                      <SelectItem key={program.value} value={program.value}>
                        {program.label}
                      </SelectItem>
                    ))}
                  </EmptySelect>
                </Field>
              ) : null}

              {isStudent ? (
                <Field id="section" label="Class section" optional error={errors.section?.[0]}>
                  <Input
                    id="section"
                    name="section"
                    placeholder="Grade 11 - Rizal"
                    value={draft.section}
                    onChange={(event) => set("section")(event.target.value)}
                  />
                </Field>
              ) : null}

              <Field
                id="sbtrNumber"
                label="SBTR number"
                optional
                error={errors.sbtrNumber?.[0]}
                hint="Printed on your tracer record, e.g. SBTR-A1B2C3D4"
              >
                <Input
                  id="sbtrNumber"
                  name="sbtrNumber"
                  placeholder="SBTR-XXXXXXXX"
                  value={draft.sbtrNumber}
                  onChange={(event) => set("sbtrNumber")(event.target.value)}
                />
              </Field>

              <Field
                id="idNumber"
                label="School ID number"
                optional
                error={errors.idNumber?.[0]}
              >
                <Input
                  id="idNumber"
                  name="idNumber"
                  placeholder="2026-00145"
                  value={draft.idNumber}
                  onChange={(event) => set("idNumber")(event.target.value)}
                />
              </Field>

              <Field
                id="enrollmentYear"
                label="Enrolment year"
                optional
                error={errors.enrollmentYear?.[0]}
              >
                <Input
                  id="enrollmentYear"
                  name="enrollmentYear"
                  type="number"
                  inputMode="numeric"
                  min={1990}
                  max={2100}
                  placeholder="2026"
                  value={draft.enrollmentYear}
                  onChange={(event) => set("enrollmentYear")(event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button type="button" size="lg" onClick={submit} disabled={action.pending}>
              {action.pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save profile
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setDraft(initial)}
              disabled={action.pending}
            >
              Discard changes
            </Button>
            {action.state?.ok ? (
              <p className="text-xs font-medium text-success">{action.state.message}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
