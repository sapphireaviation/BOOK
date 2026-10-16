"use client";

import { createListing } from "@/app/host/actions";
import { propertyTypeLabels } from "@/lib/amenities";
import { ActionForm, SelectField, SubmitButton, TextField } from "../form";

export const propertyTypeOptions = Object.entries(propertyTypeLabels).map(([value, label]) => ({ value, label }));

export function NewListingForm() {
  return (
    <ActionForm action={createListing} className="space-y-5 rounded-md border border-line bg-surface p-5" aria-label="New listing">
      <TextField name="title" label="Listing name" hint="What guests see first, for example Courtyard house near Fontainhas." required maxLength={120} autoFocus />
      <SelectField name="propertyType" label="Type of place" defaultValue="homestay" options={propertyTypeOptions} />
      <SubmitButton pendingLabel="Creating draft">Create draft</SubmitButton>
    </ActionForm>
  );
}
