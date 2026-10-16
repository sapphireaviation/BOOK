import "server-only";
import { absoluteUrl, site } from "@/config/site";
import { formatDate, formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { BookingDetail } from "@/server/bookings/queries";
import { policySummary } from "@/server/bookings/policy";

export type EmailContent = { subject: string; html: string; text: string };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function money(amount: number, currency: string) {
  return formatMoney({ amount, currency }, site.defaultLocale);
}

export function bookingLink(detail: Pick<BookingDetail, "booking">) {
  return absoluteUrl(`/bookings/${detail.booking.reference}?token=${encodeURIComponent(detail.booking.accessToken)}`);
}

type Row = [label: string, value: string];

/** Plain, readable HTML. One column, system fonts, no images. */
function layout(input: { heading: string; intro: string[]; rows?: Row[]; button?: { label: string; href: string }; outro?: string[] }) {
  const p = (t: string) => `<p style="margin:0 0 14px">${esc(t)}</p>`;
  const rows = input.rows?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 20px">${input.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #d9e0e8;color:#5b6b7f;vertical-align:top;width:40%">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #d9e0e8;vertical-align:top">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const button = input.button
    ? `<p style="margin:8px 0 24px"><a href="${esc(input.button.href)}" style="display:inline-block;background:#1b3fab;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${esc(input.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f9fb;color:#0e1a2b;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d9e0e8;border-radius:8px;padding:28px">
<p style="margin:0 0 20px;font-weight:800">${esc(site.name)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${esc(input.heading)}</h1>
${input.intro.map(p).join("")}${rows}${button}${(input.outro ?? []).map(p).join("")}
<p style="margin:24px 0 0;color:#5b6b7f;font-size:14px">Questions? Reply to this email or write to ${esc(site.supportEmail)}.<br>${esc(site.legalName)}</p>
</div></body></html>`;

  const text = [
    input.heading,
    "",
    ...input.intro,
    "",
    ...(input.rows ?? []).map(([k, v]) => `${k}: ${v.replace(/\n/g, ", ")}`),
    ...(input.button ? ["", `${input.button.label}: ${input.button.href}`] : []),
    ...(input.outro?.length ? ["", ...input.outro] : []),
    "",
    `Questions? Reply to this email or write to ${site.supportEmail}.`,
    site.legalName,
  ].join("\n");
  return { html, text };
}

function stayRows(detail: BookingDetail): Row[] {
  const s = detail.stay!;
  const b = detail.booking;
  const guests = `${s.adults} ${s.adults === 1 ? "adult" : "adults"}${s.children ? `, ${s.children} ${s.children === 1 ? "child" : "children"}` : ""}`;
  return [
    ["Reference", b.reference],
    ["Stay", `${s.listing.title}\n${s.unitName}${s.units > 1 ? ` (${s.units} units)` : ""}`],
    ["Check in", `${formatDay(s.checkIn)} ${formatDate(s.checkIn).slice(-4)}, from ${s.listing.checkInFrom.slice(0, 5)}`],
    ["Check out", `${formatDay(s.checkOut)} ${formatDate(s.checkOut).slice(-4)}, by ${s.listing.checkOutUntil.slice(0, 5)}`],
    ["Guests", guests],
    ["Total paid", money(b.total, b.currency)],
  ];
}

function address(detail: BookingDetail) {
  const l = detail.stay!.listing;
  return [l.addressLine, l.locality, l.city, l.region, l.postalCode].filter(Boolean).join(", ");
}

type Slice = { origin?: { iata?: string; city?: string }; destination?: { iata?: string; city?: string }; departAt?: string; arriveAt?: string; segments?: { flightNumber?: string }[] };

function flightRows(detail: BookingDetail): Row[] {
  const f = detail.flight!;
  const b = detail.booking;
  const slices = (f.slices as Slice[]).map((sl) => {
    const numbers = (sl.segments ?? []).map((seg) => seg.flightNumber).filter(Boolean).join(", ");
    // Airline times are local to the airport and carry no offset, so read the wall clock straight from the string.
    const when = sl.departAt ? `${formatDay(sl.departAt.slice(0, 10))} ${sl.departAt.slice(11, 16)}` : "";
    return `${sl.origin?.iata ?? ""} to ${sl.destination?.iata ?? ""}, ${when}${numbers ? ` (${numbers})` : ""}`;
  });
  return [
    ["Reference", b.reference],
    ...(f.airlineReference ? ([["Airline reference", f.airlineReference]] as Row[]) : []),
    ["Flights", slices.join("\n") || `${f.origin} to ${f.destination}`],
    ["Passengers", f.passengers.map((p) => `${p.givenName} ${p.familyName}`).join("\n")],
    ["Total paid", money(b.total, b.currency)],
  ];
}

export function bookingConfirmedEmail(detail: BookingDetail): EmailContent {
  const b = detail.booking;
  if (detail.stay) {
    const s = detail.stay;
    const hostPhone = s.listing.contactPhone ?? s.host.phone;
    const hostEmail = s.listing.contactEmail ?? s.host.email;
    const { html, text } = layout({
      heading: `Your stay at ${s.listing.title} is booked`,
      intro: [`Hi ${b.contactName}, your booking is confirmed and paid. The host has your details and expects you.`],
      rows: [
        ...stayRows(detail),
        ["Address", address(detail)],
        ["Host", [s.host.name, hostPhone, hostEmail].filter(Boolean).join("\n")],
        ["Cancellation", policySummary(s.cancellationPolicy)],
      ],
      button: { label: "View booking", href: bookingLink(detail) },
      outro: ["You paid no platform fee. The full amount goes to the host."],
    });
    return { subject: `Booking confirmed: ${s.listing.title}, ${formatDay(s.checkIn)}`, html, text };
  }
  const f = detail.flight!;
  const { html, text } = layout({
    heading: `Your flight from ${f.origin} to ${f.destination} is booked`,
    intro: [
      `Hi ${b.contactName}, the airline has confirmed your booking.`,
      f.airlineReference ? `Use the airline reference ${f.airlineReference} to check in and manage seats on the airline's website.` : "",
    ].filter(Boolean),
    rows: flightRows(detail),
    button: { label: "View booking", href: bookingLink(detail) },
    outro: ["You paid the airline's fare with no platform fee added."],
  });
  return { subject: `Flight booked: ${f.origin} to ${f.destination}, ${formatDay(f.departAt)}`, html, text };
}

export function hostNewBookingEmail(detail: BookingDetail): EmailContent {
  const b = detail.booking;
  const s = detail.stay!;
  const { html, text } = layout({
    heading: `New booking for ${s.listing.title}`,
    intro: [`${b.contactName} booked ${s.unitName} and paid in full. You receive the whole amount; we keep nothing.`],
    rows: [
      ...stayRows(detail).map(([k, v]): Row => (k === "Total paid" ? ["Your payout", v] : [k, v])),
      ["Guest", [b.contactName, b.contactEmail, b.contactPhone].filter(Boolean).join("\n")],
      ...(s.guestNote ? ([["Note from guest", s.guestNote]] as Row[]) : []),
    ],
    button: { label: "Open host dashboard", href: absoluteUrl("/host") },
    outro: ["The payout is released the day after check in."],
  });
  return { subject: `New booking ${b.reference}: ${formatDay(s.checkIn)} to ${formatDay(s.checkOut)}`, html, text };
}

export function bookingCancelledEmail(detail: BookingDetail, refund: { amount: number; explanation: string }): EmailContent {
  const b = detail.booking;
  const what = detail.stay ? detail.stay.listing.title : `${detail.flight!.origin} to ${detail.flight!.destination}`;
  const refundLine = refund.amount > 0
    ? `We are refunding ${money(refund.amount, b.currency)} to the card or account you paid with. Banks usually show it within 5 to 7 working days.`
    : "There is no refund for this cancellation.";
  const { html, text } = layout({
    heading: `Booking ${b.reference} is cancelled`,
    intro: [`Hi ${b.contactName}, your booking for ${what} is cancelled.`, refundLine, refund.explanation],
    rows: detail.stay ? stayRows(detail) : flightRows(detail),
    button: { label: "View booking", href: bookingLink(detail) },
  });
  return { subject: `Booking cancelled: ${b.reference}`, html, text };
}

export function hostBookingCancelledEmail(detail: BookingDetail, payoutAmount: number): EmailContent {
  const b = detail.booking;
  const s = detail.stay!;
  const { html, text } = layout({
    heading: `Booking ${b.reference} was cancelled`,
    intro: [
      `The booking from ${b.contactName} for ${s.unitName} is cancelled and the dates are open again.`,
      payoutAmount > 0 ? `Under your cancellation policy you still receive ${money(payoutAmount, b.currency)}.` : "There is no payout for this booking.",
    ],
    rows: stayRows(detail).filter(([k]) => k !== "Total paid"),
    button: { label: "Open host dashboard", href: absoluteUrl("/host") },
  });
  return { subject: `Booking cancelled: ${b.reference}, ${formatDay(s.checkIn)}`, html, text };
}

export function flightTicketingFailedEmail(detail: BookingDetail, refundAmount: number): EmailContent {
  const b = detail.booking;
  const f = detail.flight!;
  const { html, text } = layout({
    heading: "We could not book your flight",
    intro: [
      `Hi ${b.contactName}, your payment went through but the airline did not confirm the booking for ${f.origin} to ${f.destination}. You do not have a ticket.`,
      `We are refunding the full ${money(refundAmount, b.currency)} to the card or account you paid with. Banks usually show it within 5 to 7 working days.`,
      "Fares change quickly, so search again to see what is available now.",
    ],
    rows: [["Reference", b.reference], ["Refund", money(refundAmount, b.currency)]],
    button: { label: "Search flights", href: absoluteUrl("/flights") },
  });
  return { subject: `Flight not booked, full refund on the way: ${b.reference}`, html, text };
}

/** A payment we could not use: it arrived after the hold ended, or the booking was already paid. */
export function paymentRefundedEmail(detail: BookingDetail, refundAmount: number, reason: "late" | "duplicate" | "mismatch"): EmailContent {
  const b = detail.booking;
  const why = {
    late: `we received your payment for booking ${b.reference} after its hold had ended, so this payment did not confirm a booking.`,
    duplicate: `booking ${b.reference} was already paid, so we received a second payment for it.`,
    mismatch: `the payment for booking ${b.reference} did not match the booking total, so we could not use it.`,
  }[reason];
  const { html, text } = layout({
    heading: reason === "duplicate" ? "You paid twice, so we are refunding one payment" : "We are refunding your payment",
    intro: [`Hi ${b.contactName}, ${why}`, `We are refunding the full ${money(refundAmount, b.currency)}. Banks usually show it within 5 to 7 working days.`],
    rows: [["Reference", b.reference], ["Refund", money(refundAmount, b.currency)]],
    button: reason === "duplicate" ? { label: "View booking", href: bookingLink(detail) } : { label: detail.stay ? "Find a stay" : "Search flights", href: absoluteUrl(detail.stay ? "/stays" : "/flights") },
  });
  return { subject: `Payment refunded: ${b.reference}`, html, text };
}
