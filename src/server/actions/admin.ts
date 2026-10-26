"use server";

import { revalidatePath } from "next/cache";
import { isCollegeLevel, isSeniorHighLevel, levelNeedsProgramme, ROLE_LABEL } from "@/lib/constants";
import { emailConfig } from "@/lib/env";
import { guardRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import {
  booleanField,
  categorySchema,
  fieldErrors,
  librarySchema,
  settingsSchema,
  userAdminSchema,
} from "@/lib/validators";
import type { ActionResult, BookCategory, RoleSlug, SessionMember } from "@/lib/types";
import {
  SETTING_KEYS,
  SETTINGS_META,
  listCategories,
  listLibraries,
  writeAudit,
  type SettingKey,
} from "@/server/data/admin";
import { deliverQueuedEmails, sendTemplatedEmail } from "@/server/email";

type SessionClient = Awaited<ReturnType<typeof createClient>>;
type SettingValue = string | number | boolean | null | SettingValue[];

/** `userAdminSchema` plus the senior-high track, which the console can also set. */
const accountFormSchema = userAdminSchema.extend({
  seniorHighTrack: z.enum(["pba", "ssh", "peat", "phs"]).optional(),
});

/** Everything the classification tab owns — never role or activation state. */
const classificationFormSchema = accountFormSchema.omit({ role: true, isActive: true });
const roleFormSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["borrower", "librarian", "admin"]),
});
const activeFormSchema = z.object({
  userId: z.string().uuid(),
  isActive: booleanField,
});

type ClassificationPatch = z.infer<typeof classificationFormSchema>;
type LibraryInput = z.infer<typeof librarySchema>;
/** `categorySchema` plus the visibility switch the taxonomy screen owns. */
type CategoryInput = z.infer<typeof categoryFormSchema>;

/**
 * `settingsSchema` covers the circulation and fine rules. The console also owns
 * the notification sender identity and the printed system identity, so those
 * four rows are validated alongside it in the same save.
 */
const policyExtrasSchema = z.object({
  senderName: z.string().trim().min(2, "Enter the sender display name").max(80),
  senderEmail: z
    .string()
    .trim()
    .email("Enter a valid sender e-mail address")
    .max(160, "Use the full reply-to address"),
  institution: z.string().trim().max(120).optional().or(z.literal("")),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Use the three-letter code, e.g. PHP")
    .optional()
    .or(z.literal("")),
});

interface UserAdminChange {
  userId: string;
  /** Primary role to grant; every other role on the account is revoked. */
  role?: RoleSlug;
  /** Account switch. Omitted when the dialog does not own activation. */
  isActive?: boolean;
  /** Borrower classification, SBTR number and individual borrowing entitlement. */
  classification?: ClassificationPatch;
  /** Audit verb recorded for this edit; defaults to the combined account action. */
  auditAction?: string;
}

/** Empty strings break `z.coerce.number()` — these fields are dropped instead. */
const NUMERIC_FIELDS = new Set([
  "id",
  "maxBooks",
  "loanDays",
  "finePerDay",
  "reserveFinePerHour",
  "reserveMinutes",
  "reserveTakeHomeHour",
  "fineBlockThreshold",
  "borrowingLimit",
  "parentId",
  "sortOrder",
]);

function invalid(message: string, errors: Record<string, string[]> = {}): ActionResult {
  return { ok: false, message, errors };
}

