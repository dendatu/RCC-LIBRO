"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signInWithGoogle, signUpWithPassword } from "@/server/actions/auth";
import { useFormAction } from "@/hooks/use-form-action";
import { registerSchema } from "@/lib/validators";
import { APP_NAME } from "@/lib/constants";

type Values = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  contactNumber?: string;
};

export function RegisterForm() {
  const action = useFormAction(signUpWithPassword);
  const google = useFormAction(signInWithGoogle);
  const [issues, setIssues] = useState<Record<string, string[]>>({});
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", contactNumber: "" },
  });

  useEffect(() => {
    if (!action.state) return;
    if (action.state.ok) toast.success(action.state.message ?? "Account created.");
    else {
      if (action.state.message) toast.error(action.state.message);
      setIssues(action.state.errors ?? {});
    }
  }, [action.state]);

  const submit = handleSubmit((values) => action.submit(values as unknown as Record<string, unknown>));

  return (
    <AuthShell
      title={`Create your ${APP_NAME} account`}
      subtitle="Borrowers are provisioned automatically. A librarian verifies your SBTR or faculty ID before loans are released."
      footer={
        <p>
          Already registered?{" "}
          <Link href="/login" className="font-medium text-brand-600 underline-offset-4 hover:underline">
            Sign in instead
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full bg-card"
          disabled={google.pending}
          onClick={() =>
            void google.submit({}, { next: "/dashboard/profile?onboard=1" })
          }
        >
          {google.pending ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
          Sign up with Google
        </Button>

        <div className="flex items-center gap-3 py-1">
          <Separator className="flex-1" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            or with your e-mail
          </span>
          <Separator className="flex-1" />
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <Field
          id="fullName"
          label="Full name"
          error={errors.fullName?.message ?? issues.fullName?.[0]}
        >
          <Input id="fullName" autoComplete="name" placeholder="Juan D. dela Cruz" {...register("fullName")} />
        </Field>

        <Field
          id="email"
          label="College e-mail"
          error={errors.email?.message ?? issues.email?.[0]}
        >
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="student@rcc.edu.ph"
            {...register("email")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="password"
            label="Password"
            hint="8+ characters, one letter and one number"
            error={errors.password?.message ?? issues.password?.[0]}
          >
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field
            id="confirmPassword"
            label="Confirm password"
            error={errors.confirmPassword?.message ?? issues.confirmPassword?.[0]}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
          </Field>
        </div>

        <Field
          id="contactNumber"
          label="Mobile number"
          optional
          error={errors.contactNumber?.message ?? issues.contactNumber?.[0]}
        >
          <Input id="contactNumber" placeholder="+63 9XX XXX XXXX" {...register("contactNumber")} />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={action.pending}>
          {action.pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Create account
        </Button>

        <p className="text-xs leading-relaxed text-muted-foreground">
          By registering you agree that library staff may record your borrowing history, fines and
          contact details in accordance with the Data Privacy Act of 2012.
        </p>
      </form>
    </AuthShell>
  );
}

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
        {optional ? <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
