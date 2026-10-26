"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { fieldErrors, forgotSchema, loginSchema, registerSchema, resetSchema } from "@/lib/validators";
import type { ActionResult } from "@/lib/types";
import type { z } from "zod";

function safeNext(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function firstMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: string }).message;
    if (/Invalid login credentials/i.test(message)) {
      return "That e-mail and password do not match our records.";
    }
    if (/Email not confirmed/i.test(message)) {
      return "Confirm your e-mail address first, or request a new password link.";
    }
    if (/User already registered/i.test(message)) {
      return "An account already exists for this e-mail address.";
    }
    if (/For more information/i.test(message)) {
      return message.split("For more information")[0].trim();
    }
    return message;
  }
  return "Something went wrong. Please try again.";
}

function parse<T extends z.ZodTypeAny>(schema: T, form: FormData) {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) payload[key] = value;
  return schema.safeParse(payload);
}

export async function signInWithPassword(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = parse(loginSchema, form);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields", errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: firstMessage(error) };

  redirect(safeNext(form.get("next")) ?? "/dashboard");
}

export async function signInWithGoogle(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const next = safeNext(form.get("next")) ?? "/dashboard";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return { ok: false, message: error ? firstMessage(error) : "Google sign-in is not configured yet." };
  }
  redirect(data.url);
}

export async function signUpWithPassword(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = parse(registerSchema, form);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields", errors: fieldErrors(parsed.error) };
  }

  const { fullName, email, password, contactNumber } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/dashboard/profile?onboard=1")}`,
    },
  });

  if (error) return { ok: false, message: firstMessage(error) };

  // The database trigger provisions users, profiles and the borrower role.
  // The optional contact number is written through the fresh session so no
  // service-role key is needed during sign-up.
  if (data.user && contactNumber && data.session) {
    await supabase.from("users").update({ contact_number: contactNumber }).eq("id", data.user.id);
  }

  if (!data.session) {
    return {
      ok: true,
      message: "We sent a confirmation link to your e-mail. Open it to activate your account.",
    };
  }

  redirect("/dashboard/profile?onboard=1");
}

export async function requestPasswordReset(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = parse(forgotSchema, form);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields", errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error) return { ok: false, message: firstMessage(error) };

  return {
    ok: true,
    message: "If that address has a library account, a reset link is on its way.",
  };
}

export async function updatePassword(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = parse(resetSchema, form);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields", errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=recovery");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: firstMessage(error) };

  revalidatePath("/", "layout");
  redirect("/dashboard?updated=password");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?reason=signed_out");
}
