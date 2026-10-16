import Link from "next/link";
import { site } from "@/config/site";
import { ButtonLink, Notice, PriceBreakdown, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { BookingDetail } from "@/server/bookings/queries";
import { policyLabel, policySummary } from "@/server/bookings/policy";
import { CancelBooking } from "./cancel-booking";
import { FlightItinerary, PassengerList, StatusBadge, StaySummary, longDay } from "./booking-summary";

export type CancelOptions = { refundAmount: number; currency: string; policy: string; explanation: string; travelerCanCancel: boolean };

function money(amount: number, currency: string) {
  return formatMoney({ amount, currency }, site.defaultLocale);
}

function headline(detail: BookingDetail) {
  const { booking, stay, flight } = detail;
  const what = stay ? stay.listing.title : `${flight!.origin} to ${flight!.destination}`;
  switch (booking.status) {
    case "confirmed":
      return stay ? "Your stay is booked" : flight!.airlineReference ? "Your flight is booked" : `Payment received for ${what}`;
    case "completed":
      return stay ? `Your stay at ${what}` : `Your flight ${what}`;
    case "pending_payment":
      return `Finish paying for ${what}`;
    case "cancelled":
    case "refunded":
      return `Booking for ${what} is cancelled`;
    case "expired":
      return `The hold for ${what} ended`;
    case "failed":
      return stay ? `Booking for ${what} did not go through` : `We could not book ${what}`;
    default:
      return what;
  }
}

/** Status specific message under the headline. */
function StatusNotice({ detail, checkoutHref, paidJustNow }: { detail: BookingDetail; checkoutHref: string; paidJustNow: boolean }) {
  const { booking, flight } = detail;
  const ticketing = (booking.meta as { ticketing?: string }).ticketing;
  const refundTotal = detail.refunds.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amount, 0);

  if (booking.status === "pending_payment") {
    if (paidJustNow) {
      return (
        <Notice tone="info" title="Confirming your payment">
          We are waiting for the payment provider to confirm. This usually takes a few seconds. Reload this page in a moment.
        </Notice>
      );
    }
    return (
      <Notice tone="info" title="Not paid yet">
        This booking is held but not paid.{" "}
        <Link className="link" href={checkoutHref}>
          Go to payment
        </Link>
      </Notice>
    );
  }
  if (booking.status === "confirmed" && flight && !flight.airlineReference) {
    return (
      <Notice tone="info" title={ticketing === "in_progress" ? "Booking with the airline" : "Payment received"}>
        Your payment went through and we are confirming the ticket with the airline. You get an email with the airline reference as soon as it is issued. Reload this page to check.
      </Notice>
    );
  }
  if (booking.status === "confirmed") {
    return (
      <Notice tone="good">
        We sent the confirmation to {booking.contactEmail}.
      </Notice>
    );
  }
  if (booking.status === "failed") {
    return (
      <Notice tone="bad" title={flight ? "The airline did not issue a ticket" : "Booking not completed"}>
        {refundTotal > 0
          ? `We are refunding ${money(refundTotal, booking.currency)} in full to the account you paid with. Banks usually show it within 5 to 7 working days.`
          : "You were not charged for this booking."}
      </Notice>
    );
  }
  if (booking.status === "cancelled" || booking.status === "refunded") {
    const pending = detail.refunds.some((r) => r.status === "pending");
    return (
      <Notice tone="info" title={booking.status === "refunded" ? "Cancelled and refunded" : "Cancelled"}>
        {booking.cancelledAt ? `Cancelled on ${formatDate(booking.cancelledAt)}. ` : ""}
        {refundTotal > 0
          ? `${pending ? "A refund of" : "We refunded"} ${money(refundTotal, booking.currency)}${pending ? " is on its way to the account you paid with." : " to the account you paid with."}`
          : "There was no refund for this cancellation."}
      </Notice>
    );
  }
  if (booking.status === "expired") {
    return (
      <Notice tone="info" title="Not booked">
        The hold ended before payment, so nothing was booked and nothing was charged.
      </Notice>
    );
  }
  return null;
}

