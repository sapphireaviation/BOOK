import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { site } from "@/config/site";
import { amenityKeys } from "@/lib/amenities";
import { cabinClasses } from "@/lib/search-params";
import { getListingPublicApi, getOfferPublic, parseTripPublic, searchFlightsPublic, searchStaysPublic } from "@/server/ai/public-api";
import { clientIp, consume, policies, rateLimitHeaders } from "@/server/rate-limit";

/**
 * MCP server over Streamable HTTP at /api/mcp. Read only tools, no auth.
 * Every tool returns compact JSON text with absolute links the person can open to book.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const instructions = [
  `${site.name} sells flights at the airline's own fare and stays at the owner's own price, with no platform fee for anyone.`,
  "Use search_flights or search_stays with structured filters when you know the details, or parse_trip_request to turn the person's own sentence into filters and see what is missing.",
  "Prices are integers in minor units (paise for INR, cents for USD) next to a currency code, plus a formatted text version.",
  "Always give the person the url or bookUrl from the result so they can book on the site. Bookings and payments happen on the website, not through these tools.",
].join(" ");

type Result = { ok: true; data: unknown } | { ok: false; status: number; error: { message: string } & Record<string, unknown> };

function toolResult(result: Result) {
  if (result.ok) return { content: [{ type: "text" as const, text: JSON.stringify(result.data) }] };
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: result.error }) }], isError: true };
}

const mcp = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_stays",
      {
        title: "Search stays",
        description:
          "Find places to stay (hotels, homestays, villas, apartments, hostels) listed directly by their owners, with live prices for the dates. Returns up to 20 stays per page with nightly and total price, rating, amenities and a url to book. Either pass `q` with the traveler's own words, or pass place and dates; explicit fields override what `q` implies.",
        inputSchema: z.object({
          q: z.string().max(500).optional().describe("The traveler's request in their own words, e.g. 'villa in north goa next weekend for 4 under 6000 a night with pool'."),
          place: z.string().max(120).optional().describe("Destination slug or name, e.g. 'goa', 'manali', 'south delhi'."),
          checkin: isoDate.optional().describe("Check in date, YYYY-MM-DD."),
          checkout: isoDate.optional().describe("Check out date, YYYY-MM-DD, after check in."),
          adults: z.number().int().min(1).max(16).optional().describe("Adults, default 2."),
          children: z.number().int().min(0).max(10).optional().describe("Children under 18, default 0."),
          rooms: z.number().int().min(1).max(8).optional().describe("Rooms or units needed, default 1."),
          maxPrice: z.number().int().positive().optional().describe("Highest price per night in minor units (paise for INR: 400000 means ₹4,000)."),
          minPrice: z.number().int().nonnegative().optional().describe("Lowest price per night in minor units."),
          types: z.string().optional().describe("Comma separated property types: hotel, guesthouse, homestay, apartment, house, villa, hostel, resort, cabin."),
          amenities: z.string().optional().describe(`Comma separated amenity keys, all required: ${amenityKeys.join(", ")}.`),
          freeCancellation: z.boolean().optional().describe("Only stays with a flexible or moderate cancellation policy."),
          instantBook: z.boolean().optional().describe("Only stays that confirm instantly."),
          minRating: z.number().min(0).max(5).optional().describe("Lowest average guest rating, 0 to 5."),
          sort: z.enum(["recommended", "price_asc", "price_desc", "rating"]).optional(),
          page: z.number().int().min(1).max(50).optional(),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args) => toolResult(await searchStaysPublic(args, "mcp")),
    );

    server.registerTool(
      "search_flights",
      {
        title: "Search flights",
        description:
          "Search airline fares sold directly by the airlines, at the airline's own price with no markup. Returns offers with total price, times, stops, baggage and refund conditions, and a bookUrl. Use IATA airport codes (DEL, BOM, GOI); call parse_trip_request first if you only have city names. One way unless `return` is set.",
        inputSchema: z.object({
          q: z.string().max(500).optional().describe("The traveler's request in their own words, e.g. 'delhi to goa next friday back sunday, 2 adults'."),
          from: z.string().length(3).optional().describe("Departure airport IATA code, e.g. DEL."),
          to: z.string().length(3).optional().describe("Arrival airport IATA code, e.g. GOI."),
          depart: isoDate.optional().describe("Departure date, YYYY-MM-DD."),
          return: isoDate.optional().describe("Return date for a round trip, YYYY-MM-DD. Leave out for one way."),
          adults: z.number().int().min(1).max(9).optional().describe("Passengers aged 12 or over, default 1."),
          children: z.number().int().min(0).max(8).optional().describe("Passengers aged 2 to 11."),
          infants: z.number().int().min(0).max(4).optional().describe("Babies under 2 on a lap, at most one per adult."),
          cabin: z.enum(cabinClasses).optional().describe("Cabin class, default economy."),
          stops: z.number().int().min(0).max(2).optional().describe("Most stops allowed. 0 for non-stop only."),
          airlines: z.string().optional().describe("Comma separated airline IATA codes to include, e.g. '6E,AI'."),
          maxPrice: z.number().int().positive().optional().describe("Highest total fare in minor units."),
          departWindow: z.enum(["early", "morning", "afternoon", "evening"]).optional(),
          sort: z.enum(["price", "duration", "depart"]).optional(),
          limit: z.number().int().min(1).max(50).optional().describe("How many offers to return, default 10."),
        }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ limit, ...args }) => toolResult(await searchFlightsPublic(args, "mcp", limit ?? 10)),
    );

    server.registerTool(
      "get_listing",
      {
        title: "Get a stay",
        description:
          "Full details of one stay by its slug (the last part of its url): description, rooms, amenities, check in times, cancellation policy, rating and photos. Pass dates to get a url that opens with those dates selected.",
        inputSchema: z.object({
          slug: z.string().min(1).max(120).describe("Listing slug from a search result url, e.g. 'sea-breeze-villa-candolim'."),
          checkin: isoDate.optional(),
          checkout: isoDate.optional(),
          adults: z.number().int().min(1).max(16).optional(),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ slug, checkin, checkout, adults }) =>
        toolResult(await getListingPublicApi(slug.toLowerCase(), checkin && checkout ? { checkin, checkout, adults } : undefined)),
    );

    server.registerTool(
      "get_flight_offer",
      {
        title: "Check a fare",
        description: "Re-check one flight offer by id from search_flights: current price, conditions and expiry. Use it before sending the person to book.",
        inputSchema: z.object({ offerId: z.string().min(4).max(100).describe("The id of an offer returned by search_flights.") }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async ({ offerId }) => toolResult(await getOfferPublic(offerId)),
    );

    server.registerTool(
      "parse_trip_request",
      {
        title: "Read a trip request",
        description:
          "Turn a sentence such as 'family of four in goa next weekend under 5000 a night with pool' into structured flight or stay filters. Returns what was understood, which fields are still missing, and a searchUrl when nothing is missing. Dates are resolved against today's date in India.",
        inputSchema: z.object({ text: z.string().min(2).max(500).describe("The traveler's request in their own words.") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ text }) => toolResult({ ok: true, data: await parseTripPublic(text) }),
    );
  },
  { serverInfo: { name: site.name, version: "1.0.0" }, instructions },
);

async function handler(req: Request) {
  // Discovery and GET probes are cheap; spend tokens only on JSON-RPC posts.
  if (req.method === "POST") {
    const r = await consume(`mcp:${clientIp(req.headers)}`, policies.mcp);
    if (!r.ok) {
      return Response.json(
        { jsonrpc: "2.0", id: null, error: { code: -32029, message: `Too many requests. Try again in ${r.retryAfter} seconds.` } },
        { status: 429, headers: rateLimitHeaders(r) },
      );
    }
  }
  return mcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
