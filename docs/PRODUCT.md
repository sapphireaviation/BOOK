# Product

## What it is

A travel booking site where nobody pays a platform fee. Travelers book flights at the airline's own fare and book stays at the owner's own price. Owners keep everything they charge.

Two kinds of inventory:

1. **Flights**, sold directly from airline systems through an NDC aggregator (Duffel by default, swappable behind `FlightProvider`). We add no markup.
2. **Listings**, created by owners on our site: homes, rooms, hotels, hostels, and later experiences and transport. One listing has one or more bookable units (a room type, a whole home, a tour slot) with per-date inventory and price.

## Who it is for

- Travelers who compare fares and are tired of convenience fees at checkout.
- Small hotels, guesthouses and home owners who lose 15 to 25 percent to large platforms.
- People who plan trips by asking an assistant (ChatGPT, Claude, Perplexity, Gemini). Our inventory must be searchable and bookable from those assistants.

## Launch scope (day 3)

A visitor can:

- Search flights by route, dates and passengers. See real fares, a cheapest-date strip, filters (stops, airline, departure time, price), and fare conditions.
- Book a flight: passenger details, pay, receive a confirmation with the airline booking reference.
- Search stays by place, dates and guests, or by a sentence such as "quiet place near the beach in Goa under 4000 a night for 2 next weekend".
- See a listing page with photos, map, amenities, house rules, cancellation policy, reviews and a live price for the chosen dates.
- Book a stay: dates, guests, contact details, pay, receive a confirmation.
- Create an account, see trips, cancel within policy.
- Read destination and route guides (programmatic SEO pages).

An owner can:

- Sign up, create a listing with photos and units, set prices and availability per date, publish.
- See bookings, guest contact details and payouts owed.

An operator (admin) can:

- See all bookings and payments, refund, suspend a listing, verify a host.

An AI assistant can:

- Discover the site through `llms.txt`, schema.org markup and the OpenAPI document.
- Call our MCP server to search flights and stays with structured filters and hand the user a booking link.

## Out of scope for launch

Loyalty points, package deals, trains and buses, multi-city flight search, seat maps, ancillaries (bags, meals), host messaging (we show contact details after booking instead), native apps.

## Definition of done for launch

- `pnpm build` passes with zero type errors.
- A full stay booking and a full test-mode flight booking succeed end to end on the deployed URL with test payment keys.
- Lighthouse on home, search results and listing pages: Performance 90+, Accessibility 100, SEO 100 on mobile.
- Every public page has a title, description, canonical URL, Open Graph image and valid JSON-LD.
- No em or en dashes in user-facing copy (`pnpm lint:copy`).
