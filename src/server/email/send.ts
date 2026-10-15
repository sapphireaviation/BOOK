import "server-only";
import { Resend } from "resend";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { newId } from "@/lib/id";

type Email = { to: string; subject: string; html: string; text: string; template: string };

let resend: Resend | undefined;

/** Sends through Resend when configured, otherwise logs to the console. Never throws. */
export async function sendEmail(email: Email): Promise<{ ok: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Bookings <onboarding@resend.dev>";
  if (!key) {
    console.info(`[email:${email.template}] to=${email.to} subject="${email.subject}"\n${email.text}`);
    await log(email, "logged");
    return { ok: true };
  }
  try {
    resend ??= new Resend(key);
    const res = await resend.emails.send({ from, to: email.to, subject: email.subject, html: email.html, text: email.text });
    if (res.error) {
      await log(email, "failed", undefined, res.error.message);
      return { ok: false };
    }
    await log(email, "sent", res.data?.id);
    return { ok: true };
  } catch (err) {
    await log(email, "failed", undefined, err instanceof Error ? err.message : String(err));
    return { ok: false };
  }
}

async function log(email: Email, status: string, providerId?: string, error?: string) {
  try {
    await db.insert(emailLog).values({ id: newId("eml"), to: email.to, template: email.template, subject: email.subject, status, providerId, error });
  } catch {
    // Logging must never break the caller.
  }
}
