"use client";

import { useState } from "react";
import { removeUnit, saveCurrency, saveUnit } from "@/app/host/actions";
import { Badge, Button } from "@/components/ui";
import { ActionForm, CheckboxField, MoneyField, SelectField, SubmitButton, TextAreaField, TextField } from "../form";

export type UnitValues = {
  id: string;
  name: string;
  description: string;
  maxGuests: number;
  beds: string;
  basePrice: string;
  extraGuestPrice: string;
  includedGuests: number;
  quantity: number;
  active: boolean;
  /** Formatted for display, e.g. "₹4,500". */
  priceLabel: string;
  extraLabel: string | null;
};

export function CurrencyForm({ listingId, currency, options, hasPrices }: { listingId: string; currency: string; options: string[]; hasPrices: boolean }) {
  return (
    <ActionForm action={saveCurrency.bind(null, listingId)} aria-label="Currency" className="rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          name="currency"
          label="Currency for all prices on this listing"
          defaultValue={currency}
          options={options.map((c) => ({ value: c, label: c }))}
          className="w-64"
          hint={hasPrices ? "Changing it keeps the numbers you typed. It does not convert exchange rates." : undefined}
        />
        <SubmitButton variant="secondary" pendingLabel="Changing currency">
          Change currency
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function UnitList({ listingId, currency, units }: { listingId: string; currency: string; units: UnitValues[] }) {
  return (
    <div className="space-y-8">
      {units.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {units.map((u) => (
            <UnitRow key={u.id} listingId={listingId} currency={currency} unit={u} />
          ))}
        </ul>
      )}
      <section aria-labelledby="add-room" className="rounded-md border border-line bg-surface p-5">
        <h2 id="add-room" className="text-lg">
          {units.length ? "Add another room type" : "Add your first room"}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slate">
          A room type is what a guest books. For a guesthouse that might be Garden room, with 3 identical rooms. For a whole home, add one called Entire home.
        </p>
        <UnitForm listingId={listingId} currency={currency} unit={null} />
      </section>
    </div>
  );
}

function UnitRow({ listingId, currency, unit }: { listingId: string; currency: string; unit: UnitValues }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {unit.name} {!unit.active && <Badge className="ml-1">Not bookable</Badge>}
          </p>
          <p className="mt-0.5 text-sm text-slate">
            Sleeps {unit.maxGuests}
            {unit.beds ? `, ${unit.beds}` : ""}. {unit.quantity} {unit.quantity === 1 ? "room" : "identical rooms"}.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="tnum font-bold">{unit.priceLabel}</p>
            <p className="text-xs text-slate">a night for {unit.includedGuests} {unit.includedGuests === 1 ? "guest" : "guests"}</p>
            {unit.extraLabel && <p className="text-xs text-slate">plus {unit.extraLabel} per extra guest</p>}
          </div>
          <Button type="button" variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Edit"}
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <UnitForm listingId={listingId} currency={currency} unit={unit} />
          <DeleteUnit listingId={listingId} unitId={unit.id} />
        </div>
      )}
    </li>
  );
}

function UnitForm({ listingId, currency, unit }: { listingId: string; currency: string; unit: UnitValues | null }) {
  return (
    <ActionForm action={saveUnit.bind(null, listingId, unit?.id ?? null)} resetOnSuccess={!unit} aria-label={unit ? `Edit ${unit.name}` : "Add room"} className="mt-4 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name" defaultValue={unit?.name} required maxLength={120} placeholder="Garden room" />
        <TextField name="beds" label="Beds" defaultValue={unit?.beds} maxLength={120} placeholder="1 queen bed and 1 sofa bed" />
      </div>
      <TextAreaField name="description" label="Description" defaultValue={unit?.description} rows={3} maxLength={2000} hint="Optional. What makes this room different: the view, the floor, a private bathroom." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <TextField name="maxGuests" label="Sleeps up to" type="number" min={1} max={100} defaultValue={unit?.maxGuests ?? 2} />
        <TextField name="includedGuests" label="Guests in the base price" type="number" min={1} max={100} defaultValue={unit?.includedGuests ?? 2} />
        <TextField name="quantity" label="Identical rooms" type="number" min={1} max={1000} defaultValue={unit?.quantity ?? 1} hint="How many of this room you have." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField name="basePrice" label="Price a night" currency={currency} defaultValue={unit?.basePrice} required hint="What you receive. Guests pay exactly this, with no fee added." />
        <MoneyField name="extraGuestPrice" label="Extra guest, a night" currency={currency} defaultValue={unit?.extraGuestPrice} hint="For each guest above the number in the base price. Leave empty for none." />
      </div>
      <CheckboxField name="active" label="Bookable" defaultChecked={unit?.active ?? true} hint="Untick to stop new bookings for this room without deleting it." />
      <SubmitButton pendingLabel={unit ? "Saving room" : "Adding room"}>{unit ? "Save room" : "Add room"}</SubmitButton>
    </ActionForm>
  );
}

function DeleteUnit({ listingId, unitId }: { listingId: string; unitId: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mt-6 border-t border-line pt-4">
      {!confirming ? (
        <Button type="button" variant="ghost" size="sm" className="text-signal" onClick={() => setConfirming(true)}>
          Delete this room
        </Button>
      ) : (
        <ActionForm action={removeUnit.bind(null, listingId, unitId)} aria-label="Delete room">
          <p className="text-sm">This removes the room and its calendar. Rooms with bookings cannot be deleted.</p>
          <div className="mt-2 flex gap-2">
            <SubmitButton variant="danger" size="sm" pendingLabel="Deleting room">
              Delete room
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
