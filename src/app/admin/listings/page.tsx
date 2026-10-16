import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Price } from "@/components/ui";
import { FilterBar, one, Pager } from "@/components/admin/filters";
import { ModerateListing } from "@/components/admin/row-actions";
import { PageHeader } from "@/components/host/shell";
import { humanStatus, StatusBadge, Table, Td, Th } from "@/components/host/table";
import { formatDate } from "@/lib/dates";
import { listingFilterSchema, listingStatuses, searchListings } from "@/server/admin/listings";
import { requireAdminPage } from "@/server/host/access";

export const instant = false;
export const metadata: Metadata = { title: "Listings" };

export default async function AdminListingsPage({ searchParams }: PageProps<"/admin/listings">) {
  await requireAdminPage("/admin/listings");
  const sp = await searchParams;
  const filter = listingFilterSchema.parse({ q: one(sp.q), status: one(sp.status), page: one(sp.page) });
  const { rows, hasMore, page } = await searchListings(filter);

  return (
    <>
      <PageHeader title="Listings" description="Suspend hides a listing from travelers straight away. Verify marks a listing our team has checked." />
      <FilterBar
        action="/admin/listings"
        search={{ name: "q", label: "Title, city or host email", value: filter.q }}
        selects={[
          {
            name: "status",
            label: "Status",
            value: filter.status,
            options: [{ value: "review", label: "Awaiting review" }, ...listingStatuses.map((s) => ({ value: s, label: humanStatus(s) }))],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No listings match">Clear the filters to see every listing.</EmptyState>
      ) : (
        <Table caption="Listings">
          <thead>
            <tr>
              <Th>Listing</Th>
              <Th>Host</Th>
              <Th>Status</Th>
              <Th numeric>From</Th>
              <Th>Updated</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <Td>
                  <Link href={`/host/listings/${l.id}`} className="link font-semibold">
                    {l.title}
                  </Link>
                  <span className="block text-xs text-slate">{[l.city, l.countryCode].filter(Boolean).join(", ")}</span>
                </Td>
                <Td>
                  {l.hostName}
                  <span className="block text-xs text-slate">{l.hostEmail}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={l.status} />
                    {l.verified && <span className="text-xs font-semibold text-fern">Verified</span>}
                  </div>
                </Td>
                <Td numeric>{l.fromPrice ? <Price money={{ amount: l.fromPrice, currency: l.currency }} /> : "None"}</Td>
                <Td className="whitespace-nowrap text-slate">{formatDate(l.updatedAt)}</Td>
                <Td>
                  <ModerateListing listingId={l.id} status={l.status} verified={l.verified} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pager path="/admin/listings" params={{ q: filter.q, status: filter.status }} page={page} hasMore={hasMore} />
    </>
  );
}
