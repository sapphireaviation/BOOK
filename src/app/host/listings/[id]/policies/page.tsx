import type { Metadata } from "next";
import { PoliciesForm } from "@/components/host/editor/policies-form";
import { loadEditor } from "@/server/host/editor";
import { bpsToPercentInput, minorToInput } from "@/server/host/rules";

export const instant = false;
export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage({ params }: PageProps<"/host/listings/[id]/policies">) {
  const { id } = await params;
  const { listing } = await loadEditor(id);
  return (
    <PoliciesForm
      listingId={id}
      currency={listing.currency}
      values={{
        cancellationPolicy: listing.cancellationPolicy,
        checkInFrom: listing.checkInFrom.slice(0, 5),
        checkOutUntil: listing.checkOutUntil.slice(0, 5),
        houseRules: listing.houseRules,
        minNights: listing.minNights,
        maxNights: listing.maxNights,
        instantBook: listing.instantBook,
        cleaningFee: listing.cleaningFee ? minorToInput(listing.cleaningFee, listing.currency) : "",
        taxPercent: listing.taxBps ? bpsToPercentInput(listing.taxBps) : "",
        contactPhone: listing.contactPhone ?? "",
        contactEmail: listing.contactEmail ?? "",
      }}
    />
  );
}
