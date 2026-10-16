import type { Metadata } from "next";
import Link from "next/link";
import { Price } from "@/components/ui";
import { PageHeader } from "@/components/host/shell";
import { Stat, StatRow } from "@/components/host/table";
import { requireAdminPage } from "@/server/host/access";
import { adminOverview } from "@/server/admin/overview";

export const instant = false;
export const metadata: Metadata = { title: "Overview" };

function MoneyList({ items, empty, noun = ["booking", "bookings"] }: { items: { currency: string; amount: number; count: number }[]; empty: string; noun?: [string, string] }) {
  if (!items.length) return <span className="text-base font-semibold text-slate">{empty}</span>;
  return (
    <>
      {items.map((i) => (
        <div key={i.currency}>
          <Price money={{ amount: i.amount, currency: i.currency }} />
          <span className="ml-2 text-xs font-semibold text-slate">
            {i.count} {i.count === 1 ? noun[0] : noun[1]}
          </span>
        </div>
      ))}
    </>
  );
}

export default async function AdminOverview() {
  await requireAdminPage("/admin");
  const o = await adminOverview(new Date());

  return (
    <>
      <PageHeader title="Overview" description="Days run midnight to midnight UTC. The week starts on Monday." />
      <StatRow>
        <Stat label="Bookings today" hint={`${o.bookingsToday.stay} stays, ${o.bookingsToday.flight} flights`}>
          <Link href="/admin/bookings" className="hover:underline">
            {o.bookingsToday.total}
          </Link>
        </Stat>
        <Stat label="Bookings this week" hint={`${o.bookingsThisWeek.stay} stays, ${o.bookingsThisWeek.flight} flights`}>
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

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="value" className="rounded-md border border-line bg-surface">
          <h2 id="value" className="border-b border-line px-4 py-3 text-base">
            Booking value, last 30 days
          </h2>
          <div className="tnum px-4 py-3 text-lg font-bold">
            <MoneyList items={o.valueLast30Days} empty="No confirmed bookings" />
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-slate">Confirmed and completed bookings, by currency.</p>
        </section>
        <section aria-labelledby="pending" className="rounded-md border border-line bg-surface">
          <h2 id="pending" className="border-b border-line px-4 py-3 text-base">
            Pending payments
          </h2>
          <div className="tnum px-4 py-3 text-lg font-bold">
            <MoneyList items={o.pendingPayments} empty="None" />
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-slate">Payment orders created but not captured yet.</p>
        </section>
        <section aria-labelledby="owed" className="rounded-md border border-line bg-surface">
          <h2 id="owed" className="border-b border-line px-4 py-3 text-base">
            Payouts owed to hosts
          </h2>
          <div className="tnum px-4 py-3 text-lg font-bold">
            <MoneyList items={o.payoutsOwed} empty="Nothing owed" noun={["payout", "payouts"]} />
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs">
            <Link href="/admin/payouts?status=owed" className="link">
              Record payouts
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
