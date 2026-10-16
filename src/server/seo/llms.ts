import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { absoluteUrl, site } from "@/config/site";
import { amenityGroups, cancellationPolicyText, propertyTypeLabels } from "@/lib/amenities";
import { formatMoney } from "@/lib/money";
import { mcpTools } from "@/server/ai/mcp-info";
import { getIndexableDestinations, getRoutes, type SeoDestination } from "./data";
import { staticPages } from "./pages";

/** Text for /llms.txt and /llms-full.txt, following https://llmstxt.org. */

function fromPrice(d: SeoDestination) {
  if (!d.fromPrice || !d.currency) return "";
  return `, from ${formatMoney({ amount: d.fromPrice, currency: d.currency }, site.defaultLocale)} a night`;
}

function monthYear() {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date());
}

export async function llmsTxt(): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag("seo", "llms");
  const [destinations, routes] = await Promise.all([getIndexableDestinations(20), getRoutes(20)]);
  const page = (path: string) => staticPages.find((p) => p.path === path)?.title ?? path;

  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${site.name} is a travel booking site. Flights come straight from airlines and are sold at the airline's fare. Stays are listed by their owners and sold at the owner's price. Travelers and hosts pay no platform fee; every price breakdown shows a platform fee of 0. Prices are in ${site.defaultCurrency} unless a listing or fare says otherwise.`,
    "",
    "Assistants can search and link to bookings without an API key: use the MCP server or the REST API below and give the person the returned url to book.",
    "",
    "## Search and book",
    "",
    `- [Search flights](${absoluteUrl("/flights")}): one way and return fares by route, date, passengers and cabin`,
    `- [Search stays](${absoluteUrl("/stays")}): homes, hotels, homestays and villas by place, dates and guests`,
    `- [Search with a sentence](${absoluteUrl("/search?q=villa%20in%20goa%20next%20weekend%20for%204")}): describe the trip in plain words`,
    "",
    "## For AI assistants and developers",
    "",
    `- [Full guide for language models](${absoluteUrl("/llms-full.txt")}): search parameters, filters, policies, destinations and routes in one file`,
    `- [MCP server](${absoluteUrl("/api/mcp")}): Streamable HTTP, no auth. Tools: ${Object.keys(mcpTools).join(", ")}`,
    `- [OpenAPI 3.1](${absoluteUrl("/openapi.json")}): REST API for stay search, flight search, listings and fares; works as a ChatGPT action`,
    `- [Developer guide](${absoluteUrl("/developers")}): how to connect Claude, ChatGPT and other assistants, with rate limits`,
    "",
    "## Policies",
    "",
    `- [${page("/how-it-works")}](${absoluteUrl("/how-it-works")})`,
    `- [${page("/cancellation")}](${absoluteUrl("/cancellation")})`,
    `- [${page("/help")}](${absoluteUrl("/help")})`,
    `- [${page("/terms")}](${absoluteUrl("/terms")})`,
    `- [${page("/privacy")}](${absoluteUrl("/privacy")})`,
  ];

  if (destinations.length) {
    lines.push("", "## Top destinations for stays", "");
    for (const d of destinations) lines.push(`- [Stays in ${d.name}](${absoluteUrl(`/stays/${d.slug}`)}): ${d.listings} places to stay${fromPrice(d)}`);
  }
  if (routes.length) {
    lines.push("", "## Popular flight routes", "");
    for (const r of routes) lines.push(`- [Flights from ${r.originCity} to ${r.destinationCity}](${absoluteUrl(`/flights/${r.slug}`)}): ${r.origin} to ${r.destination}`);
  }

  lines.push("", "## Optional", "", `- [${page("/hosting")}](${absoluteUrl("/hosting")}): list a property with no commission`, `- [Contact support](mailto:${site.supportEmail})`, "");
  return lines.join("\n");
}

export async function llmsFullTxt(): Promise<string> {
  "use cache";
  cacheLife("hours");
  cacheTag("seo", "llms");
  const [destinations, routes] = await Promise.all([getIndexableDestinations(100), getRoutes(100)]);
  const asOf = monthYear();

  const s: string[] = [];
  s.push(
    `# ${site.name}: full guide for language models`,
    "",
    `> ${site.description}`,
    "",
    `Operated by ${site.legalName}. Support: ${site.supportEmail}. Website: ${site.url}. This file is generated from live data; figures are as of ${asOf}.`,
    "",
    "## What the site sells",
    "",
    "- Flights: fares come directly from airline systems through a flight aggregator. The price shown is the airline's fare including taxes. Nothing is added.",
    "- Stays: places listed by their owners (hotels, guesthouses, homestays, apartments, houses, villas, hostels, resorts, cabins). The price shown is the owner's nightly price plus any cleaning fee and taxes the owner charges.",
    "",
    "## The zero fee rule",
    "",
    "Travelers pay no booking or convenience fee. Hosts pay no commission. Every price breakdown ends with a platform fee line of 0. Payment processing is handled by the payment provider; the amount you see at checkout is the amount charged.",
    "",
    "## How search works",
    "",
    "Search pages have stable, shareable URLs. An assistant can build them directly.",
    "",
    "Flights: `/flights/search?from=DEL&to=GOI&depart=2026-10-24&return=2026-10-27&adults=1&children=0&infants=0&cabin=economy`",
    "",
    "- `from`, `to`: IATA airport codes",
    "- `depart`, `return`: dates as YYYY-MM-DD; leave out `return` for one way",
    "- `adults` (1 to 9), `children` (0 to 8), `infants` (0 to 4, at most one per adult)",
    "- `cabin`: economy, premium_economy, business or first",
    "- Filters: `stops` (most stops, 0 for non-stop), `airlines` (comma separated IATA codes), `maxPrice` (minor units), `departWindow` (early, morning, afternoon, evening), `sort` (price, duration, depart)",
    "",
    "Stays: `/stays/search?place=goa&checkin=2026-10-24&checkout=2026-10-27&adults=2&children=0&rooms=1`",
    "",
    "- `place`: destination slug or a place name",
    "- `checkin`, `checkout`: dates as YYYY-MM-DD",
    "- `adults` (1 to 16), `children` (0 to 10), `rooms` (1 to 8)",
    "- Filters: `minPrice` and `maxPrice` per night in minor units (paise for INR, so ₹4,000 is 400000), `types`, `amenities`, `freeCancellation=true`, `instantBook=true`, `minRating` (0 to 5), `sort` (recommended, price_asc, price_desc, rating), `page`",
    "",
    "Sentence search: `/search?q=<words>` reads a sentence such as \"2 adults and a child in goa next weekend under ₹4,000 a night with pool\", shows what it understood and asks for anything missing.",
    "",
    `Property types: ${Object.entries(propertyTypeLabels)
      .filter(([k]) => k !== "other")
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}.`,
    "",
    "Amenity keys:",
    "",
  );
  for (const g of amenityGroups) s.push(`- ${g.group}: ${g.items.map((i) => `${i.key} (${i.label})`).join(", ")}`);
  s.push("", "## Cancellation policies for stays", "", "Each listing has one of these policies, shown before booking and copied onto the booking:", "");
  for (const p of Object.values(cancellationPolicyText)) s.push(`- ${p.label}: ${p.summary}`);
  s.push(
    "",
    "Flight changes and refunds follow the airline's fare rules, shown on each fare as refundable or not and changeable or not, with any penalty.",
    "",
    "## Booking",
    "",
    "Bookings are made on the website. A traveler picks a fare or a stay, enters contact details (and passenger details for flights), and pays. Payment is taken by Razorpay for Indian payment methods (UPI, cards, net banking) or Stripe for international cards. A flight booking is confirmed when the airline issues the ticket; the airline booking reference is shown on the confirmation. A stay booking is confirmed once the payment is captured.",
    "",
    "## API and MCP for assistants",
    "",
    `- MCP server: ${absoluteUrl("/api/mcp")} (Streamable HTTP, no authentication, read only)`,
  );
  for (const [name, t] of Object.entries(mcpTools)) s.push(`  - ${name}: ${t.description}`);
  s.push(
    `- REST API described by ${absoluteUrl("/openapi.json")}:`,
    `  - GET ${absoluteUrl("/api/v1/search/stays")}?place=goa&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&adults=2`,
    `  - GET ${absoluteUrl("/api/v1/search/flights")}?from=DEL&to=GOI&depart=YYYY-MM-DD&adults=1`,
    `  - GET ${absoluteUrl("/api/v1/search/flights/offers/{offerId}")}`,
    `  - GET ${absoluteUrl("/api/v1/listings/{slug}")}`,
    "  - Both search endpoints also accept `q`, the traveler's own sentence, which is read first; explicit parameters override it.",
    "- Results include absolute `url` or `bookUrl` links. Give these to the person so they can book.",
    "- Rate limits: about 30 requests a minute per IP for the REST API and 60 for MCP. A 429 response carries a Retry-After header.",
  );

  if (destinations.length) {
    s.push("", "## Destinations with stays", "");
    for (const d of destinations) {
      const where = [d.region, d.countryName].filter(Boolean).join(", ");
      s.push(`- ${d.name} (${where}): ${d.listings} places to stay${fromPrice(d)} as of ${asOf}. ${absoluteUrl(`/stays/${d.slug}`)}`);
    }
  }
  if (routes.length) {
    s.push("", "## Flight routes with guides", "");
    for (const r of routes) s.push(`- ${r.originCity} (${r.origin}) to ${r.destinationCity} (${r.destination}): ${absoluteUrl(`/flights/${r.slug}`)}`);
  }
  s.push("", "## Key pages", "");
  for (const p of staticPages) s.push(`- ${p.title}: ${absoluteUrl(p.path)}`);
  s.push("");
  return s.join("\n");
}
