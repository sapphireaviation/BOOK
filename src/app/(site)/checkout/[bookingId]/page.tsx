import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { site } from "@/config/site";
import { ButtonLink, Notice, PriceBreakdown, Skeleton } from "@/components/ui";
import { FlightItinerary, PassengerList, StaySummary, StatusBadge } from "@/components/checkout/booking-summary";
import { HoldCountdown } from "@/components/checkout/countdown";
import { PayPanel } from "@/components/checkout/pay-panel";
import { formatMoney } from "@/lib/money";
import { authorizeBookingById, bookingPath } from "@/server/bookings/access";
import { describeBooking } from "@/server/bookings/checkout";
import { expireIfStale } from "@/server/bookings/expiry";
import { getBookingDetailById } from "@/server/bookings/queries";
import { choosePaymentProvider } from "@/server/payments";

export const instant = false;

export const metadata: Metadata = {
  title: "Review and pay",
  robots: { index: false, follow: false },
};

export default function CheckoutPage({ params, searchParams }: PageProps<"/checkout/[bookingId]">) {
  return (
    <div className="container-page py-10 lg:py-14">
      <Suspense fallback={<CheckoutSkeleton />}>
        <Checkout params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading checkout" className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-8 h-40 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

async function Checkout({ params, searchParams }: Pick<PageProps<"/checkout/[bookingId]">, "params" | "searchParams">) {
  const { bookingId } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;

  const access = await authorizeBookingById(bookingId, token);
  if (!access) notFound();

  await expireIfStale(bookingId);
  const detail = await getBookingDetailById(bookingId);
  if (!detail) notFound();
  const { booking } = detail;
  const manageHref = bookingPath(booking.reference, booking.accessToken);
  const total = formatMoney({ amount: booking.total, currency: booking.currency }, site.defaultLocale);

  if (booking.status !== "pending_payment") {
    return <ClosedCheckout status={booking.status} reference={booking.reference} manageHref={manageHref} isStay={!!detail.stay} />;
  }

  const provider = choosePaymentProvider(booking.currency);
  const lastAttempt = detail.payments[0];
  const lastFailed = lastAttempt?.status === "failed" && lastAttempt.failureReason !== "Booking hold ended before payment" ? lastAttempt : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        <p className="text-sm text-slate">
          Booking <span className="tnum font-semibold text-ink">{booking.reference}</span>
        </p>
        <h1 className="mt-1 text-3xl">Review and pay</h1>
        <p className="mt-2 max-w-prose text-slate">Check the details below. Nothing is booked until the payment goes through.</p>

        <div className="mt-8 border-t border-line pt-6">
          {detail.stay && <StaySummary stay={detail.stay} showHostContact={false} />}
          {detail.flight && <FlightItinerary flight={detail.flight} />}
        </div>

        {detail.flight && (
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-lg">Passengers</h2>
            <div className="mt-2">
              <PassengerList passengers={detail.flight.passengers} />
            </div>
            <p className="mt-3 text-sm text-slate">Names must match each passport or ID exactly. The airline may refuse boarding if they do not.</p>
          </div>
        )}

        <div className="mt-8 border-t border-line pt-6">
          <h2 className="text-lg">Booking contact</h2>
          <p className="mt-2 text-sm">
            {booking.contactName}
            <br />
            {booking.contactEmail}
            {booking.contactPhone && (
              <>
                <br />
                {booking.contactPhone}
              </>
            )}
          </p>
          <p className="mt-2 text-sm text-slate">We send the confirmation to this email.</p>
        </div>
      </div>

      <aside aria-label="Payment" className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-md border border-line bg-surface p-6 shadow-[var(--shadow-float)]">
          <h2 className="text-lg">Price</h2>
          <PriceBreakdown lines={booking.priceLines} currency={booking.currency} total={booking.total} className="mt-4" />
          <p className="mt-3 text-xs text-slate">
            {detail.stay ? "The full amount goes to the host." : "This is the airline's own fare. We add nothing."}
          </p>

          <div className="mt-6 border-t border-line pt-5">
            {booking.expiresAt && <HoldCountdown expiresAt={booking.expiresAt.toISOString()} className="mb-4" />}

            {lastFailed && (
              <Notice tone="bad" title="Your last payment did not go through" className="mb-4">
                {lastFailed.failureReason ?? "The payment was declined."} You can try again.
              </Notice>
            )}

            {provider ? (
              <PayPanel
                bookingId={booking.id}
                token={token}
                provider={provider}
                amountLabel={total}
                siteName={site.name}
                description={describeBooking(detail)}
                prefill={{ name: booking.contactName, email: booking.contactEmail, phone: booking.contactPhone }}
                expiresAt={booking.expiresAt?.toISOString() ?? null}
              />
            ) : (
              <Notice tone="info" title="Payments are not connected yet">
                This booking cannot be paid online right now and nothing has been charged. Write to{" "}
                <a className="link" href={`mailto:${site.supportEmail}`}>
                  {site.supportEmail}
                </a>{" "}
                with reference {booking.reference} and we will help.
              </Notice>
            )}
          </div>
        </div>
        <StatusLine />
      </aside>
    </div>
  );
}

function StatusLine() {
  return <p className="mt-4 text-xs text-slate">Payments are encrypted by the payment provider. We never see or store card numbers.</p>;
}

function ClosedCheckout({ status, reference, manageHref, isStay }: { status: string; reference: string; manageHref: string; isStay: boolean }) {
  const startAgain = isStay ? "/stays" : "/flights";
  const content: Record<string, { title: string; body: string; action: React.ReactNode }> = {
    confirmed: {
      title: "This booking is already paid",
      body: "There is nothing more to pay. Your booking details and confirmation are on the booking page.",
      action: <ButtonLink href={manageHref}>View booking</ButtonLink>,
    },
    completed: {
      title: "This booking is already paid",
      body: "This trip has already happened.",
      action: <ButtonLink href={manageHref}>View booking</ButtonLink>,
    },
    expired: {
      title: "The hold on this booking has ended",
      body: isStay
        ? "We hold a room for 20 minutes while you pay. That time has passed and the dates were released. Start again to check they are still free."
        : "We hold a fare for up to 20 minutes while you pay. That time has passed. Search again to see current fares.",
      action: <ButtonLink href={startAgain}>{isStay ? "Find a stay" : "Search flights"}</ButtonLink>,
    },
    failed: {
      title: "This booking did not go through",
      body: "If you were charged, the full amount is refunded automatically. The booking page shows the details.",
      action: <ButtonLink href={manageHref}>View booking</ButtonLink>,
    },
    cancelled: {
      title: "This booking is cancelled",
      body: "It can no longer be paid.",
      action: <ButtonLink href={manageHref}>View booking</ButtonLink>,
    },
    refunded: {
      title: "This booking is cancelled",
      body: "It can no longer be paid.",
      action: <ButtonLink href={manageHref}>View booking</ButtonLink>,
    },
  };
  const c = content[status] ?? content.cancelled;
  return (
    <div className="max-w-xl">
      <p className="text-sm text-slate">
        Booking <span className="tnum font-semibold text-ink">{reference}</span>
      </p>
      <h1 className="mt-1 text-3xl">{c.title}</h1>
      <div className="mt-3">
        <StatusBadge status={status as Parameters<typeof StatusBadge>[0]["status"]} />
      </div>
      <p className="mt-4 text-slate">{c.body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {c.action}
        <Link href="/" className="link text-sm">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
