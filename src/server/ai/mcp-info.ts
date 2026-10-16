import { site } from "@/config/site";

/** Tool names and descriptions shared by the MCP server, /.well-known/mcp.json and the developer page. */
export const mcpTools = {
  search_stays: {
    title: "Search stays",
    description:
      "Find places to stay (hotels, homestays, villas, apartments, hostels) listed directly by their owners, with live prices for the dates. Returns up to 20 stays per page with nightly and total price, rating, amenities and a url to book. Either pass `q` with the traveler's own words, or pass place and dates; explicit fields override what `q` implies.",
  },
  search_flights: {
    title: "Search flights",
    description:
      "Search airline fares sold directly by the airlines, at the airline's own price with no markup. Returns offers with total price, times, stops, baggage and refund conditions, and a bookUrl. Use IATA airport codes (DEL, BOM, GOI); call parse_trip_request first if you only have city names. One way unless `return` is set.",
  },
  get_listing: {
    title: "Get a stay",
    description:
      "Full details of one stay by its slug (the last part of its url): description, rooms, amenities, check in times, cancellation policy, rating and photos. Pass dates to get a url that opens with those dates selected.",
  },
  get_flight_offer: {
    title: "Check a fare",
    description: "Re-check one flight offer by id from search_flights: current price, conditions and expiry. Use it before sending the person to book.",
  },
  parse_trip_request: {
    title: "Read a trip request",
    description:
      "Turn a sentence such as 'family of four in goa next weekend under 5000 a night with pool' into structured flight or stay filters. Returns what was understood, which fields are still missing, and a searchUrl when nothing is missing. Dates are resolved against today's date.",
  },
} as const;

export type McpToolName = keyof typeof mcpTools;

export const mcpInstructions = [
  `${site.name} sells flights at the airline's own fare and stays at the owner's own price, with no platform fee for anyone.`,
  "Use search_flights or search_stays with structured filters when you know the details, or parse_trip_request to turn the person's own sentence into filters and see what is missing.",
  "Prices are integers in minor units (paise for INR, cents for USD) next to a currency code, plus a formatted text version.",
  "Always give the person the url or bookUrl from the result so they can book on the site. Bookings and payments happen on the website, not through these tools.",
].join(" ");

/** Public API limits, stated once for the docs pages. Keep in step with `policies` in src/server/rate-limit.ts. */
export const publicLimits = {
  api: { burst: 30, perMinute: 30 },
  mcp: { burst: 60, perMinute: 60 },
};
