"use client";

import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/utils";
import { useFormAction } from "@/hooks/use-form-action";
import { saveSettings } from "@/server/actions/admin";

/** Mirrors the policy rows held in `settings`; every draft value is a string. */
export interface PolicyInitial {
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
  senderName: string;
  senderEmail: string;
  institution: string;
  currency: string;
}

type Field = keyof PolicyInitial;
type Draft = Record<Field, string>;

function toDraft(initial: PolicyInitial): Draft {
  return {
    maxBooks: String(initial.maxBooks),
    loanDays: String(initial.loanDays),
    finePerDay: String(initial.finePerDay),
    reserveFinePerHour: String(initial.reserveFinePerHour),
    reserveMinutes: String(initial.reserveMinutes),
    reserveTakeHomeHour: String(initial.reserveTakeHomeHour),
    fineBlockThreshold: String(initial.fineBlockThreshold),
    reminderDays: initial.reminderDays.join(", "),
    referenceLibraryOnly: initial.referenceLibraryOnly ? "true" : "false",
    periodicalsLibraryOnly: initial.periodicalsLibraryOnly ? "true" : "false",
    senderName: initial.senderName,
    senderEmail: initial.senderEmail,
    institution: initial.institution,
    currency: initial.currency,
  };
}

function NumberField({
  id,
  label,
  hint,
  value,
  error,
  min,
  max,
  step,
  prefix,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  error?: string;
  min: number;
  max: number;
  step?: string;
  prefix?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        {prefix ? (
          <span className="text-xs font-semibold text-muted-foreground" aria-hidden>
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          className="max-w-36"
          value={value}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-muted-foreground">
        {error ? <span className="font-medium text-destructive">{error}</span> : hint}
      </p>
    </div>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  error,
  type = "text",
  maxLength,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  error?: string;
  type?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        className="max-w-sm"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-muted-foreground">
        {error ? <span className="font-medium text-destructive">{error}</span> : hint}
      </p>
    </div>
  );
}

function ToggleField({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}

export function SettingsForm({
  initial,
  lastUpdated,
}: {
  initial: PolicyInitial;
  lastUpdated: string;
}) {
  const baseline = useMemo(() => toDraft(initial), [initial]);
  const [draft, setDraft] = useState<Draft>(baseline);
  const { submit, state, pending, reset } = useFormAction(saveSettings);

  const set = (field: Field) => (value: string | boolean) =>
    setDraft((current) => ({
      ...current,
      [field]: typeof value === "boolean" ? (value ? "true" : "false") : value,
    }));

  const err = (field: Field) => state?.errors?.[field]?.[0];
  const money = (value: string) => Number(value || 0).toFixed(2);

  const reminders = useMemo(
    () =>
      draft.reminderDays
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value)),
    [draft.reminderDays],
  );

  const consequence = useMemo(
    () => [
      `A member may hold ${draft.maxBooks || 0} book(s) for ${draft.loanDays || 0} days, due by 23:59 on the due date.`,
      `Late books accrue PHP ${money(draft.finePerDay)} per day — weekends and holidays included.`,
      `Reserve books allow ${draft.reserveMinutes || 0} minutes at the table; from ${draft.reserveTakeHomeHour || 0}:00 they may go home, at PHP ${money(draft.reserveFinePerHour)} per overdue hour.`,
      `Borrowing is refused once unresolved penalties reach PHP ${money(draft.fineBlockThreshold)}.`,
      reminders.length
        ? `Reminder e-mails go out ${reminders.join(", ")} day(s) before the due date, plus one overdue notice per loan.`
        : "No reminder lead days are set, so borrowers receive no advance notice.",
      draft.referenceLibraryOnly === "true"
        ? "Reference titles stay inside the library."
        : "Reference titles can be borrowed — this overrides the written RCC policy.",
      draft.periodicalsLibraryOnly === "true"
        ? "Periodicals stay inside the library."
        : "Periodicals can be borrowed — this overrides the written RCC policy.",
    ],
    [draft, reminders],
  );

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  const onSave = () => {
    submit({
      ...draft,
      referenceLibraryOnly: draft.referenceLibraryOnly === "true",
      periodicalsLibraryOnly: draft.periodicalsLibraryOnly === "true",
    });
    toast.info("Saving policy");
  };

  return (
    <div className="space-y-6">
      <Card className="border-gold/40 bg-gold-soft/25">
        <CardHeader>
          <CardTitle>What these rules mean at the desk</CardTitle>
          <CardDescription>
            Each value below is enforced in Postgres, not in the browser. Saving changes the terms
            offered to new loans; loans already issued keep the terms they were issued under.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
            {consequence.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Circulation</CardTitle>
            <CardDescription>
              Loan entitlement and the reserve-book window.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <NumberField
              id="maxBooks"
              label="Maximum borrowed books"
              hint="Students may hold at most this many titles at one time."
              value={draft.maxBooks}
              min={1}
              max={20}
              disabled={pending}
              error={err("maxBooks")}
              onChange={set("maxBooks")}
            />
            <NumberField
              id="loanDays"
              label="Loan period (days)"
              hint="Default due date offset for general collection loans."
              value={draft.loanDays}
              min={1}
              max={90}
              disabled={pending}
              error={err("loanDays")}
              onChange={set("loanDays")}
            />
            <NumberField
              id="reserveMinutes"
              label="Reserve in-library minutes"
              hint="How long a reserve book may be kept at the reading table."
              value={draft.reserveMinutes}
              min={5}
              max={480}
              disabled={pending}
              error={err("reserveMinutes")}
              onChange={set("reserveMinutes")}
            />
            <NumberField
              id="reserveTakeHomeHour"
              label="Reserve take-home hour (24h)"
              hint="From this hour a reserve book may be taken home, due the next school day."
              value={draft.reserveTakeHomeHour}
              min={0}
              max={23}
              disabled={pending}
              error={err("reserveTakeHomeHour")}
              onChange={set("reserveTakeHomeHour")}
            />
            <Separator />
            <ToggleField
              id="referenceLibraryOnly"
              label="Reference section is library use only"
              hint="Dictionaries, encyclopedias and atlases cannot leave the library."
              checked={draft.referenceLibraryOnly === "true"}
              disabled={pending}
              onChange={set("referenceLibraryOnly")}
            />
            <ToggleField
              id="periodicalsLibraryOnly"
              label="Periodicals are library use only"
              hint="Magazines, newspapers, journals and clippings cannot be borrowed."
              checked={draft.periodicalsLibraryOnly === "true"}
              disabled={pending}
              onChange={set("periodicalsLibraryOnly")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fines</CardTitle>
            <CardDescription>Penalty rates and the threshold that blocks borrowing.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <NumberField
              id="finePerDay"
              label="Overdue fine per day"
              hint="Charged per book, per calendar day including weekends and holidays."
              value={draft.finePerDay}
              min={0}
              max={1000}
              step="0.01"
              prefix="PHP"
              disabled={pending}
              error={err("finePerDay")}
              onChange={set("finePerDay")}
            />
            <NumberField
              id="reserveFinePerHour"
              label="Reserve book fine per hour"
              hint="Charged when a reserve book is kept past its allowed window."
              value={draft.reserveFinePerHour}
              min={0}
              max={1000}
              step="0.01"
              prefix="PHP"
              disabled={pending}
              error={err("reserveFinePerHour")}
              onChange={set("reserveFinePerHour")}
            />
            <NumberField
              id="fineBlockThreshold"
              label="Fine threshold that blocks borrowing"
              hint="Borrowing is refused once unresolved penalties meet or exceed this amount."
              value={draft.fineBlockThreshold}
              min={0}
              max={100000}
              step="0.01"
              prefix="PHP"
              disabled={pending}
              error={err("fineBlockThreshold")}
              onChange={set("fineBlockThreshold")}
            />
            <Separator />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Lost books are charged at the copy&apos;s acquisition price plus a PHP 150.00
              processing fee; damaged books at half that price. Both are set on the physical copy
              record in inventory, not here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Reminder timing and outgoing sender identity.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reminderDays">Reminder lead days</Label>
              <Input
                id="reminderDays"
                className="max-w-36"
                value={draft.reminderDays}
                disabled={pending}
                onChange={(event) => set("reminderDays")(event.target.value)}
                placeholder="7, 3, 1"
                aria-invalid={err("reminderDays") ? true : undefined}
                aria-describedby="reminderDays-hint"
              />
              <p id="reminderDays-hint" className="text-[11px] leading-relaxed text-muted-foreground">
                Comma-separated days before the due date. One overdue notice is always added per
                loan.
              </p>
              {err("reminderDays") ? (
                <p className="text-[11px] font-medium text-destructive" role="alert">
                  {err("reminderDays")}
                </p>
              ) : null}
            </div>
            <TextField
              id="senderName"
              label="Notification sender name"
              hint="Display name shown on every outgoing message."
              value={draft.senderName}
              maxLength={60}
              disabled={pending}
              error={err("senderName")}
              onChange={set("senderName")}
            />
            <TextField
              id="senderEmail"
              label="Notification sender e-mail"
              hint="Reply-to address. It must be a verified sender in your mail provider."
              type="email"
              value={draft.senderEmail}
              maxLength={160}
              disabled={pending}
              error={err("senderEmail")}
              onChange={set("senderEmail")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Values printed across reports and the library card.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <TextField
              id="institution"
              label="Institution name"
              hint="Appears on SBTR records, printed cards and exported reports."
              value={draft.institution}
              maxLength={160}
              disabled={pending}
              error={err("institution")}
              onChange={set("institution")}
            />
            <TextField
              id="currency"
              label="Currency"
              hint="Three-letter ISO code. Fine amounts are stored as numbers."
              value={draft.currency}
              maxLength={3}
              disabled={pending}
              error={err("currency")}
              onChange={(value) => set("currency")(value.toUpperCase())}
            />
          </CardContent>
        </Card>
      </div>

      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Policy not saved</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok ? (
        <Alert variant="info" role="status" aria-live="polite">
          <AlertTitle>Policy updated</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur">
        <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {dirty ? (
            <Badge variant="warning">Unsaved changes</Badge>
          ) : (
            <Badge variant="outline">In sync with the database</Badge>
          )}
          <span>Last change {formatDateTime(lastUpdated)}.</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || !dirty}
            onClick={() => {
              setDraft(baseline);
              reset();
            }}
          >
            <RotateCcw />
            Discard
          </Button>
          <Button size="sm" disabled={pending} onClick={onSave}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Save policy
          </Button>
        </div>
      </div>
    </div>
  );
}
