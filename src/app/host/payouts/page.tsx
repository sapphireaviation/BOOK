import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Price } from "@/components/ui";
import { PageHeader } from "@/components/host/shell";
import { StatusBadge, Table, Td, Th } from "@/components/host/table";
import { site } from "@/config/site";
import { formatDate, formatDay } from "@/lib/dates";
import { actorOf, requireHostPage } from "@/server/host/access";
import { listHostPayouts, payoutTotals } from "@/server/host/payouts";

export const instant = false;
export const metadata: Metadata = { title: "Payouts" };

const groups = [
  { status: "owed", label: "Owed", hint: "Booked stays we will pay out after check in" },
  { status: "scheduled", label: "Scheduled", hint: "Transfer is on its way" },
  { status: "paid", label: "Paid", hint: "Sent to your payout account" },
] as const;

export default async function PayoutsPage() {
  const viewer = await requireHostPage("/host/payouts");
  const actor = actorOf(viewer);
  const [totals, rows] = await Promise.all([payoutTotals(actor.userId), listHostPayouts(actor)]);

  return (
    <>
      <PageHeader
        title="Payouts"
        description={
          <>
            You receive the full amount the guest paid for the room, cleaning fee and taxes. Payout details are on your{" "}
            <Link href="/host/profile" className="link">
              profile
            </Link>
            .
          </>
        }
      />
      <div className="mb-8 grid divide-y divide-line rounded-md border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {groups.map((g) => {
          const list = totals[g.status] ?? [];
          return (
            <div key={g.status} className="px-4 py-3">
              <p className="text-xs font-semibold text-slate">{g.label}</p>
              <div className="tnum mt-1 text-xl font-extrabold">
                {list.length ? (
                  list.map((t) => (
                    <div key={t.currency}>
                      <Price money={{ amount: t.amount, currency: t.currency }} />
                    </div>
                  ))
                ) : (
                  <Price money={{ amount: 0, currency: rows[0]?.currency ?? site.defaultCurrency }} />
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate">{g.hint}</p>
            </div>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No payouts yet">A payout is created for each confirmed booking. It shows here with the date it will be released.</EmptyState>
      ) : (
        <Table caption="Payouts">
          <thead>
            <tr>
              <Th>Booking</Th>
              <Th>Guest and listing</Th>
              <Th>Check in</Th>
              <Th>Status</Th>
              <Th>Released</Th>
              <Th>Transfer reference</Th>
              <Th numeric>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <Td>
                  <Link href={`/host/bookings/${p.bookingId}`} className="link font-semibold">
                    {p.reference}
                  </Link>
                </Td>
                <Td>
                  {p.guestName}
                  {p.listingTitle && <span className="block text-xs text-slate">{p.listingTitle}</span>}
                </Td>
                <Td className="whitespace-nowrap">{p.checkIn ? formatDay(p.checkIn) : ""}</Td>
                <Td>
                  <StatusBadge status={p.status} />
                </Td>
                <Td className="whitespace-nowrap">{p.paidAt ? formatDate(p.paidAt) : `From ${formatDay(p.releaseOn)}`}</Td>
                <Td className="break-all">{p.transferReference ?? <span className="text-slate">None yet</span>}</Td>
                <Td numeric>
                  <Price money={{ amount: p.amount, currency: p.currency }} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