/** FormData → plain object; repeated keys collapse into an array, blanks drop for numbers. */
function toValues(form: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    if (value === "" && NUMERIC_FIELDS.has(key)) continue;
    if (key in payload) {
      const existing = payload[key];
      payload[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

function toPositiveId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function blankToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Postgres 23505 translated into desk language instead of a constraint name. */
function uniqueViolation(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error || error.code !== "23505") return null;
  const message = error.message ?? "";
  if (/code/i.test(message)) return "That branch code is already in use.";
  if (/slug/i.test(message)) return "That category URL slug is already taken.";
  if (/name/i.test(message)) return "A category with that name already exists.";
  if (/sbtr/i.test(message)) return "That SBTR number is already assigned to another member.";
  return "That value is already recorded and must be unique.";
}

function revalidateAdmin(...paths: string[]) {
  for (const path of new Set(["/dashboard/admin", ...paths])) revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

async function listActiveAdminIds(supabase: SessionClient): Promise<string[]> {
  // The FK name is required: user_roles points at users twice (user_id and
  // granted_by), an unqualified embed fails, and this list reading empty would
  // silently disable the last-administrator protection below.
  const { data } = await supabase
    .from("user_roles")
    .select("user_id, users!user_roles_user_id_fkey ( id, is_active )")
    .eq("role_slug", "admin");
  const rows = (data ?? []) as unknown as { user_id: string; users: { id: string; is_active: boolean } | null }[];
  return rows.filter((row) => row.users?.is_active).map((row) => row.user_id);
}

function classificationProblem(input: ClassificationPatch): Record<string, string[]> | null {
  if (input.borrowerType === "student" && !input.educationLevel && !input.collegeProgram) {
    return { educationLevel: ["Select a class level or a college programme for this student."] };
  }
  if (input.borrowerType === "faculty" && !input.facultyDepartment) {
    return { facultyDepartment: ["Select the department this faculty member belongs to."] };
  }
  if (input.borrowerType !== "student" && input.educationLevel) {
    return { educationLevel: ["A level only applies to student borrowers."] };
  }
  if (input.borrowerType !== "faculty" && input.facultyDepartment) {
    return { facultyDepartment: ["A department only applies to faculty borrowers."] };
  }
  if (input.borrowerType === "student" && levelNeedsProgramme(input.educationLevel) && !input.collegeProgram) {
    return {
      collegeProgram: [
        isCollegeLevel(input.educationLevel)
          ? "Select the course this student is taking."
          : "Select the graduate programme.",
      ],
    };
  }
  return null;
}

function profilePatch(input: ClassificationPatch) {
  const isStudent = input.borrowerType === "student";
  const seniorHigh = isSeniorHighLevel(input.educationLevel);
  return {
    borrower_type: input.borrowerType ?? null,
    education_level: isStudent ? (input.educationLevel ?? null) : null,
    senior_high_track: isStudent && seniorHigh ? (input.seniorHighTrack ?? null) : null,
    college_program: isStudent ? (input.collegeProgram ?? null) : null,
    faculty_department: input.borrowerType === "faculty" ? (input.facultyDepartment ?? null) : null,
    sbtr_number: blankToNull(input.sbtrNumber),
  };
}

/**
 * Applies one account edit through the guards the console promises: nobody can
 * demote or close their own account, and the last active administrator is
 * always protected. Roles, activation and classification are each optional so
 * the single-purpose dialogs never touch the fields they do not own.
 */
async function applyUserAdminChange(
  actor: SessionMember,
  change: UserAdminChange,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: found } = await supabase
    .from("users")
    .select("id, full_name, email, is_active")
    .eq("id", change.userId)
    .maybeSingle();
  const target = found as { id: string; full_name: string; email: string; is_active: boolean } | null;
  if (!target) return invalid("That account is no longer in the directory.", { userId: ["Account not found."] });

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role_slug")
    .eq("user_id", target.id);
  const currentRoles = new Set((roleRows ?? []).map((row) => (row as { role_slug: RoleSlug }).role_slug));
  const self = target.id === actor.user.id;

  if (self && change.role !== undefined && change.role !== "admin") {
    return invalid(
      "You cannot remove your own administrator role. Promote another account first, then hand the console over.",
      { role: ["Keep your own administrator role while you are signed in."] },
    );
  }
  if (self && change.isActive === false) {
    return invalid("You cannot deactivate the account you are signed in with.", {
      isActive: ["Sign in from another administrator account to close this one."],
    });
  }

  const stillAdmin = change.role === undefined ? currentRoles.has("admin") : change.role === "admin";
  const staysActive = change.isActive ?? target.is_active;
  if (currentRoles.has("admin") && (!stillAdmin || !staysActive)) {
    const activeAdmins = await listActiveAdminIds(supabase);
    if (activeAdmins.length <= 1 && activeAdmins.includes(target.id)) {
      return invalid(
        `${target.full_name} is the only active administrator. Promote another account before this one is demoted or deactivated.`,
        { role: ["The last active administrator is protected."] },
      );
    }
  }

  const changes: string[] = [];

  if (change.isActive !== undefined && target.is_active !== change.isActive) {
    const { error } = await supabase
      .from("users")
      .update({ is_active: change.isActive })
      .eq("id", target.id);
    if (error) return invalid("The account status could not be saved.", { form: [error.message] });
    changes.push(change.isActive ? "reactivated" : "deactivated");
  }

  if (change.role !== undefined) {
    const stale = [...currentRoles].filter((slug) => slug !== change.role);
    if (stale.length) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", target.id)
        .in("role_slug", stale);
      if (error) return invalid("The previous roles could not be cleared.", { role: [error.message] });
    }
    if (!currentRoles.has(change.role)) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: target.id, role_slug: change.role, granted_by: actor.user.id });
      if (error) return invalid("The new role could not be granted.", { role: [error.message] });
    }
    if (stale.length || !currentRoles.has(change.role)) {
      changes.push(`role set to ${ROLE_LABEL[change.role]}`);
    }
  }

  if (change.classification?.borrowerType) {
    const { error } = await supabase
      .from("profiles")
      .update(profilePatch(change.classification))
      .eq("user_id", target.id);
    if (error) {
      const friendly = uniqueViolation(error);
      return invalid(
        friendly ?? "The borrower classification could not be saved.",
        friendly ? { sbtrNumber: [friendly] } : { form: [error.message] },
      );
    }
    changes.push("classification saved");
  }

  const limit = change.classification?.borrowingLimit;
  if (typeof limit === "number") {
    const { error } = await supabase
      .from("borrower_records")
      .upsert({ user_id: target.id, borrowing_limit: limit }, { onConflict: "user_id" });
    if (error) return invalid("The borrowing limit could not be saved.", { borrowingLimit: [error.message] });
    changes.push(`limit ${limit} books`);
  }

  await writeAudit({
    action: change.auditAction ?? "admin.user_updated",
    entityType: "user",
    entityId: target.id,
    metadata: {
      email: target.email,
      role: change.role ?? null,
      is_active: change.isActive ?? null,
      borrowing_limit: limit ?? null,
      sbtr_number: blankToNull(change.classification?.sbtrNumber),
      borrower_type: change.classification?.borrowerType ?? null,
      education_level: change.classification?.educationLevel ?? null,
      college_program: change.classification?.collegeProgram ?? null,
      faculty_department: change.classification?.facultyDepartment ?? null,
      changed_by: actor.user.full_name,
    },
  });
  revalidateAdmin("/dashboard/admin/users", "/dashboard/members");

  return {
    ok: true,
    message: `${target.full_name} saved${changes.length ? ` — ${changes.join(", ")}` : " unchanged"}.`,
  };
}

