import { site } from "@/config/site";
import { amenityKeys } from "@/lib/amenities";
import { cabinClasses } from "@/lib/search-params";

/**
 * OpenAPI 3.1 description of the public API. Written for GPT Actions:
 * every operation has an operationId, short summaries, and descriptions
 * that tell the model which values to send.
 */

type Param = { name: string; in: "query" | "path"; required?: boolean; description: string; schema: Record<string, unknown> };

const q = (name: string, description: string, schema: Record<string, unknown>, required = false): Param => ({ name, in: "query", required, description, schema });
const date = { type: "string", format: "date", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };

const sentence = q(
  "q",
  "The traveler's request in their own words. Read first; explicit parameters override it. Example: 'villa in goa next weekend for 4 under 6000 a night with pool'.",
  { type: "string", maxLength: 500 },
);

const money = {
  type: "object",
  description: "An amount in minor units (paise for INR, cents for USD) with its currency and a formatted string.",
  properties: { amount: { type: "integer" }, currency: { type: "string", example: "INR" }, text: { type: "string", example: "₹4,820" } },
  required: ["amount", "currency", "text"],
};

const error = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string", enum: ["invalid_request", "not_found", "unavailable", "expired", "rate_limited"] },
        message: { type: "string", description: "What went wrong and what to do. Safe to show the traveler." },
        issues: { type: "array", items: { type: "object", properties: { field: { type: "string" }, message: { type: "string" } } } },
        understood: { type: "array", items: { type: "string" }, description: "When q was sent: what was understood from it." },
        missing: { type: "array", items: { type: "string" }, description: "When q was sent: fields still needed. Ask the traveler for these." },
      },
      required: ["code", "message"],
    },
  },
};

