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

/**
 * Everything a server-side Supabase client needs, or `null` when the project is
 * not configured (the build-time page collection runs without secrets).
 */
export function supabaseEnv() {
  const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicUrl || !anonKey) return null;
  return {
    url: internalUrl(publicUrl),
    anonKey,
    // Always derived from the browser-facing URL: the session cookie has to be
    // the one the browser sends back, even when this process reaches the same
    // gateway under a different hostname.
    storageKey: `sb-${new URL(publicUrl).hostname.split(".")[0]}-auth-token`,
  };
}

export function requireSupabaseEnv() {
  const config = supabaseEnv();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return config;
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

/**
 * `NEXT_PUBLIC_SUPABASE_URL` is what the browser can reach — the published
 * loopback address of a local stack. A container on the same Docker network has
 * to dial the service name instead, and one variable cannot be both, so the
 * server half may override it. Ignored in the client bundle, where the value is
 * inlined at build time and `process.env` lookups of private keys are empty.
 */
function internalUrl(publicUrl: string) {
  if (typeof window !== "undefined") return publicUrl;
  return process.env.SUPABASE_INTERNAL_URL?.trim() || publicUrl;
}

export const emailConfig = {
  apiKey: env.RESEND_API_KEY ?? null,
  fromName: "RCC LIBRO",
  fromAddress: process.env.RESEND_FROM_ADDRESS ?? "RCC LIBRO <library@rcc.edu.ph>",
  enabled: Boolean(env.RESEND_API_KEY),
};