export async function updateUserAdminAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const actor = await guardRole("admin");

  const parsed = accountFormSchema.safeParse(toValues(form));
  if (!parsed.success) {
    return invalid("Check the highlighted fields on the account form.", fieldErrors(parsed.error));
  }
  const input = parsed.data;

  const problem = classificationProblem(input);
  if (problem) return invalid("The borrower classification is incomplete.", problem);

  return applyUserAdminChange(actor, {
    userId: input.userId,
    role: input.role,
    isActive: input.isActive,
    classification: input,
  });
}

/** Grants one primary role — every other role on the account is revoked. */
export async function updateUserRole(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const actor = await guardRole("admin");

  const parsed = roleFormSchema.safeParse(toValues(form));
  if (!parsed.success) {
    return invalid("Choose the role to grant this account.", fieldErrors(parsed.error));
  }
  return applyUserAdminChange(actor, {
    userId: parsed.data.userId,
    role: parsed.data.role,
    auditAction: "admin.user_role_changed",
  });
}

/** Opens or closes an account without touching its role. */
export async function setUserActive(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const actor = await guardRole("admin");

  const parsed = activeFormSchema.safeParse(toValues(form));
  if (!parsed.success) {
    return invalid("The account status was not supplied.", fieldErrors(parsed.error));
  }
  return applyUserAdminChange(actor, {
    userId: parsed.data.userId,
    isActive: parsed.data.isActive,
    auditAction: parsed.data.isActive ? "admin.user_reactivated" : "admin.user_deactivated",
  });
}

