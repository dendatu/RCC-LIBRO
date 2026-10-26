"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleSlash, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BORROWER_TYPES,
  COLLEGE_PROGRAMS,
  EDUCATION_LEVELS,
  FACULTY_DEPARTMENTS,
  ROLE_LABEL,
  SENIOR_HIGH_TRACKS,
  classificationLabel,
  isSeniorHighLevel,
  levelNeedsProgramme,
} from "@/lib/constants";
import { formatDate, formatPeso } from "@/lib/utils";
import { useFormAction } from "@/hooks/use-form-action";
import {
  setUserActive,
  updateMemberClassification,
  updateUserRole,
} from "@/server/actions/admin";
import type { BorrowerRecord, MemberProfile, RoleSlug } from "@/lib/types";

const ROLES: RoleSlug[] = ["borrower", "librarian", "admin"];
const NONE = "__none__";

export interface UserRowData {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  roles: RoleSlug[];
  profile: MemberProfile | null;
  record: BorrowerRecord | null;
}

function primaryRoleOf(roles: RoleSlug[]): RoleSlug {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("librarian")) return "librarian";
  return "borrower";
}

function ErrorText({
  errors,
  name,
}: {
  errors?: Record<string, string[]>;
  name: string;
}) {
  const message = errors?.[name]?.[0];
  if (!message) return null;
  return (
    <p className="mt-1 text-[11px] font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

export function UserManageDialog({
  user,
  currentUserId,
}: {
  user: UserRowData;
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isSelf = user.id === currentUserId;
  const currentRole = primaryRoleOf(user.roles);

  const [pendingRole, setPendingRole] = useState<RoleSlug>(currentRole);
  const [borrowerType, setBorrowerType] = useState<string>(user.profile?.borrower_type ?? "student");
  const [level, setLevel] = useState<string>(user.profile?.education_level ?? NONE);
  const [track, setTrack] = useState<string>(user.profile?.senior_high_track ?? NONE);
  const [program, setProgram] = useState<string>(user.profile?.college_program ?? NONE);
  const [department, setDepartment] = useState<string>(user.profile?.faculty_department ?? NONE);
  const [sbtr, setSbtr] = useState<string>(user.profile?.sbtr_number ?? "");
  const [limit, setLimit] = useState<string>(
    user.record ? String(user.record.borrowing_limit) : "",
  );

  const role = useFormAction(updateUserRole);
  const active = useFormAction(setUserActive);
  const member = useFormAction(updateMemberClassification);
  const busy = role.pending || active.pending || member.pending;

  const succeeded = Boolean(role.state?.ok) || Boolean(active.state?.ok) || Boolean(member.state?.ok);
  useEffect(() => {
    if (!succeeded) return;
    const message =
      member.state?.ok && member.state.message
        ? member.state.message
        : role.state?.ok && role.state.message
          ? role.state.message
          : (active.state?.message ?? "Saved");
    toast.success(message);
    setOpen(false);
    router.refresh();
  }, [succeeded, router, member.state, role.state, active.state]);

  const isSeniorHigh = isSeniorHighLevel(level);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) {
          role.reset();
          active.reset();
          member.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Manage ${user.full_name}`}>
          <UserCog />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage {user.full_name}</DialogTitle>
          <DialogDescription>
            {user.email} · member since {formatDate(user.created_at)} ·{" "}
            {classificationLabel(user.profile ?? {})}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={currentRole === "admin" ? "default" : "secondary"}>
            <ShieldCheck className="size-3" />
            {ROLE_LABEL[currentRole]}
          </Badge>
          {user.roles
            .filter((slug) => slug !== currentRole)
            .map((slug) => (
              <Badge key={slug} variant="outline">
                Also {ROLE_LABEL[slug]}
              </Badge>
            ))}
          <Badge variant={user.is_active ? "success" : "destructive"}>
            {user.is_active ? "Active" : "Deactivated"}
          </Badge>
          {user.record?.is_blocked ? (
            <Badge variant="warning">
              <CircleSlash className="size-3" />
              Held at desk
            </Badge>
          ) : null}
        </div>

        <Tabs defaultValue="access">
          <TabsList aria-label="Administrative controls">
            <TabsTrigger value="access">Role &amp; access</TabsTrigger>
            <TabsTrigger value="member">Classification</TabsTrigger>
            <TabsTrigger value="standing">Standing</TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="space-y-4 pt-3">
            <div>
              <Label htmlFor={`role-${user.id}`}>Role</Label>
              <Select
                value={pendingRole}
                onValueChange={(value) => setPendingRole(value as RoleSlug)}
                disabled={isSelf || busy}
              >
                <SelectTrigger id={`role-${user.id}`} className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {ROLE_LABEL[slug]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Replacing the role revokes the previous one immediately: librarians run the desk,
                catalogue and reports; administrators additionally manage users, policy and the
                audit trail.
              </p>
              <ErrorText errors={role.state?.errors} name="role" />
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy || isSelf || pendingRole === currentRole}
                  onClick={() =>
                    role.submit(
                      { userId: user.id, role: pendingRole },
                      { targetName: user.full_name, previousRole: currentRole },
                    )
                  }
                >
                  {role.pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  Save role
                </Button>
                {isSelf ? (
                  <span className="text-[11px] font-medium text-warning">
                    You cannot demote your own account.
                  </span>
                ) : null}
              </div>
              {role.state && !role.state.ok && role.state.message ? (
                <Alert className="mt-3" variant="destructive">
                  <AlertTitle>Role not changed</AlertTitle>
                  <AlertDescription>{role.state.message}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {user.is_active ? "Deactivate this account" : "Reactivate this account"}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Accounts are never deleted — loans, SBTR history and penalties must stay auditable.
                  A deactivated member cannot borrow.
                </p>
              </div>
              <Button
                variant={user.is_active ? "destructive" : "secondary"}
                disabled={busy || (isSelf && user.is_active)}
                onClick={() =>
                  active.submit({
                    userId: user.id,
                    isActive: user.is_active ? "false" : "true",
                  })
                }
              >
                {active.pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CircleSlash />
                )}
                {user.is_active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
            {active.state && !active.state.ok ? (
              <Alert variant="destructive">
                <AlertTitle>Account status unchanged</AlertTitle>
                <AlertDescription>{active.state.message}</AlertDescription>
              </Alert>
            ) : null}
          </TabsContent>

          <TabsContent value="member" className="space-y-4 pt-3">
            <div>
              <Label htmlFor={`type-${user.id}`}>Borrower type</Label>
              <Select value={borrowerType} onValueChange={setBorrowerType} disabled={busy}>
                <SelectTrigger id={`type-${user.id}`} className="mt-1.5">
                  <SelectValue placeholder="Select the borrower type" />
                </SelectTrigger>
                <SelectContent>
                  {BORROWER_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {borrowerType === "student" ? (
              <>
                <div>
                  <Label htmlFor={`level-${user.id}`}>Level</Label>
                  <Select
                    value={level}
                    onValueChange={(value) => {
                      setLevel(value);
                      if (!isSeniorHighLevel(value)) setTrack(NONE);
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger id={`level-${user.id}`} className="mt-1.5">
                      <SelectValue placeholder="Select the level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not set</SelectItem>
                      {EDUCATION_LEVELS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ErrorText errors={member.state?.errors} name="educationLevel" />
                </div>

                {isSeniorHigh ? (
                  <div>
                    <Label htmlFor={`track-${user.id}`}>Senior high track</Label>
                    <Select value={track} onValueChange={setTrack} disabled={busy}>
                      <SelectTrigger id={`track-${user.id}`} className="mt-1.5">
                        <SelectValue placeholder="Select the track" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not set</SelectItem>
                        {SENIOR_HIGH_TRACKS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : level === NONE || levelNeedsProgramme(level) ? (
                  <div>
                    <Label htmlFor={`program-${user.id}`}>Programme</Label>
                    <Select value={program} onValueChange={setProgram} disabled={busy}>
                      <SelectTrigger id={`program-${user.id}`} className="mt-1.5">
                        <SelectValue placeholder="Select the programme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not set</SelectItem>
                        {COLLEGE_PROGRAMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ErrorText errors={member.state?.errors} name="collegeProgram" />
                  </div>
                ) : null}
              </>
            ) : (
              <div>
                <Label htmlFor={`department-${user.id}`}>Department</Label>
                <Select value={department} onValueChange={setDepartment} disabled={busy}>
                  <SelectTrigger id={`department-${user.id}`} className="mt-1.5">
                    <SelectValue placeholder="Select the department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not set</SelectItem>
                    {FACULTY_DEPARTMENTS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorText errors={member.state?.errors} name="facultyDepartment" />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`sbtr-${user.id}`}>SBTR number</Label>
                <Input
                  id={`sbtr-${user.id}`}
                  className="mt-1.5"
                  value={sbtr}
                  onChange={(event) => setSbtr(event.target.value)}
                  placeholder="RCC-SBTR-00000"
                  disabled={busy}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Required before a student may borrow. Leave blank to clear it.
                </p>
                <ErrorText errors={member.state?.errors} name="sbtrNumber" />
              </div>
              <div>
                <Label htmlFor={`limit-${user.id}`}>Borrowing limit override</Label>
                <Input
                  id={`limit-${user.id}`}
                  className="mt-1.5"
                  type="number"
                  min={0}
                  max={20}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="Policy default"
                  disabled={busy}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Blank keeps the current entitlement on the account.
                </p>
                <ErrorText errors={member.state?.errors} name="borrowingLimit" />
              </div>
            </div>

            {member.state && !member.state.ok && member.state.message ? (
              <Alert variant="destructive">
                <AlertTitle>Classification not saved</AlertTitle>
                <AlertDescription>{member.state.message}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              disabled={busy}
              onClick={() =>
                member.submit({
                  userId: user.id,
                  borrowerType,
                  educationLevel: borrowerType === "student" && level !== NONE ? level : undefined,
                  seniorHighTrack: isSeniorHigh && track !== NONE ? track : undefined,
                  collegeProgram:
                    borrowerType === "student" &&
                    program !== NONE &&
                    (level === NONE || levelNeedsProgramme(level))
                      ? program
                      : undefined,
                  facultyDepartment: borrowerType === "faculty" && department !== NONE
                    ? department
                    : undefined,
                  sbtrNumber: sbtr.trim(),
                  borrowingLimit: limit.trim() === "" ? undefined : limit.trim(),
                })
              }
            >
              {member.pending ? <Loader2 className="animate-spin" /> : <UserCog />}
              Save classification
            </Button>
          </TabsContent>

          <TabsContent value="standing" className="space-y-3 pt-3">
            {user.record ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Account status", value: user.record.status },
                  { label: "Borrowing limit", value: `${user.record.borrowing_limit} books` },
                  { label: "Loan period", value: `${user.record.loan_period_days} days` },
                  { label: "Books out", value: String(user.record.active_loans) },
                  { label: "Overdue", value: String(user.record.overdue_loans) },
                  { label: "Lifetime loans", value: String(user.record.total_loans) },
                  {
                    label: "Unsettled penalties",
                    value: formatPeso(user.record.outstanding_fines),
                  },
                  { label: "Last borrowed", value: formatDate(user.record.last_borrowed_at) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-muted/60 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink capitalize">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                This account has no borrower record yet, so no circulation entitlement is set.
              </p>
            )}
            {user.record?.block_reason ? (
              <Alert variant="warning">
                <CircleSlash className="size-4" />
                <AlertTitle>Why the desk refuses this member</AlertTitle>
                <AlertDescription>{user.record.block_reason}</AlertDescription>
              </Alert>
            ) : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Standing is recomputed by the database after every loan, return and fine settlement.
              Clear overdue items and settle penalties to lift a block; last sign-in{" "}
              {user.last_login_at ? formatDate(user.last_login_at) : "never recorded"}.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
