import type { Metadata } from "next";
import Link from "next/link";
import { cn, EmptyState, Price } from "@/components/ui";
import { PageHeader } from "@/components/host/shell";
import { StatusBadge, Table, Td, Th } from "@/components/host/table";
import { formatDay, toISODate } from "@/lib/dates";
import { actorOf, requireHostPage } from "@/server/host/access";
import { amountOwed, listHostBookings } from "@/server/host/bookings";

export const instant = false;
export const metadata: Metadata = { title: "Bookings" };

const views = [
  { key: "upcoming", label: "Upcoming and current" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export default async function HostBookingsPage({ searchParams }: PageProps<"/host/bookings">) {
  const viewer = await requireHostPage("/host/bookings");
  const sp = await searchParams;
  const when = views.find((v) => v.key === sp.when)?.key ?? "upcoming";
  const today = toISODate(new Date());
  const rows = await listHostBookings(actorOf(viewer), { when, today });

  return (
    <>
      <PageHeader title="Bookings" description="Paid bookings for your listings. Guest email and phone show while a booking is confirmed." />
      <nav aria-label="Booking filter" className="mb-4 flex flex-wrap gap-2">
        {views.map((v) => (
          <Link
            key={v.key}
            href={v.key === "upcoming" ? "/host/bookings" : `/host/bookings?when=${v.key}`}
            aria-current={when === v.key ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-semibold",
              when === v.key ? "border-sapphire bg-sapphire-wash text-sapphire" : "border-line-strong bg-surface hover:border-ink",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={when === "past" ? "No past bookings" : when === "all" ? "No bookings yet" : "No upcoming bookings"}>
          {when === "upcoming" ? "New bookings appear here as soon as the guest has paid." : "Bookings appear here once guests have paid."}
        </EmptyState>
      ) : (
        <Table caption="Bookings">
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Guest</Th>
              <Th>Dates</Th>
              <Th>Listing and room</Th>
              <Th numeric>Guests</Th>
              <Th>Status</Th>
              <Th numeric>Owed to you</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <Td>
                  <Link href={`/host/bookings/${b.id}`} className="link font-semibold">
                    {b.reference}
                  </Link>
                </Td>
                <Td>{b.guestName}</Td>
                <Td className="whitespace-nowrap">
                  {formatDay(b.checkIn)} to {formatDay(b.checkOut)}
                  <span className="block text-xs text-slate">
                    {b.nights} {b.nights === 1 ? "night" : "nights"}
                  </span>
                </Td>
                <Td>
                  {b.listingTitle}
                  <span className="block text-xs text-slate">
                    {b.units > 1 ? `${b.units} x ` : ""}
                    {b.unitName}
                  </span>
                </Td>
                <Td numeric>{b.adults + b.children}</Td>
                <Td>
                  <StatusBadge status={b.status} />
                </Td>
                <Td numeric>
                  <Price money={{ amount: amountOwed(b), currency: b.currency }} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