/** SBTR, classification and the individual borrowing entitlement. */
export async function updateMemberClassification(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const actor = await guardRole("admin");

  const parsed = classificationFormSchema.safeParse(toValues(form));
  if (!parsed.success) {
    return invalid("Check the borrower classification.", fieldErrors(parsed.error));
  }
  const problem = classificationProblem(parsed.data);
  if (problem) return invalid("The borrower classification is incomplete.", problem);

  return applyUserAdminChange(actor, {
    userId: parsed.data.userId,
    classification: parsed.data,
    auditAction: "admin.member_classification_updated",
  });
}

// ---------------------------------------------------------------------------
// Policy settings
// ---------------------------------------------------------------------------

function settingRow(key: SettingKey, value: SettingValue, actorId: string) {
  const meta = SETTINGS_META[key];
  return {
    key,
    value,
    label: meta.label,
    group_name: meta.group,
    updated_by: actorId,
  };
}

/** Sender identity and general branding, kept beside the policy values in `settings`. */
interface PolicyInput {
  maxBooks: number;
  loanDays: number;
  finePerDay: number;
  reserveFinePerHour: number;
  reserveMinutes: number;
  reserveTakeHomeHour: number;
  fineBlockThreshold: number;
  reminderDays: number[];
  referenceLibraryOnly: boolean;
  periodicalsLibraryOnly: boolean;
}

type IdentityInput = z.infer<typeof policyExtrasSchema>;

function policyRows(input: PolicyInput, actorId: string) {
  return [
    settingRow(SETTING_KEYS.maxBooks, input.maxBooks, actorId),
    settingRow(SETTING_KEYS.loanDays, input.loanDays, actorId),
    settingRow(SETTING_KEYS.finePerDay, Number(input.finePerDay.toFixed(2)), actorId),
    settingRow(SETTING_KEYS.reserveFinePerHour, Number(input.reserveFinePerHour.toFixed(2)), actorId),
    settingRow(SETTING_KEYS.reserveMinutes, input.reserveMinutes, actorId),
    settingRow(SETTING_KEYS.reserveTakeHomeHour, input.reserveTakeHomeHour, actorId),
    settingRow(SETTING_KEYS.fineBlockThreshold, Number(input.fineBlockThreshold.toFixed(2)), actorId),
    settingRow(SETTING_KEYS.reminderDays, input.reminderDays, actorId),
    settingRow(SETTING_KEYS.referenceLibraryOnly, input.referenceLibraryOnly, actorId),
    settingRow(SETTING_KEYS.periodicalsLibraryOnly, input.periodicalsLibraryOnly, actorId),
  ];
}

/**
 * The four identity rows are JSON strings in `settings` (the seed writes
 * `'"RCC LIBRO"'`), so the plain string is passed through — the Supabase client
 * handles the JSON encoding. Blank optional values are skipped rather than
 * wiping a seeded row.
 */
function identityRows(input: IdentityInput, actorId: string) {
  const rows = [
    settingRow(SETTING_KEYS.senderName, input.senderName.trim(), actorId),
    settingRow(SETTING_KEYS.senderEmail, input.senderEmail.trim().toLowerCase(), actorId),
  ];
  if (input.institution) {
    rows.push(settingRow(SETTING_KEYS.institution, input.institution.trim(), actorId));
  }
  if (input.currency) {
    rows.push(settingRow(SETTING_KEYS.currency, input.currency.trim().toUpperCase(), actorId));
  }
  return rows;
}

/** Lead days rounded, clamped, de-duplicated and ordered so the soonest notice is last. */
function normalizeReminderDays(days: number[]): number[] {
  return [...new Set(days.map((day) => Math.round(day)).filter((day) => day >= 0 && day <= 60))].sort(
    (a, b) => b - a,
  );
}

async function persistSettings(rows: ReturnType<typeof settingRow>[], summary: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) return { ok: false as const, error };

  await writeAudit({
    action: "admin.settings_updated",
    entityType: "settings",
    entityId: null,
    metadata: {
      values: Object.fromEntries(rows.map((row) => [row.key, row.value])),
      ...summary,
    },
  });
  revalidateAdmin("/dashboard/admin/settings", "/dashboard", "/policies", "/dashboard/analytics");
  return { ok: true as const };
}

/**
 * Saves the settings screen in one pass: the ten circulation / fine / reminder
 * rows plus the sender and institution rows. Errors from either half are merged
 * so the form highlights every offending input at once.
 */
