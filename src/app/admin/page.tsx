import type { Metadata } from "next";
import Link from "next/link";
import { Price } from "@/components/ui";
import { PageHeader } from "@/components/host/shell";
import { Stat, StatRow, Table, Td, Th } from "@/components/host/table";
import { requireAdminPage } from "@/server/host/access";
import { adminOverview } from "@/server/admin/overview";

export const instant = false;
export const metadata: Metadata = { title: "Overview" };

type CurrencyTotal = { currency: string; amount: number; count: number };

function MoneyCell({ item, noun }: { item?: CurrencyTotal; noun: [string, string] }) {
  if (!item) return <span className="text-slate">None</span>;
  return (
    <>
      <Price className="font-semibold" money={{ amount: item.amount, currency: item.currency }} />
      <span className="block text-xs text-slate">
        {item.count} {item.count === 1 ? noun[0] : noun[1]}
      </span>
    </>
  );
}

function kinds(c: { stay: number; flight: number }) {
  return `${c.stay} ${c.stay === 1 ? "stay" : "stays"}, ${c.flight} ${c.flight === 1 ? "flight" : "flights"}`;
}

export default async function AdminOverview() {
  await requireAdminPage("/admin");
  const o = await adminOverview(new Date());
  const currencies = [...new Set([...o.valueLast30Days, ...o.pendingPayments, ...o.payoutsOwed].map((i) => i.currency))].sort();

  return (
    <>
      <PageHeader title="Overview" description="Days run midnight to midnight UTC. The week starts on Monday." />
      <StatRow>
        <Stat label="Bookings today" hint={kinds(o.bookingsToday)}>
          <Link href="/admin/bookings" className="hover:underline">
            {o.bookingsToday.total}
          </Link>
        </Stat>
        <Stat label="Bookings this week" hint={kinds(o.bookingsThisWeek)}>
          {o.bookingsThisWeek.total}
        </Stat>
        <Stat label="Listings awaiting review" hint="Published but not yet verified">
          <Link href="/admin/listings?status=review" className="hover:underline">
            {o.listingsAwaitingReview}
          </Link>
        </Stat>
        <Stat label="Pending payments" hint="Bookings waiting on the payment provider">
          <Link href="/admin/bookings?status=pending_payment" className="hover:underline">
            {o.pendingPayments.reduce((s, p) => s + p.count, 0)}
          </Link>
        </Stat>
      </StatRow>

      <section aria-labelledby="money" className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="money" className="text-lg">
            Money by currency
          </h2>
          <Link href="/admin/payouts?status=owed" className="link text-sm">
            Record payouts
          </Link>
        </div>
        {currencies.length ? (
          <>
            <Table caption="Booking value, pending payments and payouts owed, by currency">
              <thead>
                <tr>
                  <Th>Currency</Th>
                  <Th numeric>Booked, last 30 days</Th>
                  <Th numeric>Payments not captured</Th>
                  <Th numeric>Owed to hosts</Th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => (
                  <tr key={c}>
                    <Td className="font-semibold">{c}</Td>
                    <Td numeric>
                      <MoneyCell item={o.valueLast30Days.find((i) => i.currency === c)} noun={["booking", "bookings"]} />
                    </Td>
                    <Td numeric>
                      <MoneyCell item={o.pendingPayments.find((i) => i.currency === c)} noun={["booking", "bookings"]} />
                    </Td>
                    <Td numeric>
                      <MoneyCell item={o.payoutsOwed.find((i) => i.currency === c)} noun={["payout", "payouts"]} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-xs text-slate">Booked counts confirmed and completed bookings. Payments not captured are orders the provider has not confirmed yet.</p>
          </>
        ) : (
          <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-slate">No bookings in the last 30 days, no payments waiting and nothing owed to hosts.</p>
        )}
      </section>
    </>
  );
}
