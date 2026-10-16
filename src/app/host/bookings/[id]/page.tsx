import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PriceBreakdown, Price } from "@/components/ui";
import { PageHeader } from "@/components/host/shell";
import { DetailList, StatusBadge, humanStatus } from "@/components/host/table";
import { cancellationPolicyText } from "@/lib/amenities";
import { formatDate, formatDay } from "@/lib/dates";
import { AccessError, actorOf, requireHostPage } from "@/server/host/access";
import { amountOwed, getHostBooking } from "@/server/host/bookings";

export const instant = false;
export const metadata: Metadata = { title: "Booking" };

export default async function HostBookingPage({ params }: PageProps<"/host/bookings/[id]">) {
  const { id } = await params;
  const viewer = await requireHostPage(`/host/bookings/${id}`);
  const b = await getHostBooking(actorOf(viewer), id).catch((err) => {
    if (err instanceof AccessError) notFound();
    throw err;
  });
  const guests = `${b.adults} ${b.adults === 1 ? "adult" : "adults"}${b.children ? `, ${b.children} ${b.children === 1 ? "child" : "children"}` : ""}`;
  const owed = amountOwed(b);
  const policy = cancellationPolicyText[b.cancellationPolicy];

  return (
    <div className="max-w-4xl">
      <PageHeader title={`Booking ${b.reference}`} back={{ href: "/host/bookings", label: "Bookings" }} actions={<StatusBadge status={b.status} />} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section aria-labelledby="guest">
            <h2 id="guest" className="mb-3 text-lg">
              Guest
            </h2>
            <DetailList
              items={[
                { label: "Name", value: b.guestName },
                {
                  label: "Email",
                  value: b.showContact && b.contactEmail ? (
                    <a className="link" href={`mailto:${b.contactEmail}`}>
                      {b.contactEmail}
                    </a>
                  ) : (
                    <span className="text-slate">Shown while the booking is confirmed</span>
                  ),
                },
                {
                  label: "Phone",
                  value: b.showContact ? (
                    b.contactPhone ? (
                      <a className="link" href={`tel:${b.contactPhone}`}>
                        {b.contactPhone}
                      </a>
                    ) : (
                      <span className="text-slate">Not given</span>
                    )
                  ) : (
                    <span className="text-slate">Shown while the booking is confirmed</span>
                  ),
                },
                { label: "Guests", value: guests },
                ...(b.guestNote ? [{ label: "Note from the guest", value: <span className="whitespace-pre-line">{b.guestNote}</span> }] : []),
              ]}
            />
          </section>
          <section aria-labelledby="stay">
            <h2 id="stay" className="mb-3 text-lg">
              Stay
            </h2>
            <DetailList
              items={[
                { label: "Listing", value: b.listingTitle },
                { label: "Room", value: `${b.units > 1 ? `${b.units} x ` : ""}${b.unitName}` },
                { label: "Check in", value: `${formatDay(b.checkIn)}, from ${b.checkInFrom.slice(0, 5)}` },
                { label: "Check out", value: `${formatDay(b.checkOut)}, by ${b.checkOutUntil.slice(0, 5)}` },
                { label: "Nights", value: b.nights },
                { label: "Cancellation policy", value: policy ? `${policy.label}. ${policy.summary}` : b.cancellationPolicy },
                { label: "Booked", value: b.confirmedAt ? formatDate(b.confirmedAt) : formatDate(b.createdAt) },
                ...(b.cancelledAt ? [{ label: "Cancelled", value: formatDate(b.cancelledAt) }] : []),
              ]}
            />
          </section>
        </div>
        <aside className="space-y-4 self-start">
          <div className="rounded-md border border-line bg-surface p-4">
            <h2 className="text-base">What the guest paid</h2>
            <PriceBreakdown className="mt-3" lines={b.priceLines} currency={b.currency} total={b.total} />
          </div>
          <div className="rounded-md border border-line bg-surface p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="font-semibold">Owed to you</span>
              <Price className="font-bold" money={{ amount: owed, currency: b.currency }} />
            </div>
            <p className="mt-1 text-slate">
              {b.payoutStatus === "paid" && b.payoutPaidAt
                ? `Paid on ${formatDate(b.payoutPaidAt)}.`
                : b.payoutStatus
                  ? `${humanStatus(b.payoutStatus)}${b.payoutReleaseOn ? `, released from ${formatDay(b.payoutReleaseOn)}` : ""}.`
                  : b.status === "confirmed"
                    ? "Paid out after the guest checks in."
                    : "No payout for this booking."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
