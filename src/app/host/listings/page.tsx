import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, EmptyState, Price } from "@/components/ui";
import { PageHeader } from "@/components/host/shell";
import { StatusBadge, Table, Td, Th } from "@/components/host/table";
import { formatDate } from "@/lib/dates";
import { actorOf, requireHostPage } from "@/server/host/access";
import { listHostListings } from "@/server/host/listings";

export const instant = false;
export const metadata: Metadata = { title: "Listings" };

export default async function ListingsPage() {
  const viewer = await requireHostPage("/host/listings");
  const listings = await listHostListings(actorOf(viewer));

  return (
    <>
      <PageHeader
        title="Listings"
        description="Every place you host. Open one to edit it section by section."
        actions={
          <ButtonLink href="/host/listings/new" size="sm">
            Add listing
          </ButtonLink>
        }
      />
      {listings.length === 0 ? (
        <EmptyState title="You have no listings yet" action={<ButtonLink href="/host/listings/new">Add your first listing</ButtonLink>}>
          Start with a name and the type of place. Everything else can be filled in later.
        </EmptyState>
      ) : (
        <Table caption="Your listings">
          <thead>
            <tr>
              <Th>Listing</Th>
              <Th>Status</Th>
              <Th>Place</Th>
              <Th numeric>From a night</Th>
              <Th numeric>Photos</Th>
              <Th numeric>Rooms</Th>
              <Th>Checklist</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => {
              const left = l.checklist.filter((c) => !c.done).length;
              return (
                <tr key={l.id}>
                  <Td>
                    <Link href={`/host/listings/${l.id}`} className="link font-semibold">
                      {l.title}
                    </Link>
                    {l.verified && <span className="ml-2 text-xs font-semibold text-fern">Verified</span>}
                  </Td>
                  <Td>
                    <StatusBadge status={l.status} />
                  </Td>
                  <Td>{l.city || <span className="text-slate">Not set</span>}</Td>
                  <Td numeric>{l.fromPrice ? <Price money={{ amount: l.fromPrice, currency: l.currency }} /> : <span className="text-slate">No price</span>}</Td>
                  <Td numeric>{l.photoCount}</Td>
                  <Td numeric>{l.unitCount}</Td>
                  <Td>
                    {left === 0 ? (
                      <span className="text-fern">Complete</span>
                    ) : (
                      <Link href={`/host/listings/${l.id}/publish`} className="link">
                        {left} {left === 1 ? "item" : "items"} to do
                      </Link>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate">{formatDate(l.updatedAt)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
