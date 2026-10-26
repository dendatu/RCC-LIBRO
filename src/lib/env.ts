import { z } from "zod";

/**
 * Environment is validated once per server runtime. Build-time collections often
 * run without secrets, so missing values degrade to explicit `null` and every
 * consumer that genuinely needs them calls `requirePublicConfig()`.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

/** `.env.example` ships blank optional keys; an empty string means "unset". */
const optional = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: optional(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: optional(process.env.SUPABASE_SERVICE_ROLE_KEY),
  RESEND_API_KEY: optional(process.env.RESEND_API_KEY),
  CRON_SECRET: optional(process.env.CRON_SECRET),
  NEXT_PUBLIC_SITE_URL: optional(process.env.NEXT_PUBLIC_SITE_URL),
});

export const env = parsed.success ? parsed.data : schema.parse({});

export const siteUrl =
  env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export function requireSupabaseEnv() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function requireServiceRoleEnv() {
  const { url } = requireSupabaseEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for administrative data access. Never expose it to the browser.",
    );
  }
  return { url, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

export const emailConfig = {
  apiKey: env.RESEND_API_KEY ?? null,
  fromName: "RCC LIBRO",
  fromAddress: process.env.RESEND_FROM_ADDRESS ?? "RCC LIBRO <library@rcc.edu.ph>",
  enabled: Boolean(env.RESEND_API_KEY),
};
