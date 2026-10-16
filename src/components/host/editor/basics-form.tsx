"use client";

import { saveBasics } from "@/app/host/actions";
import { ActionForm, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "../form";
import { propertyTypeOptions } from "./new-listing-form";

export type BasicsValues = {
  title: string;
  propertyType: string;
  summary: string;
  description: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
};

export function BasicsForm({ listingId, values }: { listingId: string; values: BasicsValues }) {
  return (
    <ActionForm action={saveBasics.bind(null, listingId)} aria-label="Basics">
      <FormSection title="Name and type" description="The name appears in search results and at the top of your page.">
        <TextField name="title" label="Listing name" defaultValue={values.title} required maxLength={120} hint="At least 8 characters to publish." />
        <SelectField name="propertyType" label="Type of place" defaultValue={values.propertyType} options={propertyTypeOptions} />
      </FormSection>
      <FormSection title="Description" description="Write it the way you would describe the place to a friend: what it is, where it is, what is nearby.">
        <TextAreaField name="summary" label="Summary" defaultValue={values.summary} rows={2} maxLength={280} hint="One or two sentences shown under the name in search. Up to 280 characters." />
        <TextAreaField name="description" label="Full description" defaultValue={values.description} rows={10} maxLength={8000} hint="At least 100 characters to publish. Plain text; blank lines start a new paragraph." />
      </FormSection>
      <FormSection title="Size" description="For the whole place. Each room type has its own guest limit under Rooms and pricing.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextField name="maxGuests" label="Guests" type="number" min={1} max={500} defaultValue={values.maxGuests} />
          <TextField name="bedrooms" label="Bedrooms" type="number" min={0} max={500} defaultValue={values.bedrooms} />
          <TextField name="beds" label="Beds" type="number" min={0} max={1000} defaultValue={values.beds} />
          <TextField name="bathrooms" label="Bathrooms" type="number" min={0} max={500} step={0.5} defaultValue={values.bathrooms} />
        </div>
      </FormSection>
      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving basics">Save basics</SubmitButton>
      </div>
    </ActionForm>
  );
}
