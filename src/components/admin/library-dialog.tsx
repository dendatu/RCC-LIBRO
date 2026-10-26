"use client";

import { useState } from "react";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { saveLibraryAction as saveLibrary } from "@/server/actions/admin";

export interface LibraryDraft {
  libraryId?: number;
  code: string;
  name: string;
  description: string;
  address: string;
  contactNumber: string;
  email: string;
  isActive: boolean;
}

const EMPTY: LibraryDraft = {
  code: "",
  name: "",
  description: "",
  address: "",
  contactNumber: "",
  email: "",
  isActive: true,
};

export function LibraryDialog({
  library,
  triggerLabel,
}: {
  library?: LibraryDraft;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LibraryDraft>(library ?? EMPTY);
  const { submit, state, pending } = useFormAction(saveLibrary);

  const set = <K extends keyof LibraryDraft>(key: K) => (value: LibraryDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const error = (key: string) => state?.errors?.[key]?.[0];

  const onSubmit = () => {
    submit(
      {
        code: draft.code,
        name: draft.name,
        description: draft.description,
        address: draft.address,
        contactNumber: draft.contactNumber,
        email: draft.email,
        isActive: draft.isActive,
        id: draft.libraryId === undefined ? undefined : String(draft.libraryId),
      },
      { targetName: draft.name },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) setDraft(library ?? EMPTY);
      }}
    >
      <DialogTrigger asChild>
        {library ? (
          <Button variant="ghost" size="sm" aria-label={`${triggerLabel}: ${library.name}`}>
            <Check />
            Edit
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{library ? `Edit ${library.name}` : "Add a branch library"}</DialogTitle>
          <DialogDescription>
            Branches own the holdings, the circulation desk and the usage figures reported in
            analytics. Code is the short prefix used on call numbers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="library-code">Code</Label>
            <Input
              id="library-code"
              value={draft.code}
              maxLength={8}
              disabled={pending}
              aria-invalid={error("code") ? true : undefined}
              onChange={(event) => set("code")(event.target.value.toUpperCase())}
              placeholder="EL"
            />
            {error("code") ? (
              <p className="text-[11px] font-medium text-destructive" role="alert">
                {error("code")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="library-name">Branch name</Label>
            <Input
              id="library-name"
              value={draft.name}
              maxLength={120}
              disabled={pending}
              aria-invalid={error("name") ? true : undefined}
              onChange={(event) => set("name")(event.target.value)}
              placeholder="High School Library"
            />
            {error("name") ? (
              <p className="text-[11px] font-medium text-destructive" role="alert">
                {error("name")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="library-description">Description</Label>
          <Textarea
            id="library-description"
            value={draft.description}
            maxLength={500}
            disabled={pending}
            onChange={(event) => set("description")(event.target.value)}
            placeholder="Junior and senior high school collection including Filipiniana and reserve books."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="library-address">Address</Label>
          <Input
            id="library-address"
            value={draft.address}
            maxLength={200}
            disabled={pending}
            onChange={(event) => set("address")(event.target.value)}
            placeholder="RCC Building B — Second Floor, Angeles City"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="library-contact">Contact number</Label>
            <Input
              id="library-contact"
              value={draft.contactNumber}
              maxLength={32}
              disabled={pending}
              onChange={(event) => set("contactNumber")(event.target.value)}
              placeholder="(045) 000-0000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="library-email">Branch e-mail</Label>
            <Input
              id="library-email"
              type="email"
              value={draft.email}
              maxLength={160}
              disabled={pending}
              aria-invalid={error("email") ? true : undefined}
              onChange={(event) => set("email")(event.target.value)}
              placeholder="hs.library@rcc.edu.ph"
            />
            {error("email") ? (
              <p className="text-[11px] font-medium text-destructive" role="alert">
                {error("email")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-parchment px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="library-active">Accepting circulation</Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Deactivating hides the branch from public catalogue filters and the OPAC; existing
              holdings and loans stay intact.
            </p>
          </div>
          <Switch
            id="library-active"
            checked={draft.isActive}
            disabled={pending}
            onCheckedChange={set("isActive")}
            aria-label="Branch accepting circulation"
          />
        </div>

        {state && !state.ok ? (
          <Alert variant="destructive">
            <Building2 className="size-4" />
            <AlertTitle>Branch not saved</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={onSubmit}>
            {pending ? <Loader2 className="animate-spin" /> : <Building2 />}
            {library ? "Save branch" : "Add branch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
