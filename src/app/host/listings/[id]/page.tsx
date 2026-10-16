import type { Metadata } from "next";
import { BasicsForm } from "@/components/host/editor/basics-form";
import { loadEditor } from "@/server/host/editor";

export const instant = false;
export const metadata: Metadata = { title: "Edit listing" };

export default async function BasicsPage({ params }: PageProps<"/host/listings/[id]">) {
  const { id } = await params;
  const { listing } = await loadEditor(id);
  return (
    <BasicsForm
      listingId={id}
      values={{
        title: listing.title,
        propertyType: listing.propertyType,
        summary: listing.summary,
        description: listing.description,
        maxGuests: listing.maxGuests,
        bedrooms: listing.bedrooms,
        beds: listing.beds,
        bathrooms: listing.bathrooms,
      }}
    />
  );
}
