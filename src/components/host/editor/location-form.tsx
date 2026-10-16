"use client";

import { useMemo, useState } from "react";
import { saveLocation } from "@/app/host/actions";
import { Button, Field, Input, Select } from "@/components/ui";
import { ActionForm, FormSection, SelectField, SubmitButton, TextField, useFieldError } from "../form";
import { MapPicker, round } from "./map-picker";

export type DestinationOption = { slug: string; name: string; region: string | null; countryCode: string; lat: number; lng: number; radiusKm: number };

export type LocationValues = {
  addressLine: string;
  locality: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  lat: number;
  lng: number;
  destinationSlug: string;
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function LocationForm({
  listingId,
  values,
  countries,
  destinations,
}: {
  listingId: string;
  values: LocationValues;
  countries: { value: string; label: string }[];
  destinations: DestinationOption[];
}) {
  const hasPin = !(values.lat === 0 && values.lng === 0);
  const [lat, setLat] = useState(hasPin ? String(values.lat) : "");
  const [lng, setLng] = useState(hasPin ? String(values.lng) : "");
  const [destination, setDestination] = useState(values.destinationSlug);
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle");

  const point = useMemo(() => {
    const a = Number(lat);
    const b = Number(lng);
    if (lat.trim() === "" || lng.trim() === "" || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
    return { lat: a, lng: b };
  }, [lat, lng]);

  const ranked = useMemo(() => {
    if (!point) return destinations.map((d) => ({ ...d, km: null as number | null }));
    return destinations.map((d) => ({ ...d, km: distanceKm(point, d) })).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  }, [destinations, point]);
  const nearest = ranked.find((d) => d.km !== null && d.km <= d.radiusKm) ?? null;

  function pick(p: { lat: number; lng: number }) {
    setLat(String(p.lat));
    setLng(String(p.lng));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setLocating("failed");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pick({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
        setLocating("idle");
      },
      () => setLocating("failed"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <ActionForm action={saveLocation.bind(null, listingId)} aria-label="Location">
      <FormSection title="Address" description="Guests see the full address only after they book. Search shows the area and city.">
        <TextField name="addressLine" label="Street address" defaultValue={values.addressLine} autoComplete="street-address" maxLength={200} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="locality" label="Area or neighbourhood" defaultValue={values.locality} maxLength={120} />
          <TextField name="city" label="Town or city" defaultValue={values.city} required maxLength={120} autoComplete="address-level2" />
          <TextField name="region" label="State or region" defaultValue={values.region} maxLength={120} autoComplete="address-level1" />
          <TextField name="postalCode" label="Postal code" defaultValue={values.postalCode} maxLength={20} autoComplete="postal-code" />
        </div>
        <SelectField name="countryCode" label="Country" defaultValue={values.countryCode} options={countries} />
      </FormSection>

      <FormSection
        title="Map pin"
        description={
          <>
            Click the map where the entrance is. Zoom in with the buttons or by pinching. You can also type the coordinates.
          </>
        }
      >
        <MapPicker point={point} onPick={pick} label="Map. Click to place the listing pin." />
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <CoordinateInput name="lat" label="Latitude" value={lat} onChange={setLat} hint="Between -90 and 90" />
          <CoordinateInput name="lng" label="Longitude" value={lng} onChange={setLng} hint="Between -180 and 180" />
          <Button type="button" variant="secondary" onClick={useMyLocation} pending={locating === "busy"}>
            Use my location
          </Button>
        </div>
        {locating === "failed" && <p className="text-sm text-signal">Your browser did not share a location. Click the map instead.</p>}
      </FormSection>

      <FormSection title="Destination" description="The destination page your listing appears on. We pick the nearest one that covers your pin unless you choose another.">
        <DestinationSelect value={destination} onChange={setDestination} ranked={ranked} nearestName={nearest?.name ?? null} hasPoint={Boolean(point)} />
      </FormSection>

      <div className="border-t border-line pt-6">
        <SubmitButton pendingLabel="Saving location">Save location</SubmitButton>
      </div>
    </ActionForm>
  );
}

function CoordinateInput({ name, label, value, onChange, hint }: { name: string; label: string; value: string; onChange: (v: string) => void; hint: string }) {
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error}>
      {(p) => <Input {...p} name={name} inputMode="decimal" className="tnum" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />}
    </Field>
  );
}

function DestinationSelect({
  value,
  onChange,
  ranked,
  nearestName,
  hasPoint,
}: {
  value: string;
  onChange: (v: string) => void;
  ranked: (DestinationOption & { km: number | null })[];
  nearestName: string | null;
  hasPoint: boolean;
}) {
  const error = useFieldError("destinationSlug");
  const auto = !hasPoint ? "Nearest to the pin (place the pin first)" : nearestName ? `Nearest to the pin: ${nearestName}` : "Nearest to the pin (none within range)";
  return (
    <Field label="Destination" error={error} hint={ranked.length === 0 ? "No destinations are set up yet. Your listing can still be published." : undefined}>
      {(p) => (
        <Select {...p} name="destinationSlug" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{auto}</option>
          {ranked.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
              {d.region ? `, ${d.region}` : ""}
              {d.km !== null ? ` (${d.km < 10 ? d.km.toFixed(1) : Math.round(d.km)} km)` : ""}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