export function BookingDetailView({
  detail,
  token,
  cancel,
  paidJustNow = false,
}: {
  detail: BookingDetail;
  /** Token for links and actions. Signed in owners can pass undefined. */
  token?: string;
  cancel: CancelOptions | null;
  paidJustNow?: boolean;
}) {
  const { booking, stay, flight } = detail;
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  const checkoutHref = `/checkout/${booking.id}${q}`;
  const calendarHref = `/bookings/${booking.reference}/calendar${q}`;
  const live = booking.status === "confirmed" || booking.status === "completed";
  const canCancel = booking.status === "confirmed" && cancel?.travelerCanCancel;
  const paid = detail.payments.find((p) => ["captured", "partially_refunded", "refunded"].includes(p.status));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate">
            Booking <span className="tnum font-semibold text-ink">{booking.reference}</span>
          </p>
          <StatusBadge status={booking.status} />
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl">{headline(detail)}</h1>
        <div className="mt-5 max-w-2xl">
          <StatusNotice detail={detail} checkoutHref={checkoutHref} paidJustNow={paidJustNow} />
        </div>

        {flight?.airlineReference && (
          <div className="mt-8">
            <p className="text-sm text-slate">Airline reference</p>
            <p className="tnum text-2xl font-extrabold">{flight.airlineReference}</p>
            <p className="mt-1 text-sm text-slate">Use it to check in and choose seats on the airline&apos;s website.</p>
          </div>
        )}

        <div className="mt-8 border-t border-line pt-6">
          {stay && <StaySummary stay={stay} showHostContact={live} />}
          {flight && <FlightItinerary flight={flight} />}
        </div>

        {flight && (
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-lg">Passengers</h2>
            <div className="mt-2">
              <PassengerList passengers={flight.passengers} />
            </div>
          </div>
        )}

        {live && (
          <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6">
            <a href={calendarHref} className={buttonClass({ variant: "secondary" })} download>
              Add to calendar
            </a>
            {stay && (
              <a
                className={buttonClass({ variant: "secondary" })}
                href={`https://www.openstreetmap.org/?mlat=${stay.listing.lat}&mlon=${stay.listing.lng}#map=16/${stay.listing.lat}/${stay.listing.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Open map
              </a>
            )}
          </div>
        )}

        <section aria-labelledby="cancellation-h" className="mt-8 border-t border-line pt-6">
          <h2 id="cancellation-h" className="text-lg">
            Cancellation
          </h2>
          {stay && (
            <p className="mt-2 max-w-prose text-sm">
              <span className="font-semibold">{policyLabel(stay.cancellationPolicy)}.</span> {policySummary(stay.cancellationPolicy)} The days count back from
              check in at {stay.listing.checkInFrom.slice(0, 5)} on {longDay(stay.checkIn)}.
            </p>
          )}
          {flight && cancel && <p className="mt-2 max-w-prose text-sm">{cancel.policy}. The airline&apos;s fare rules decide any refund.</p>}

          {booking.status === "confirmed" && cancel && !cancel.travelerCanCancel && <p className="mt-3 max-w-prose text-sm text-slate">{cancel.explanation}</p>}
          {canCancel && cancel && (
            <div className="mt-4">
              <CancelBooking
                bookingId={booking.id}
                token={token}
                preview={{
                  refundLabel: money(cancel.refundAmount, cancel.currency),
                  refundIsZero: cancel.refundAmount === 0,
                  policy: cancel.policy,
                  explanation: cancel.explanation,
                }}
              />
            </div>
          )}
          {booking.status === "completed" && <p className="mt-3 text-sm text-slate">This trip has already happened, so it can no longer be cancelled.</p>}
        </section>
      </div>

      <aside aria-label="Payment summary" className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-md border border-line bg-surface p-6">
          <h2 className="text-lg">Payment</h2>
          <PriceBreakdown lines={booking.priceLines} currency={booking.currency} total={booking.total} className="mt-4" />
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            {paid && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate">Paid</dt>
                <dd>{formatDate(paid.updatedAt)}</dd>
              </div>
            )}
            {detail.refunds
              .filter((r) => r.status !== "failed")
              .map((r) => (
                <div key={r.id} className="flex justify-between gap-4">
                  <dt className="text-slate">{r.status === "processed" ? "Refunded" : "Refund on its way"}</dt>
                  <dd className="tnum">{money(r.amount, r.currency)}</dd>
                </div>
              ))}
          </dl>
          {booking.status === "pending_payment" && !paidJustNow && (
            <ButtonLink href={checkoutHref} className="mt-5 w-full">
              Pay {money(booking.total, booking.currency)}
            </ButtonLink>
          )}
        </div>
        <p className="mt-4 text-xs text-slate">
          Questions about this booking? Write to{" "}
          <a className="link" href={`mailto:${site.supportEmail}?subject=${encodeURIComponent(`Booking ${booking.reference}`)}`}>
            {site.supportEmail}
          </a>{" "}
          and include the reference.
        </p>
      </aside>
    </div>
  );
}
