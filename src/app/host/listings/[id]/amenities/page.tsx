import type { Metadata } from "next";
import { AmenitiesForm } from "@/components/host/editor/amenities-form";
import { loadEditor } from "@/server/host/editor";

export const instant = false;
export const metadata: Metadata = { title: "Amenities" };

export default async function AmenitiesPage({ params }: PageProps<"/host/listings/[id]/amenities">) {
  const { id } = await params;
  const { listing } = await loadEditor(id);
  return <AmenitiesForm listingId={id} selected={listing.amenities} />;
}
