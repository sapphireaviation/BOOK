import "server-only";

const EARTH_RADIUS_KM = 6371.0088;

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in kilometres (haversine). */
export function greatCircleKm(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function kmToMiles(km: number) {
  return km / 1.609344;
}

/**
 * Approximate gate to gate time for a nonstop flight: an average block speed of 800 km/h
 * plus 30 minutes for taxi, climb and approach, rounded to 5 minutes. It is an estimate from
 * distance alone; winds and routings change real schedules.
 */
export function approxFlightMinutes(km: number) {
  const minutes = 30 + (km / 800) * 60;
  return Math.max(35, Math.round(minutes / 5) * 5);
}