export async function saveSettings(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const actor = await guardRole("admin");

  const values = toValues(form);
  const policy = settingsSchema.safeParse(values);
  const extras = policyExtrasSchema.safeParse(values);

  if (!policy.success || !extras.success) {
    return invalid(
      "Check the highlighted values — nothing was saved.",
      {
        ...(policy.success ? {} : fieldErrors(policy.error)),
        ...(extras.success ? {} : fieldErrors(extras.error)),
      },
    );
  }

  const reminderDays = normalizeReminderDays(policy.data.reminderDays);
  if (!reminderDays.length) {
    return invalid("List at least one reminder lead day.", {
      reminderDays: ["Provide between 1 and 6 reminder lead days."],
    });
  }

  const input = policy.data;
  const identity = extras.data;
  const saved = await persistSettings(
    [...policyRows({ ...input, reminderDays }, actor.user.id), ...identityRows(identity, actor.user.id)],
    { actor: actor.user.full_name, scope: "policy_and_identity" },
  );
  if (!saved.ok) return invalid("The settings could not be saved.", { form: [saved.error.message] });

  return {
    ok: true,
    message: `Policy saved · borrower contact ${identity.senderEmail} · ${
      input.maxBooks
    } books for ${input.loanDays} days · ₱${input.finePerDay.toFixed(2)} per day late · reminders ${reminderDays.join(
      ", ",
    )} days out.`,
  };
}

/** Named for the contract; identical to {@link saveSettings}. */
export async function updateSettingsAction(
  prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return saveSettings(prev, form);
}

// ---------------------------------------------------------------------------
// Branches & categories
// ---------------------------------------------------------------------------

function libraryPayload(input: LibraryInput) {
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    description: blankToNull(input.description),
    address: blankToNull(input.address),
    contact_number: blankToNull(input.contactNumber),
    email: blankToNull(input.email),
    is_active: input.isActive,
  };
}

export async function saveLibraryAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await guardRole("admin");

  const values = toValues(form);
  const parsed = librarySchema.safeParse(values);
  if (!parsed.success) {
    return invalid("Check the branch details.", fieldErrors(parsed.error));
  }
  const payload = libraryPayload(parsed.data);
  const id = toPositiveId(values.id);
  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("libraries")
      .update(payload)
      .eq("id", id)
      .select("id, code, name")
      .maybeSingle();
    const failure = uniqueViolation(error);
    if (failure) return invalid(failure, { code: [failure] });
    if (error || !data) {
      return invalid("The branch could not be updated.", { form: [error?.message ?? "Branch not found."] });
    }
    await writeAudit({
      action: "admin.library_updated",
      entityType: "library",
      entityId: String(id),
      metadata: { ...payload, id },
    });
    revalidateAdmin("/dashboard/admin/branches", "/dashboard/analytics");
    return { ok: true, message: `${payload.name} updated.` };
  }

  const libraries = await listLibraries();
  const nextOrder = libraries.reduce((max, library) => Math.max(max, library.sort_order), 0) + 1;
  const { data, error } = await supabase
    .from("libraries")
    .insert({ ...payload, sort_order: nextOrder })
    .select("id, code, name")
    .maybeSingle();
  const failure = uniqueViolation(error);
  if (failure) return invalid(failure, { code: [failure] });
  if (error || !data) {
    return invalid("The branch could not be created.", { form: [error?.message ?? "Unknown error"] });
  }

  const created = data as unknown as { id: number };
  await writeAudit({
    action: "admin.library_created",
    entityType: "library",
    entityId: String(created.id),
    metadata: { ...payload },
  });
  revalidateAdmin("/dashboard/admin/branches", "/dashboard/analytics");
  return { ok: true, message: `${payload.name} added as ${payload.code}.` };
}

