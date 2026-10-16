import type { Metadata } from "next";
import { LocationForm } from "@/components/host/editor/location-form";
import { countryOptions } from "@/components/host/editor/countries";
import { loadEditor } from "@/server/host/editor";
import { listDestinationsForPicker } from "@/server/host/listings";

export const instant = false;
export const metadata: Metadata = { title: "Location" };

export default async function LocationPage({ params }: PageProps<"/host/listings/[id]/location">) {
  const { id } = await params;
  const [{ listing }, destinations] = await Promise.all([loadEditor(id), listDestinationsForPicker()]);
  return (
    <LocationForm
      listingId={id}
      countries={countryOptions("en")}
      destinations={destinations}
      values={{
        addressLine: listing.addressLine ?? "",
        locality: listing.locality ?? "",
        city: listing.city,
        region: listing.region ?? "",
        postalCode: listing.postalCode ?? "",
        countryCode: listing.countryCode,
        lat: listing.lat,
        lng: listing.lng,
        destinationSlug: listing.destinationSlug ?? "",
      }}
    />
  );
}
