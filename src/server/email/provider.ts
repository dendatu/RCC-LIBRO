import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import { Resend } from "resend";
import { emailConfig } from "@/lib/env";

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
}

export interface DeliveryResult {
  /** Value written to `email_logs.provider`. */
  provider: string;
  id: string | null;
}

/** True when a real transport is wired up; otherwise mail is only journalled. */
export function transportReady() {
  return emailConfig.enabled;
}

let transporter: Transporter | null = null;

function smtpTransport(): Transporter {
  if (transporter) return transporter;
  const smtp = emailConfig.smtp;
  if (!smtp) throw new Error("SMTP was selected but its settings are incomplete.");
  transporter = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    // A dead host must fail the send quickly instead of hanging the request that
    // triggered it — the desk action and the cron sweep both wait on this.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transporter;
}

/**
 * The single seam between the app and whatever actually delivers mail.
 *
 * Gmail speaks SMTP and Node cannot listen for webhooks, so the provider's own
 * message id is all the tracking we get back — `email_logs` stays the source of
 * truth for what the system believes it sent.
 */
export async function deliver(mail: OutgoingMail): Promise<DeliveryResult> {
  if (emailConfig.provider === "smtp") {
    const info = await smtpTransport().sendMail({
      from: emailConfig.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    });
    return { provider: "smtp", id: info.messageId ?? null };
  }

  if (emailConfig.provider === "resend" && emailConfig.apiKey) {
    const resend = new Resend(emailConfig.apiKey);
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    });
    if (error) throw error;
    return { provider: "resend", id: data?.id ?? null };
  }

  throw new Error("No mail transport is configured.");
}
