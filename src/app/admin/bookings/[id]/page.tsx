import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price, PriceBreakdown } from "@/components/ui";
import { CancelBookingForm } from "@/components/admin/cancel-booking-form";
import { PageHeader } from "@/components/host/shell";
import { DetailList, humanStatus, StatusBadge, Table, Td, Th } from "@/components/host/table";
import { cancellationPolicyText } from "@/lib/amenities";
import { formatDate, formatDay, formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { CANCELLABLE, getBookingForAdmin } from "@/server/admin/bookings";
import { AccessError, requireAdminPage } from "@/server/host/access";

export const instant = false;
export const metadata: Metadata = { title: "Booking" };

const PROVIDERS: Record<string, string> = { razorpay: "Razorpay", stripe: "Stripe", test: "Test payments", duffel: "Duffel" };

function providerName(p: string) {
  return PROVIDERS[p] ?? humanStatus(p);
}

function dateTime(d: Date) {
  return `${formatDate(d)}, ${formatTime(d.toISOString(), "UTC")} UTC`;
}

export default async function AdminBookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  await requireAdminPage(`/admin/bookings/${id}`);
  const data = await getBookingForAdmin(id).catch((err) => {
    if (err instanceof AccessError) notFound();
    throw err;
  });
  const { booking: b, stay, flight, payments, refunds, payout, account, host } = data;
  const cancellable = (CANCELLABLE as readonly string[]).includes(b.status);
  const policy = stay ? cancellationPolicyText[stay.cancellationPolicy] : null;

  return (
    <div className="max-w-5xl">
      <PageHeader title={`Booking ${b.reference}`} back={{ href: "/admin/bookings", label: "Bookings" }} actions={<StatusBadge status={b.status} />} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <DetailList
            items={[
              { label: "Kind", value: b.kind === "stay" ? "Stay" : "Flight" },
              {
                label: "Guest",
                value: (
                  <>
                    {b.contactName}
                    <a href={`mailto:${b.contactEmail}`} className="link block w-fit">
                      {b.contactEmail}
                    </a>
                    {b.contactPhone && (
                      <a href={`tel:${b.contactPhone.replace(/\s+/g, "")}`} className="link block w-fit">
                        {b.contactPhone}
                      </a>
                    )}
                  </>
                ),
              },
              {
                label: "Account",
                value: account ? (
                  <Link href={`/admin/users?q=${encodeURIComponent(account.email)}`} className="link">
                    {account.email}
                  </Link>
                ) : (
                  "Booked without an account"
                ),
              },
              { label: "Created", value: dateTime(b.createdAt) },
              ...(b.confirmedAt ? [{ label: "Confirmed", value: dateTime(b.confirmedAt) }] : []),
              ...(b.cancelledAt ? [{ label: "Cancelled", value: `${dateTime(b.cancelledAt)}${b.cancelReason ? `. ${b.cancelReason}` : ""}` }] : []),
              ...(b.expiresAt && (b.status === "draft" || b.status === "pending_payment") ? [{ label: "Hold expires", value: dateTime(b.expiresAt) }] : []),
            ]}
          />

          {stay && (
            <section aria-labelledby="stay">
              <h2 id="stay" className="mb-3 text-lg">
                Stay
              </h2>
              <DetailList
                items={[
                  {
                    label: "Listing",
                    value: (
                      <Link href={`/admin/listings?q=${stay.listingId}`} className="link">
                        {stay.listingTitle}
                      </Link>
                    ),
                  },
                  {
                    label: "Host",
                    value: host ? (
                      <Link href={`/admin/users?q=${encodeURIComponent(host.email)}`} className="link">
                        {host.name || host.email}
                      </Link>
                    ) : (
                      "Unknown"
                    ),
                  },
                  { label: "Room", value: `${stay.units > 1 ? `${stay.units} x ` : ""}${stay.unitName}` },
                  { label: "Dates", value: `${formatDay(stay.checkIn)} to ${formatDay(stay.checkOut)}, ${stay.nights} ${stay.nights === 1 ? "night" : "nights"}` },
                  {
                    label: "Guests",
                    value: `${stay.adults} ${stay.adults === 1 ? "adult" : "adults"}${stay.children ? `, ${stay.children} ${stay.children === 1 ? "child" : "children"}` : ""}`,
                  },
                  { label: "Policy", value: policy ? `${policy.label}. ${policy.summary}` : stay.cancellationPolicy },
                  ...(stay.guestNote ? [{ label: "Guest note", value: stay.guestNote }] : []),
                ]}
              />
            </section>
          )}

          {flight && (
            <section aria-labelledby="flight">
              <h2 id="flight" className="mb-3 text-lg">
                Flight
              </h2>
              <DetailList
                items={[
                  { label: "Route", value: `${flight.origin} to ${flight.destination}` },
                  { label: "Departs", value: dateTime(flight.departAt) },
                  ...(flight.returnAt ? [{ label: "Returns", value: dateTime(flight.returnAt) }] : []),
                  { label: "Airline reference", value: flight.airlineReference ?? "Not ticketed yet" },
                  { label: "Provider order", value: flight.providerOrderId ? `${providerName(flight.provider)} ${flight.providerOrderId}` : providerName(flight.provider) },
                  { label: "Passengers", value: flight.passengers.map((p) => `${p.givenName} ${p.familyName}`).join(", ") || "None recorded" },
                ]}
              />
            </section>
          )}

          <section aria-labelledby="payments">
            <h2 id="payments" className="mb-3 text-lg">
              Payments and refunds
            </h2>
            {payments.length === 0 && refunds.length === 0 ? (
              <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-slate">No payment has been started for this booking.</p>
            ) : (
              <Table caption="Payments and refunds">
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Provider and id</Th>
                    <Th>Status</Th>
                    <Th>When</Th>
                    <Th numeric>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        Payment
                        {p.method && <span className="block text-xs text-slate">{humanStatus(p.method)}</span>}
                      </Td>
                      <Td className="break-all">
                        {providerName(p.provider)}
                        <span className="block text-xs text-slate">{p.providerPaymentId ?? p.providerOrderId ?? ""}</span>
                        {p.failureReason && <span className="block text-xs text-signal">{p.failureReason}</span>}
                      </Td>
                      <Td>{humanStatus(p.status)}</Td>
                      <Td className="whitespace-nowrap">{formatDate(p.createdAt)}</Td>
                      <Td numeric>
                        <Price money={{ amount: p.amount, currency: p.currency }} />
                      </Td>
                    </tr>
                  ))}
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <Td>Refund</Td>
                      <Td className="break-all">
                        {r.providerRefundId ?? ""}
                        {r.reason && <span className="block text-xs text-slate">{r.reason}</span>}
                      </Td>
                      <Td>{humanStatus(r.status)}</Td>
                      <Td className="whitespace-nowrap">{formatDate(r.createdAt)}</Td>
                      <Td numeric>
                        <Price money={{ amount: -r.amount, currency: r.currency }} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        </div>

        <aside className="space-y-4 self-start">
          <div className="rounded-md border border-line bg-surface p-4">
            <h2 className="text-base">Price</h2>
            <PriceBreakdown className="mt-3" lines={b.priceLines} currency={b.currency} total={b.total} />
          </div>
          {payout && (
            <div className="rounded-md border border-line bg-surface p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-semibold">Host payout</span>
                <Price className="font-bold" money={{ amount: payout.amount, currency: payout.currency }} />
              </div>
              <p className="mt-1 text-slate">
                {humanStatus(payout.status)}
                {payout.paidAt
                  ? ` on ${formatDate(payout.paidAt)}`
                  : payout.status === "owed" || payout.status === "scheduled"
                    ? `. Due on or after ${formatDay(payout.releaseOn)}`
                    : ""}
                {payout.providerTransferId ? `. Reference ${payout.providerTransferId}` : ""}
              </p>
            </div>
          )}
          <div className="rounded-md border border-line bg-surface p-4">
            <h2 className="mb-3 text-base">Cancel</h2>
            <CancelBookingForm
              bookingId={b.id}
              currency={b.currency}
              totalLabel={formatMoney({ amount: b.total, currency: b.currency })}
              cancellable={cancellable}
              statusLabel={humanStatus(b.status).toLowerCase()}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
