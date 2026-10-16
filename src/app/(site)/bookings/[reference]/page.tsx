import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { BookingDetailView } from "@/components/checkout/booking-detail";
import { bookingViewer } from "@/server/bookings/access";
import { cancellationOptions } from "@/server/bookings/cancel";
import { confirmClientPayment } from "@/server/bookings/checkout";
import { getBookingDetailByReference } from "@/server/bookings/queries";

export const instant = false;

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
};

export default function BookingPage({ params, searchParams }: PageProps<"/bookings/[reference]">) {
  return (
    <div className="container-page py-10 lg:py-14">
      <Suspense fallback={<BookingSkeleton />}>
        <Booking params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function BookingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading booking" className="space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-8 h-48 w-full" />
    </div>
  );
}

async function Booking({ params, searchParams }: Pick<PageProps<"/bookings/[reference]">, "params" | "searchParams">) {
  const { reference } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const stripeSession = typeof sp.session_id === "string" ? sp.session_id : undefined;
  if (!/^[A-Z0-9-]{3,16}$/i.test(reference)) notFound();

  let detail = await getBookingDetailByReference(reference);
  if (!detail) notFound();
  const viewer = await bookingViewer(detail.booking, token);
  if (!viewer) notFound();

  // Back from Stripe: confirm straight away instead of waiting for the webhook. Idempotent with it.
  let paidJustNow = false;
  if (stripeSession && detail.booking.status === "pending_payment") {
    paidJustNow = true;
    try {
      const outcome = await confirmClientPayment({ bookingId: detail.booking.id, provider: "stripe", payload: { sessionId: stripeSession }, schedule: (task) => after(task) });
      if (outcome.kind === "confirmed" || outcome.kind === "already_captured") detail = (await getBookingDetailByReference(reference))!;
    } catch (err) {
      console.error(`[booking] stripe return for ${detail.booking.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const cancel = detail.booking.status === "confirmed" ? await cancellationOptions(detail.booking.id) : null;
  return <BookingDetailView detail={detail} token={token} cancel={cancel} paidJustNow={paidJustNow} />;
}
