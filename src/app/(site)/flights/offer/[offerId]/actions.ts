"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BookingFormState } from "@/components/flights/booking-state";
import { lastTravelDate } from "@/components/flights/format";
import {
  fieldName,
  normalizePhone,
  validateContact,
  validateInfantRatio,
  validatePassenger,
  type PassengerFields,
  type PassengerKind,
} from "@/components/flights/passenger-rules";
import { site } from "@/config/site";
import { getSession } from "@/server/auth";
import { createFlightBooking } from "@/server/bookings";
import { BookingError } from "@/server/bookings/types";
import { getOffer } from "@/server/flights";
import { FlightsNotConfiguredError, OfferExpiredError, type Offer, type PassengerInput } from "@/server/flights/types";

const offerIdSchema = z.string().min(3).max(1000).regex(/^[A-Za-z0-9_.-]+$/);

const bookingErrorMessages: Record<BookingError["code"], string> = {
  unavailable: "The airline has no seats left at this fare. Search again to see what is available.",
  price_changed: "The airline changed the price of this fare. Check the new total and continue if it still works for you.",
  offer_expired: "This fare is no longer available. Search again to see current fares.",
  invalid: "Some booking details were not accepted. Check them and try again.",
  not_found: "We could not find this fare. Search again to see current fares.",
  forbidden: "Sign in to book this fare.",
  not_configured: "Online payment is not set up yet, so flights cannot be booked right now. Nothing has been charged.",
};

const GENERIC = "We could not start your booking just now. Nothing has been charged. Try again in a minute.";

function text(fd: FormData, name: string, max = 120) {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function kindsOf(offer: Offer): PassengerKind[] {
  return offer.passengers?.length ? offer.passengers.map((p) => p.type) : offer.passengerIds.map(() => "adult");
}

/**
 * Validates traveler details against the fresh offer, then hands over to the bookings service,
 * which re-prices on the server and creates the pending booking. Redirects to the payment page.
 */
export async function startFlightBooking(offerId: string, _prev: BookingFormState, fd: FormData): Promise<BookingFormState> {
  const values: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && /^(p\d{1,2}_\w+|contact_\w+)$/.test(k)) values[k] = v.slice(0, 120);

  const id = offerIdSchema.safeParse(offerId);
  if (!id.success) return { errors: {}, values, expired: true };

  let offer: Offer;
  try {
    offer = await getOffer(id.data);
  } catch (err) {
    if (err instanceof OfferExpiredError) return { errors: {}, values, expired: true, formError: err.message };
    if (err instanceof FlightsNotConfiguredError) return { errors: {}, values, formError: "Flight booking is not connected yet. Nothing has been charged." };
    console.error("getOffer failed in startFlightBooking", err);
    return { errors: {}, values, formError: "We could not check this fare with the airline just now. Try again in a minute." };
  }

  const kinds = kindsOf(offer);
  const ctx = { travelDate: lastTravelDate(offer), today: new Date().toISOString().slice(0, 10), requiresPassport: offer.requiresPassport };
  const errors: Record<string, string> = {};
  const fields: PassengerFields[] = kinds.map((_, i) => ({
    title: text(fd, fieldName(i, "title"), 8),
    givenName: text(fd, fieldName(i, "givenName"), 40),
    familyName: text(fd, fieldName(i, "familyName"), 40),
    bornOn: text(fd, fieldName(i, "bornOn"), 10),
    gender: text(fd, fieldName(i, "gender"), 1),
    passportNumber: text(fd, fieldName(i, "passportNumber"), 30).replace(/\s/g, "").toUpperCase(),
    passportCountry: text(fd, fieldName(i, "passportCountry"), 2).toUpperCase(),
    passportExpiry: text(fd, fieldName(i, "passportExpiry"), 10),
  }));
  fields.forEach((p, i) => Object.assign(errors, validatePassenger(i, kinds[i], p, ctx)));
  const contact = { name: text(fd, "contact_name"), email: text(fd, "contact_email", 254).toLowerCase(), phone: text(fd, "contact_phone", 30) };
  Object.assign(errors, validateContact(contact));
  const ratio = validateInfantRatio(kinds);
  if (ratio) return { errors, values, formError: `${ratio} Search again with the right number of adults.` };
  if (Object.keys(errors).length) return { errors, values };

  const phone = normalizePhone(contact.phone);
  const passengers: PassengerInput[] = fields.map((p, i) => ({
    id: offer.passengerIds[i],
    type: kinds[i],
    title: p.title as PassengerInput["title"],
    givenName: p.givenName,
    familyName: p.familyName,
    bornOn: p.bornOn,
    gender: p.gender as PassengerInput["gender"],
    email: contact.email,
    phone,
    ...(offer.requiresPassport
      ? { identityDocument: { type: "passport" as const, number: p.passportNumber!, issuingCountryCode: p.passportCountry!, expiresOn: p.passportExpiry! } }
      : {}),
  }));

  let userId: string | null = null;
  try {
    userId = (await getSession())?.user.id ?? null;
  } catch {
    userId = null;
  }

  let payUrl: string;
  try {
    const created = await createFlightBooking({ userId, contact: { name: contact.name, email: contact.email, phone }, offerId: offer.id, passengers });
    payUrl = created.payUrl;
  } catch (err) {
    if (err instanceof OfferExpiredError) return { errors: {}, values, expired: true, formError: err.message };
    if (err instanceof BookingError) {
      if (err.code === "offer_expired" || err.code === "not_found") return { errors: {}, values, expired: true, formError: bookingErrorMessages[err.code] };
      // A new price is shown on the refreshed page above the form.
      if (err.code === "price_changed") refresh();
      return { errors: {}, values, formError: bookingErrorMessages[err.code] ?? GENERIC };
    }
    console.error("createFlightBooking failed", err);
    return { errors: {}, values, formError: GENERIC };
  }

  // Only ever follow a path on this site.
  if (payUrl.startsWith(site.url + "/")) payUrl = payUrl.slice(site.url.length);
  if (!payUrl.startsWith("/") || payUrl.startsWith("//")) {
    console.error("createFlightBooking returned an unexpected payUrl", payUrl);
    return { errors: {}, values, formError: GENERIC };
  }
  redirect(payUrl);
}
