"use client";

import { saveAmenities } from "@/app/host/actions";
import { Checkbox } from "@/components/ui";
import { amenityGroups } from "@/lib/amenities";
import { ActionForm, SubmitButton } from "../form";

export function AmenitiesForm({ listingId, selected }: { listingId: string; selected: string[] }) {
  const chosen = new Set(selected);
  return (
    <ActionForm action={saveAmenities.bind(null, listingId)} aria-label="Amenities">
      <p className="mb-6 max-w-prose text-sm text-slate">Tick only what guests can use during their stay. Guests filter search by these, so an extra tick can lead to a disappointed guest.</p>
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {amenityGroups.map((g) => (
          <fieldset key={g.group}>
            <legend className="mb-3 font-bold">{g.group}</legend>
            <div className="space-y-2.5">
              {g.items.map((item) => (
                <Checkbox key={item.key} name="amenities" value={item.key} label={item.label} defaultChecked={chosen.has(item.key)} />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving amenities">Save amenities</SubmitButton>
      </div>
    </ActionForm>
  );
}
