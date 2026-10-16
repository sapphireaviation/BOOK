import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Price } from "@/components/ui";
import { FilterBar, one, Pager } from "@/components/admin/filters";
import { PageHeader } from "@/components/host/shell";
import { humanStatus, StatusBadge, Table, Td, Th } from "@/components/host/table";
import { formatDate, formatDay } from "@/lib/dates";
import { bookingFilterSchema, bookingKinds, bookingStatuses, searchBookings } from "@/server/admin/bookings";
import { requireAdminPage } from "@/server/host/access";

export const instant = false;
export const metadata: Metadata = { title: "Bookings" };

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdminPage("/admin/bookings");
  const sp = await searchParams;
  const filter = bookingFilterSchema.parse({ q: one(sp.q), status: one(sp.status), kind: one(sp.kind), page: one(sp.page) });
  const { rows, hasMore, page } = await searchBookings(filter);

  return (
    <>
      <PageHeader title="Bookings" description="Search by booking reference, guest email or guest name." />
      <FilterBar
        action="/admin/bookings"
        search={{ name: "q", label: "Reference or email", placeholder: "K7Q-4MZ2 or name@example.com", value: filter.q }}
        selects={[
          { name: "status", label: "Status", value: filter.status, options: bookingStatuses.map((s) => ({ value: s, label: humanStatus(s) })) },
          { name: "kind", label: "Kind", value: filter.kind, options: bookingKinds.map((k) => ({ value: k, label: k === "stay" ? "Stays" : "Flights" })) },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No bookings match">Try the full reference, or clear the status and kind filters.</EmptyState>
      ) : (
        <Table caption="Bookings">
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Kind</Th>
              <Th>Guest</Th>
              <Th>What</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th numeric>Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <Td>
                  <Link href={`/admin/bookings/${b.id}`} className="link font-semibold">
                    {b.reference}
                  </Link>
                </Td>
                <Td>{b.kind === "stay" ? "Stay" : "Flight"}</Td>
                <Td>
                  {b.contactName}
                  <span className="block text-xs text-slate">{b.contactEmail}</span>
                </Td>
                <Td>
                  {b.kind === "stay" ? (
                    <>
                      {b.listingTitle}
                      {b.checkIn && <span className="block text-xs text-slate">From {formatDay(b.checkIn)}</span>}
                    </>
                  ) : (
                    <>
                      {b.origin} to {b.destination}
                      {b.departAt && <span className="block text-xs text-slate">{formatDay(b.departAt)}</span>}
                    </>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={b.status} />
                </Td>
                <Td className="whitespace-nowrap text-slate">{formatDate(b.createdAt)}</Td>
                <Td numeric>
                  <Price money={{ amount: b.total, currency: b.currency }} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pager path="/admin/bookings" params={{ q: filter.q, status: filter.status, kind: filter.kind }} page={page} hasMore={hasMore} />
    </>
  );
}
