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
  MAIL_PROVIDER: z.enum(["smtp", "resend", "console"]).optional(),
  MAIL_SMTP_HOST: z.string().min(1).optional(),
  MAIL_SMTP_PORT: z.string().min(1).optional(),
  MAIL_SMTP_USER: z.string().min(1).optional(),
  MAIL_SMTP_PASS: z.string().min(1).optional(),
  MAIL_SMTP_SECURE: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
  RESEND_FROM_ADDRESS: z.string().min(1).optional(),
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
  MAIL_PROVIDER: optional(process.env.MAIL_PROVIDER) as "smtp" | "resend" | "console" | undefined,
  MAIL_SMTP_HOST: optional(process.env.MAIL_SMTP_HOST),
  MAIL_SMTP_PORT: optional(process.env.MAIL_SMTP_PORT),
  MAIL_SMTP_USER: optional(process.env.MAIL_SMTP_USER),
  MAIL_SMTP_PASS: optional(process.env.MAIL_SMTP_PASS),
  MAIL_SMTP_SECURE: optional(process.env.MAIL_SMTP_SECURE),
  MAIL_FROM: optional(process.env.MAIL_FROM),
  RESEND_FROM_ADDRESS: optional(process.env.RESEND_FROM_ADDRESS),
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

export type MailProvider = "smtp" | "resend" | "console";

/** Every message carries this display name, whichever transport delivers it. */
const MAIL_FROM_NAME = "RCC LIBRO";

const addressOf = (value: string) => value.match(/<([^>]+)>/)?.[1]?.trim() ?? value.trim();

function smtpSettings() {
  const { MAIL_SMTP_HOST: host, MAIL_SMTP_USER: user, MAIL_SMTP_PASS: pass } = env;
  if (!host || !user || !pass) return null;
  const port = Number(env.MAIL_SMTP_PORT) || 587;
  // 465 is implicit TLS; 587/2525 upgrade with STARTTLS. An explicit
  // MAIL_SMTP_SECURE=false overrides the guess.
  const secure = env.MAIL_SMTP_SECURE ? env.MAIL_SMTP_SECURE !== "false" : port === 465;
  return { host, port, user, pass, secure };
}

/**
 * `MAIL_PROVIDER` wins when set, so a deployment that has both transports
 * configured can still name the one it wants. Otherwise SMTP takes precedence
 * over Resend because it is the no-cost path for a school that cannot verify a
 * domain, and `console` means mail is only journalled to `email_logs`.
 */
function resolveProvider(smtp: SmtpSettings | null): { provider: MailProvider; notice: string | null } {
  const requested = env.MAIL_PROVIDER;
  if (requested === "console") return { provider: "console", notice: null };
  if (requested === "resend") {
    return env.RESEND_API_KEY
      ? { provider: "resend", notice: null }
      : { provider: "console", notice: "MAIL_PROVIDER=resend but RESEND_API_KEY is not set." };
  }
  if (requested === "smtp") {
    return smtp
      ? { provider: "smtp", notice: null }
      : {
          provider: "console",
          notice: "MAIL_PROVIDER=smtp but MAIL_SMTP_HOST / MAIL_SMTP_USER / MAIL_SMTP_PASS are incomplete.",
        };
  }
  if (smtp) return { provider: "smtp", notice: null };
  if (env.RESEND_API_KEY) return { provider: "resend", notice: null };
  return { provider: "console", notice: null };
}

type SmtpSettings = ReturnType<typeof smtpSettings>;

const smtp = smtpSettings();
const { provider, notice } = resolveProvider(smtp);

/**
 * Gmail refuses a `From` that is not the authenticated account (or a verified
 * alias), so a mismatch would fail every send at the SMTP handshake. Correcting
 * it here keeps one mis-typed variable from looking like a broken notification
 * feature.
 */
let fromAddress = addressOf(
  env.MAIL_FROM ?? env.RESEND_FROM_ADDRESS ?? "library@rcc.edu.ph",
);
let fromNotice = notice;
if (provider === "smtp" && /gmail\.com/i.test(smtp?.host ?? "") && fromAddress !== smtp!.user) {
  fromNotice = `From address ${fromAddress} cannot be sent by this Gmail account; using ${smtp!.user}.`;
  fromAddress = smtp!.user;
}

export const emailConfig = {
  provider,
  enabled: provider !== "console",
  label: provider === "smtp" ? "SMTP" : provider === "resend" ? "Resend" : "Console outbox",
  fromName: MAIL_FROM_NAME,
  fromAddress,
  /** Full `From:` header — the display name is always the library, never the mailbox. */
  from: `${MAIL_FROM_NAME} <${fromAddress}>`,
  apiKey: env.RESEND_API_KEY ?? null,
  smtp,
  notice: fromNotice,
};