const errorResponses = {
  "400": { description: "Missing or invalid parameters. Ask the traveler for the missing details.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  "429": {
    description: "Too many requests. Wait for the number of seconds in Retry-After.",
    headers: { "Retry-After": { schema: { type: "integer" } } },
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  },
  "503": { description: "Search is temporarily unavailable.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
};

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: `${site.name} travel search API`,
      version: "1.0.0",
      description: `Search flights sold at the airline's own fare and stays listed by their owners on ${site.name}. Nobody pays a platform fee. Results include absolute links where the traveler books on the website. No API key needed; rate limited per IP.`,
      contact: { email: site.supportEmail, url: `${site.url}/developers` },
      termsOfService: `${site.url}/terms`,
    },
    servers: [{ url: site.url }],
    externalDocs: { description: "Developer guide", url: `${site.url}/developers` },
    paths: {
      "/api/v1/search/stays": {
        get: {
          operationId: "searchStays",
          summary: "Search places to stay",
          description: "Find stays with live prices for the dates. Send place, checkin and checkout, or send q with the traveler's sentence. Show the traveler each result's url to book.",
          parameters: [
            sentence,
            q("place", "Destination slug or name, e.g. 'goa' or 'north goa'.", { type: "string", maxLength: 120 }),
            q("checkin", "Check in date, YYYY-MM-DD.", date),
            q("checkout", "Check out date, YYYY-MM-DD, after checkin.", date),
            q("adults", "Adults, 1 to 16. Default 2.", { type: "integer", minimum: 1, maximum: 16 }),
            q("children", "Children under 18. Default 0.", { type: "integer", minimum: 0, maximum: 10 }),
            q("rooms", "Rooms or units needed. Default 1.", { type: "integer", minimum: 1, maximum: 8 }),
            q("minPrice", "Lowest price per night in minor units (paise for INR).", { type: "integer", minimum: 0 }),
            q("maxPrice", "Highest price per night in minor units (paise for INR: 400000 is ₹4,000).", { type: "integer", minimum: 1 }),
            q("types", "Comma separated property types: hotel, guesthouse, homestay, apartment, house, villa, hostel, resort, cabin.", { type: "string" }),
            q("amenities", `Comma separated amenity keys that must all be present: ${amenityKeys.join(", ")}.`, { type: "string" }),
            q("freeCancellation", "Only stays with free cancellation.", { type: "boolean" }),
            q("instantBook", "Only stays that confirm instantly.", { type: "boolean" }),
            q("minRating", "Lowest average guest rating, 0 to 5.", { type: "number", minimum: 0, maximum: 5 }),
            q("sort", "Result order.", { type: "string", enum: ["recommended", "price_asc", "price_desc", "rating"] }),
            q("page", "Page number, 20 results per page.", { type: "integer", minimum: 1, maximum: 50 }),
          ],
          responses: { "200": { description: "Matching stays.", content: { "application/json": { schema: { $ref: "#/components/schemas/StaySearch" } } } }, ...errorResponses },
        },
      },
      "/api/v1/search/flights": {
        get: {
          operationId: "searchFlights",
          summary: "Search flights",
          description: "Search airline fares. Send from, to and depart as IATA codes and a date, or send q with the traveler's sentence. Show the traveler each offer's bookUrl. One way unless return is set.",
          parameters: [
            sentence,
            q("from", "Departure airport IATA code, e.g. DEL.", { type: "string", pattern: "^[A-Za-z]{3}$" }),
            q("to", "Arrival airport IATA code, e.g. GOI.", { type: "string", pattern: "^[A-Za-z]{3}$" }),
            q("depart", "Departure date, YYYY-MM-DD.", date),
            q("return", "Return date for a round trip, YYYY-MM-DD.", date),
            q("adults", "Passengers aged 12 or over. Default 1.", { type: "integer", minimum: 1, maximum: 9 }),
            q("children", "Passengers aged 2 to 11.", { type: "integer", minimum: 0, maximum: 8 }),
            q("infants", "Babies under 2, at most one per adult.", { type: "integer", minimum: 0, maximum: 4 }),
            q("cabin", "Cabin class. Default economy.", { type: "string", enum: [...cabinClasses] }),
            q("stops", "Most stops allowed. 0 for non-stop only.", { type: "integer", minimum: 0, maximum: 2 }),
            q("airlines", "Comma separated airline IATA codes to include, e.g. '6E,AI'.", { type: "string" }),
            q("maxPrice", "Highest total fare in minor units.", { type: "integer", minimum: 1 }),
            q("departWindow", "Departure time of day.", { type: "string", enum: ["early", "morning", "afternoon", "evening"] }),
            q("sort", "Result order.", { type: "string", enum: ["price", "duration", "depart"] }),
            q("limit", "How many offers to return, 1 to 50. Default 20.", { type: "integer", minimum: 1, maximum: 50 }),
          ],
          responses: { "200": { description: "Matching fares.", content: { "application/json": { schema: { $ref: "#/components/schemas/FlightSearch" } } } }, ...errorResponses },
        },
      },
      "/api/v1/search/flights/offers/{offerId}": {
        get: {
          operationId: "getFlightOffer",
          summary: "Check one fare",
          description: "Current price, conditions and expiry of a fare returned by searchFlights. Call it before sending the traveler to book.",
          parameters: [{ name: "offerId", in: "path", required: true, description: "The id of an offer from searchFlights.", schema: { type: "string" } }],
          responses: {
            "200": { description: "The fare.", content: { "application/json": { schema: { type: "object", properties: { offer: { $ref: "#/components/schemas/FlightOffer" }, note: { type: "string" } } } } } },
            "410": { description: "The fare has expired. Search again.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            ...errorResponses,
          },
        },
      },
      "/api/v1/listings/{slug}": {
        get: {
          operationId: "getListing",
          summary: "Get one stay",
          description: "Full details of a stay by its slug, the last part of a stay url. Pass checkin and checkout to get a url that opens with those dates.",
          parameters: [
            { name: "slug", in: "path", required: true, description: "Listing slug, e.g. 'sea-breeze-villa-candolim'.", schema: { type: "string" } },
            q("checkin", "Check in date, YYYY-MM-DD.", date),
            q("checkout", "Check out date, YYYY-MM-DD.", date),
            q("adults", "Adults, 1 to 16.", { type: "integer", minimum: 1, maximum: 16 }),
          ],
          responses: {
            "200": { description: "The stay.", content: { "application/json": { schema: { $ref: "#/components/schemas/Listing" } } } },
            "404": { description: "No published stay has that slug.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            ...errorResponses,
          },
        },
      },
    },
    components: {
      schemas: {
        Money: money,
        Error: error,
        Stay: {
          type: "object",
          properties: {
            name: { type: "string" },
            url: { type: "string", format: "uri", description: "Open this to see the stay and book it for the searched dates." },
            type: { type: "string" },
            city: { type: "string" },
            region: { type: ["string", "null"] },
            summary: { type: "string" },
            rating: { type: ["number", "null"] },
            reviews: { type: "integer" },
            maxGuests: { type: "integer" },
            bedrooms: { type: "integer" },
            amenities: { type: "array", items: { type: "string" } },
            freeCancellation: { type: "boolean" },
            instantBook: { type: "boolean" },
            nights: { type: "integer" },
            perNight: { $ref: "#/components/schemas/Money" },
            total: { $ref: "#/components/schemas/Money" },
            photo: { type: ["object", "null"], properties: { url: { type: "string" }, alt: { type: "string" } } },
          },
        },
        StaySearch: {
          type: "object",
          properties: {
            query: { type: "object", description: "The search that ran, after reading q." },
            understood: { type: "array", items: { type: "string" } },
            place: { type: ["object", "null"], properties: { name: { type: "string" }, slug: { type: ["string", "null"] } } },
            total: { type: "integer" },
            page: { type: "integer" },
            pageSize: { type: "integer" },
            results: { type: "array", items: { $ref: "#/components/schemas/Stay" } },
            searchUrl: { type: "string", format: "uri", description: "The same search on the website." },
            nextPage: { type: ["string", "null"] },
            note: { type: "string" },
          },
        },
        FlightOffer: {
          type: "object",
          properties: {
            id: { type: "string" },
            airline: { type: "string" },
            price: { $ref: "#/components/schemas/Money" },
            baseFare: { $ref: "#/components/schemas/Money" },
            taxes: { $ref: "#/components/schemas/Money" },
            slices: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string" },
                  to: { type: "string" },
                  depart: { type: "string", description: "Local time at the departure airport." },
                  arrive: { type: "string", description: "Local time at the arrival airport." },
                  duration: { type: "string" },
                  stops: { type: "integer" },
                  via: { type: "array", items: { type: "string" } },
                  flights: { type: "array", items: { type: "string" } },
                  fareBrand: { type: ["string", "null"] },
                },
              },
            },
            refundable: { type: "boolean" },
            changeable: { type: "boolean" },
            checkedBags: { type: ["integer", "null"] },
            cabinBags: { type: ["integer", "null"] },
            expiresAt: { type: "string", format: "date-time" },
            bookUrl: { type: "string", format: "uri", description: "Open this to book the fare." },
          },
        },
        FlightSearch: {
          type: "object",
          properties: {
            query: { type: "object" },
            understood: { type: "array", items: { type: "string" } },
            count: { type: "integer" },
            offers: { type: "array", items: { $ref: "#/components/schemas/FlightOffer" } },
            searchUrl: { type: "string", format: "uri" },
            note: { type: "string" },
          },
        },
        Listing: {
          type: "object",
          properties: {
            name: { type: "string" },
            slug: { type: "string" },
            url: { type: "string", format: "uri" },
            type: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            location: { type: "object", properties: { city: { type: "string" }, region: { type: ["string", "null"] }, country: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } } },
            rating: { type: ["number", "null"] },
            reviews: { type: "integer" },
            maxGuests: { type: "integer" },
            bedrooms: { type: "integer" },
            beds: { type: "integer" },
            bathrooms: { type: "number" },
            checkInFrom: { type: "string" },
            checkOutUntil: { type: "string" },
            amenities: { type: "array", items: { type: "string" } },
            cancellation: { type: "string" },
            instantBook: { type: "boolean" },
            fromPrice: { $ref: "#/components/schemas/Money" },
            units: { type: "array", items: { type: "object", properties: { name: { type: "string" }, maxGuests: { type: "integer" }, beds: { type: "string" }, nightlyFrom: { $ref: "#/components/schemas/Money" } } } },
            photos: { type: "array", items: { type: "object", properties: { url: { type: "string" }, alt: { type: "string" } } } },
            updatedAt: { type: "string" },
            note: { type: "string" },
          },
        },
      },
    },
  };
}
