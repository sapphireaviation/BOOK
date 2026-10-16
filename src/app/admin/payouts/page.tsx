import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Price } from "@/components/ui";
import { FilterBar, one, Pager } from "@/components/admin/filters";
import { PayoutActions } from "@/components/admin/row-actions";
import { PageHeader } from "@/components/host/shell";
import { humanStatus, StatusBadge, Table, Td, Th } from "@/components/host/table";
import { formatDate, formatDay, toISODate } from "@/lib/dates";
import { payoutFilterSchema, payoutStatuses, searchPayouts } from "@/server/admin/payouts";
import { requireAdminPage } from "@/server/host/access";

export const instant = false;
export const metadata: Metadata = { title: "Payouts" };

export default async function AdminPayoutsPage({ searchParams }: PageProps<"/admin/payouts">) {
  await requireAdminPage("/admin/payouts");
  const sp = await searchParams;
  const filter = payoutFilterSchema.parse({ status: one(sp.status), page: one(sp.page) });
  const { rows, hasMore, page } = await searchPayouts(filter);
  const today = toISODate(new Date());

  return (
    <>
      <PageHeader title="Payouts" description="Send the transfer from the bank first, then record it here with the bank's reference. The host sees the reference on their payouts page." />
      <FilterBar action="/admin/payouts" selects={[{ name: "status", label: "Status", value: filter.status, options: payoutStatuses.map((s) => ({ value: s, label: humanStatus(s) })) }]} />
      {rows.length === 0 ? (
        <EmptyState title="No payouts match">Payouts are created when a stay booking is confirmed.</EmptyState>
      ) : (
        <Table caption="Payouts">
          <thead>
            <tr>
              <Th>Host</Th>
              <Th>Pay to</Th>
              <Th>Booking</Th>
              <Th>Release</Th>
              <Th>Status</Th>
              <Th numeric>Amount</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <Td>
                  {p.hostName ?? p.hostEmail}
                  <span className="block text-xs text-slate">{p.hostEmail}</span>
                </Td>
                <Td className="max-w-56">
                  {p.payoutMethod || p.payoutDetails ? (
                    <>
                      {p.payoutMethod && <span className="font-semibold">{p.payoutMethod}</span>}
                      {p.payoutDetails && <span className="block whitespace-pre-line break-words text-xs">{p.payoutDetails}</span>}
                    </>
                  ) : (
                    <span className="text-signal">No payout details yet</span>
                  )}
                </Td>
                <Td>
                  <Link href={`/admin/bookings/${p.bookingId}`} className="link font-semibold">
                    {p.reference}
                  </Link>
                  <span className="block text-xs text-slate">{humanStatus(p.bookingStatus)}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  {formatDay(p.releaseOn)}
                  {p.status === "owed" && p.releaseOn <= today && <span className="block text-xs font-semibold text-fern">Due</span>}
                </Td>
                <Td>
                  <StatusBadge status={p.status} />
                  {p.paidAt && <span className="block text-xs text-slate">{formatDate(p.paidAt)}</span>}
                  {p.transferReference && <span className="block break-all text-xs text-slate">{p.transferReference}</span>}
                </Td>
                <Td numeric>
                  <Price money={{ amount: p.amount, currency: p.currency }} />
                </Td>
                <Td>
                  <PayoutActions payoutId={p.id} status={p.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pager path="/admin/payouts" params={{ status: filter.status }} page={page} hasMore={hasMore} />
    </>
  );
}