export async function deleteLibraryAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await guardRole("admin");

  const id = toPositiveId(toValues(form).id);
  if (!id) return invalid("Select the branch you want to remove.", { id: ["Branch reference missing."] });

  const supabase = await createClient();
  const { count } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("library_id", id);
  if ((count ?? 0) > 0) {
    return invalid(
      `This branch still holds ${count} title(s). Deactivate it instead, or move the titles to another branch first.`,
      { id: ["Branches with titles cannot be deleted."] },
    );
  }

  const { data: removed } = await supabase
    .from("libraries")
    .delete()
    .eq("id", id)
    .select("code, name")
    .maybeSingle();
  if (!removed) return invalid("That branch is no longer registered.", { id: ["Branch not found."] });

  const branch = removed as unknown as { code: string; name: string };
  await writeAudit({
    action: "admin.library_deleted",
    entityType: "library",
    entityId: String(id),
    metadata: { code: branch.code, name: branch.name },
  });
  revalidateAdmin("/dashboard/admin/branches", "/dashboard/analytics");
  return { ok: true, message: `${branch.name} (${branch.code}) deleted.` };
}

function categoryPayload(input: CategoryInput) {
  return {
    name: input.name.trim(),
    slug: slugify(input.slug || input.name),
    description: blankToNull(input.description),
    parent_id: input.parentId ?? null,
  };
}

/** `categorySchema` plus the visibility switch the taxonomy screen owns. */
const categoryFormSchema = categorySchema.extend({ isActive: booleanField });

export async function saveCategoryAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await guardRole("admin");

  const values = toValues(form);
  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) {
    return invalid("Check the category details.", fieldErrors(parsed.error));
  }
  const payload = { ...categoryPayload(parsed.data), is_active: parsed.data.isActive };
  const id = toPositiveId(values.id);

  if (id && payload.parent_id === id) {
    return invalid("A category cannot sit inside itself.", {
      parentId: ["Choose a different parent category."],
    });
  }

  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("book_categories")
      .update(payload)
      .eq("id", id)
      .select("id, name, slug")
      .maybeSingle();
    const failure = uniqueViolation(error);
    if (failure) return invalid(failure, { name: [failure] });
    if (error || !data) {
      return invalid("The category could not be updated.", { form: [error?.message ?? "Category not found."] });
    }
    await writeAudit({
      action: "admin.category_updated",
      entityType: "book_category",
      entityId: String(id),
      metadata: { ...payload, id },
    });
    revalidateAdmin("/dashboard/admin/branches", "/dashboard/catalog", "/dashboard/analytics");
    return { ok: true, message: `${payload.name} updated.` };
  }

  const categories = await listCategories();
  const nextOrder = categories.reduce((max, category) => Math.max(max, category.sort_order), 0) + 1;
  const { data, error } = await supabase
    .from("book_categories")
    .insert({ ...payload, sort_order: nextOrder })
    .select("id, name, slug")
    .maybeSingle();
  const failure = uniqueViolation(error);
  if (failure) return invalid(failure, { name: [failure] });
  if (error || !data) {
    return invalid("The category could not be created.", { form: [error?.message ?? "Unknown error"] });
  }

  const created = data as unknown as { id: number };
  await writeAudit({
    action: "admin.category_created",
    entityType: "book_category",
    entityId: String(created.id),
    metadata: { ...payload },
  });
  revalidateAdmin("/dashboard/admin/branches", "/dashboard/catalog", "/dashboard/analytics");
  return { ok: true, message: `${payload.name} added to the subject taxonomy.` };
}

export async function deleteCategoryAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await guardRole("admin");

  const values = toValues(form);
  const id = toPositiveId(values.id);
  if (!id) return invalid("Select the category you want to remove.", { id: ["Category reference missing."] });

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("book_categories")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return invalid("That category is no longer registered.", { id: ["Category not found."] });

  const category = existing as unknown as Pick<BookCategory, "id" | "name" | "slug">;
  const { count } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  const { error } = await supabase.from("book_categories").delete().eq("id", id);
  if (error) return invalid("The category could not be deleted.", { form: [error.message] });

  await writeAudit({
    action: "admin.category_deleted",
    entityType: "book_category",
    entityId: String(id),
    metadata: { name: category.name, slug: category.slug, titles_detached: count ?? 0 },
  });
  revalidateAdmin("/dashboard/admin/branches", "/dashboard/catalog", "/dashboard/analytics");

  return {
    ok: true,
    message:
      (count ?? 0) > 0
        ? `${category.name} deleted — ${count} title(s) are now uncategorised.`
        : `${category.name} deleted.`,
  };
}

// ---------------------------------------------------------------------------
// E-mail centre
// ---------------------------------------------------------------------------

