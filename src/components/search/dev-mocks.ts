/**
 * Development only. Loaded by suggest.ts when NEXT_PUBLIC_SEARCH_MOCKS=1 and the real endpoint
 * is not available yet. Never imported in production builds.
 */
import type { AirportSuggestion, PlaceSuggestion } from "./suggest";

const airports: AirportSuggestion[] = [
  { iata: "DEL", name: "Indira Gandhi International Airport", city: "Delhi", countryCode: "IN", countryName: "India" },
  { iata: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", countryCode: "IN", countryName: "India" },
  { iata: "GOI", name: "Dabolim Airport", city: "Goa", countryCode: "IN", countryName: "India" },
  { iata: "GOX", name: "Manohar International Airport", city: "Goa", countryCode: "IN", countryName: "India" },
  { iata: "BLR", name: "Kempegowda International Airport", city: "Bengaluru", countryCode: "IN", countryName: "India" },
  { iata: "MAA", name: "Chennai International Airport", city: "Chennai", countryCode: "IN", countryName: "India" },
  { iata: "CCU", name: "Netaji Subhas Chandra Bose International Airport", city: "Kolkata", countryCode: "IN", countryName: "India" },
  { iata: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", countryCode: "IN", countryName: "India" },
  { iata: "JAI", name: "Jaipur International Airport", city: "Jaipur", countryCode: "IN", countryName: "India" },
  { iata: "COK", name: "Cochin International Airport", city: "Kochi", countryCode: "IN", countryName: "India" },
  { iata: "DXB", name: "Dubai International Airport", city: "Dubai", countryCode: "AE", countryName: "United Arab Emirates" },
  { iata: "SIN", name: "Singapore Changi Airport", city: "Singapore", countryCode: "SG", countryName: "Singapore" },
  { iata: "LHR", name: "Heathrow Airport", city: "London", countryCode: "GB", countryName: "United Kingdom" },
];

const places: PlaceSuggestion[] = [
  { slug: "goa", name: "Goa", region: "Goa", countryName: "India", listingCount: 42 },
  { slug: "north-goa", name: "North Goa", region: "Goa", countryName: "India", listingCount: 18 },
  { slug: "jaipur", name: "Jaipur", region: "Rajasthan", countryName: "India", listingCount: 12 },
  { slug: "udaipur", name: "Udaipur", region: "Rajasthan", countryName: "India", listingCount: 9 },
  { slug: "manali", name: "Manali", region: "Himachal Pradesh", countryName: "India", listingCount: 7 },
  { slug: "kochi", name: "Kochi", region: "Kerala", countryName: "India", listingCount: 5 },
  { slug: "munnar", name: "Munnar", region: "Kerala", countryName: "India", listingCount: 0 },
  { slug: "rishikesh", name: "Rishikesh", region: "Uttarakhand", countryName: "India", listingCount: 6 },
];

const delay = () => new Promise((r) => setTimeout(r, 150));

export async function mockAirports(q: string) {
  await delay();
  if (q.toLowerCase() === "fail") throw new Error("Mock failure");
  const s = q.trim().toLowerCase();
  return airports.filter((a) => a.iata.toLowerCase().startsWith(s) || a.city.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)).slice(0, 8);
}

export async function mockPlaces(q: string) {
  await delay();
  if (q.toLowerCase() === "fail") throw new Error("Mock failure");
  const s = q.trim().toLowerCase();
  return places.filter((p) => p.name.toLowerCase().includes(s) || p.slug.includes(s.replace(/\s+/g, "-")) || (p.region ?? "").toLowerCase().includes(s)).slice(0, 8);
}
