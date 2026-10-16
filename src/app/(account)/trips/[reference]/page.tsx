import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { BookingDetailView } from "@/components/checkout/booking-detail";
import { AuthError, requireUser } from "@/server/auth";
import { cancellationOptions } from "@/server/bookings/cancel";
import { getBookingDetailByReference } from "@/server/bookings/queries";

export const instant = false;

export const metadata: Metadata = {
  title: "Trip",
  robots: { index: false, follow: false },
};

export default function TripPage({ params }: PageProps<"/trips/[reference]">) {
  return (
    <div className="container-page py-10 lg:py-14">
      <Link href="/trips" className="link text-sm">
        All trips
      </Link>
      <div className="mt-6">
        <Suspense
          fallback={
            <div aria-busy="true" aria-label="Loading trip" className="space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-48 w-full" />
            </div>
          }
        >
          <Trip params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Trip({ params }: Pick<PageProps<"/trips/[reference]">, "params">) {
  const { reference } = await params;
  let session: Awaited<ReturnType<typeof requireUser>> | null = null;
  try {
    session = await requireUser();
  } catch (err) {
    if (!(err instanceof AuthError)) throw err;
  }
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/trips/${reference}`)}`);
  if (!/^[A-Z0-9-]{3,16}$/i.test(reference)) notFound();

  const detail = await getBookingDetailByReference(reference);
  // Only the owner (or an admin) sees a trip here. Anyone else gets the same 404 as a missing booking.
  if (!detail || (detail.booking.userId !== session.user.id && session.role !== "admin")) notFound();

  const cancel = detail.booking.status === "confirmed" ? await cancellationOptions(detail.booking.id) : null;
  return <BookingDetailView detail={detail} cancel={cancel} />;
}