/**
 * Manual equivalent of the scheduled job, deliberately running the same code as
 * `/api/cron/reminders`: `stage_due_reminders()` marks loans overdue and stages
 * the 7/3/1-day plus overdue notices — SQL dedupes on `email_logs.dedupe_key`, so
 * a repeat press is harmless — then `deliverQueuedEmails()` drains the queue.
 * The RPC is service-role only, exactly like the cron route.
 */
async function runReminderSweep(limit: number): Promise<ActionResult> {
  let db: AdminClient;
  try {
    db = createAdminClient();
  } catch {
    return invalid(
      "SUPABASE_SERVICE_ROLE_KEY is not configured, so the sweep cannot run. The scheduled endpoint needs the same key.",
      { form: ["Service role key missing."] },
    );
  }

  const { data: staged, error } = await db.rpc("stage_due_reminders");
  if (error) {
    return invalid("The reminder sweep could not run.", { form: [error.message] });
  }

  const queued = Number((staged as { staged?: number } | null)?.staged ?? 0);
  const queue = await deliverQueuedEmails(limit);

  await writeAudit({
    action: "admin.reminders_run",
    entityType: "email_log",
    entityId: null,
    metadata: {
      staged: queued,
      delivered: queue.delivered,
      failed: queue.failed,
      queue_message: queue.message,
      provider: emailConfig.provider,
    },
  });
  revalidateAdmin("/dashboard/admin/email", "/dashboard/notifications", "/dashboard/admin");

  const outcome = emailConfig.enabled
    ? `${queue.delivered} sent, ${queue.failed} failed.`
    : `No transport is configured, so the queue was journalled as skipped instead of being sent.${
        emailConfig.notice ? ` (${emailConfig.notice})` : ""
      }`;

  return {
    ok: true,
    message: `${queued} new reminder(s) staged · ${queue.message} ${outcome}`,
  };
}

/** Queue depth accepted from the form, clamped so one press cannot fan out unbounded. */
function reminderLimit(form: FormData): number {
  const value = Number(toValues(form).limit ?? 60);
  return Number.isFinite(value) ? Math.min(200, Math.max(10, Math.round(value))) : 60;
}

export async function runRemindersAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await guardRole("admin");
  return runReminderSweep(reminderLimit(form));
}

/** Same sweep, no form field required — used by the e-mail centre's job button. */
export async function runReminderJob(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  await guardRole("admin");
  return runReminderSweep(reminderLimit(form));
}

const testEmailSchema = z.object({
  to: z.string().trim().toLowerCase().email("Enter a valid e-mail address").max(160),
});

/**
 * Proves the provider wiring end to end. Renders the welcome template, journals
 * the attempt in `email_logs` and reports honestly whether the configured
 * transport accepted it or the row was only written to the outbox.
 */
export async function sendTestEmail(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const actor = await guardRole("admin");

  const requested = toValues(form).to;
  const parsed = testEmailSchema.safeParse({
    to: typeof requested === "string" && requested.trim() ? requested : actor.user.email,
  });
  if (!parsed.success) {
    return invalid("Enter the address that should receive the test message.", fieldErrors(parsed.error));
  }

  const result = await sendTemplatedEmail({
    to: parsed.data.to,
    userId: actor.user.id,
    template: "welcome",
    values: { borrowerName: actor.user.full_name, needsSbtr: "" },
  });

  await writeAudit({
    action: "admin.email_test_send",
    entityType: "email_log",
    entityId: result.logId ? String(result.logId) : null,
    metadata: {
      recipient: parsed.data.to,
      ok: result.ok,
      skipped: result.skipped ?? null,
      provider: emailConfig.provider,
      message: result.message,
    },
  });
  revalidateAdmin("/dashboard/admin/email", "/dashboard/notifications");

  if (!result.ok) {
    return invalid(`The provider refused the test message: ${result.message}`, { to: [result.message] });
  }

  const delivery = emailConfig.enabled
    ? `${emailConfig.label} accepted the message.`
    : `No transport is configured${
        emailConfig.notice ? ` (${emailConfig.notice})` : ""
      }, so the row is journalled as skipped instead of delivered.`;

  return { ok: true, message: `Test message for ${parsed.data.to} — ${result.message} ${delivery}` };
}
