"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isISODate } from "@/lib/dates";
import { getSession } from "@/server/auth";
import { createStayBooking } from "@/server/bookings";
import { BookingError } from "@/server/bookings/types";
import { quoteStay } from "@/server/stays/inventory";
import { explainPolicy } from "@/server/stays/policy";
import type { StayQuote } from "@/server/stays/types";
import { setSaved } from "@/server/stays/wishlist";

const isoDate = z.string().refine(isISODate, "Use a date like 2026-10-24");

const quoteInput = z.object({
  listingId: z.string().min(1).max(64),
  unitId: z.string().min(1).max(64),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: z.number().int().min(1).max(16),
  children: z.number().int().min(0).max(10),
  units: z.number().int().min(1).max(8),
  cancellationPolicy: z.string().max(32).optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export type QuoteResult = { quote: StayQuote; policySteps: string[] | null };

/** Prices the chosen dates for the booking panel. The server is the only source of the amounts. */
export async function quoteAction(input: z.input<typeof quoteInput>): Promise<QuoteResult> {
  const parsed = quoteInput.safeParse(input);
  if (!parsed.success) return { quote: { available: false, reason: "Pick check in and check out dates." }, policySteps: null };
  const { cancellationPolicy, checkInTime, ...q } = parsed.data;
  const quote = await quoteStay(q);
  const policySteps = cancellationPolicy ? explainPolicy(cancellationPolicy, q.checkIn, checkInTime).steps : null;
  return { quote, policySteps };
}

function safeReturnPath(path: unknown) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && path.length < 500 ? path : "/saved";
}

/** Saves or unsaves a listing. Signed out visitors are sent to sign in and brought back. */
export async function setSavedAction(listingId: string, saved: boolean, returnTo: string): Promise<{ saved: boolean } | { error: string }> {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(safeReturnPath(returnTo))}`);
  const id = z.string().min(1).max(64).safeParse(listingId);
  if (!id.success) return { error: "We could not find that place." };
  const result = await setSaved(session.user.id, id.data, Boolean(saved));
  if (result === null) return { error: "We could not find that place." };
  return { saved: result };
}

const bookingForm = z.object({
  listingId: z.string().min(1).max(64),
  unitId: z.string().min(1).max(64),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: z.coerce.number().int().min(1).max(16),
  children: z.coerce.number().int().min(0).max(10),
  units: z.coerce.number().int().min(1).max(8),
  name: z.string().trim().min(2, "Enter the name of the person staying.").max(120, "Use a shorter name."),
  email: z.string().trim().toLowerCase().email("Enter an email address like name@example.com.").max(254),
  phone: z
    .string()
    .trim()
    .max(24)
    .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a phone number with the country code, like +91 98765 43210.")
    .optional(),
  note: z.string().trim().max(1000, "Keep the note under 1,000 characters.").optional(),
});

export type BookingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "phone" | "note", string>>;
  values?: { name: string; email: string; phone: string; note: string };
};

const bookingErrorMessages: Record<BookingError["code"], string> = {
  unavailable: "Those dates are no longer free for this room. Pick other dates or another room.",
  price_changed: "The price changed while you were booking. Check the new total below and try again.",
  offer_expired: "This price has expired. Check the total below and try again.",
  invalid: "Some booking details are not valid. Check the dates and guests, then try again.",
  not_found: "This place is no longer taking bookings.",
  forbidden: "This account cannot book this place. Sign in with another account or contact support.",
  rate_limited: "Too many booking attempts from this connection. Wait a minute and try again.",
  not_configured: "Bookings cannot be paid for right now because payments are not set up. Nothing was charged.",
};

/** Starts a booking and sends the guest to pay. Every amount is recomputed by the bookings service. */
export async function bookStayAction(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const raw = Object.fromEntries(formData.entries());
  const values = {
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""),
    note: String(raw.note ?? ""),
  };
  const parsed = bookingForm.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: BookingFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "name" || key === "email" || key === "phone" || key === "note") && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return Object.keys(fieldErrors).length
      ? { fieldErrors, values }
      : { error: "The dates or guests in this link are not valid. Go back to the listing and choose them again.", values };
  }

  const d = parsed.data;
  const session = await getSession();
  let payUrl: string;
  try {
    const created = await createStayBooking({
      userId: session?.user.id ?? null,
      contact: { name: d.name, email: d.email, phone: d.phone || undefined },
      listingId: d.listingId,
      unitId: d.unitId,
      checkIn: d.checkIn,
      checkOut: d.checkOut,
      adults: d.adults,
      children: d.children,
      units: d.units,
      guestNote: d.note || undefined,
    });
    payUrl = created.payUrl;
  } catch (err) {
    if (err instanceof BookingError) return { error: bookingErrorMessages[err.code] ?? bookingErrorMessages.invalid, values };
    console.error("createStayBooking failed", err);
    return { error: "We could not start this booking. Nothing was charged. Try again in a minute.", values };
  }
  redirect(payUrl);
}
