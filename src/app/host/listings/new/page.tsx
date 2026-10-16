import type { Metadata } from "next";
import { PageHeader } from "@/components/host/shell";
import { NewListingForm } from "@/components/host/editor/new-listing-form";
import { requireHostPage } from "@/server/host/access";

export const instant = false;
export const metadata: Metadata = { title: "Add listing" };

export default async function NewListingPage() {
  await requireHostPage("/host/listings/new");
  return (
    <div className="max-w-xl">
      <PageHeader
        title="Add a listing"
        back={{ href: "/host/listings", label: "Listings" }}
        description="Start with a name and the type of place. This creates a draft that only you can see."
      />
      <NewListingForm />
    </div>
  );
}
