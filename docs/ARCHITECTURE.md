# Architecture

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript | Server rendering for SEO, Cache Components for a fast static shell |
| Styling | Tailwind CSS 4 with tokens in `src/app/globals.css` | One source for design tokens |
| Database | Postgres via `DATABASE_URL` (Supabase in production) | Portable; works with any Postgres |
| ORM | Drizzle | Typed SQL, plain migrations in `drizzle/` |
| Auth | Better Auth (email and password, Google, magic link) | Runs on our own Postgres tables, no vendor lock |
| Flights | `FlightProvider` interface, Duffel adapter | Direct airline NDC content, test mode for development |
| Payments | `PaymentProvider` interface, Razorpay and Stripe adapters | Razorpay for India, Stripe for international cards |
| Email | Resend | Transactional email |
| Files | Vercel Blob | Listing photos |
| AI | Anthropic API (optional) for natural language search parsing, with a deterministic fallback | Search works without a key |
| Hosting | Vercel | Native Next.js support |

See `docs/decisions/` for the reasoning behind each choice.

## Module boundaries

```
route / server action / MCP tool
        │  (validates input with zod, checks auth)
        ▼
src/server/<domain>/*.ts        domain services, import "server-only"
        │
        ├── src/db               drizzle queries
        └── providers            flights/duffel.ts, payments/razorpay.ts, payments/stripe.ts
```

Rules:

- `src/server/**` files start with `import "server-only"`.
- Components never import from `src/db` directly. They call a service.
- Provider SDKs are only imported inside their adapter file.
- Every money value is `{ amount: number /* minor units */, currency: string }`.

## Data model

One schema file per domain in `src/db/schema/`:

- `auth.ts`: `user`, `session`, `account`, `verification` (Better Auth), plus `user.role` (`traveler`, `host`, `admin`).
- `listings.ts`: `listings`, `listing_photos`, `listing_units`, `unit_inventory` (one row per unit per date with `total`, `booked`, optional `price` override, `closed`).
- `bookings.ts`: `bookings` (shared header: reference, user, kind, status, totals, contact), `stay_bookings`, `flight_bookings`, `payments`, `refunds`, `payouts`.
- `reviews.ts`: `reviews` (one per completed stay booking).
- `places.ts`: `airports` (seeded from OurAirports, public domain), `destinations` (curated SEO pages).
- `wishlists.ts`: saved listings.

## Booking state machine

```
draft ──► pending_payment ──► confirmed ──► completed
              │                   │
              ├──► expired         ├──► cancelled ──► refunded
              └──► failed          
```

- `draft`: quote created on the server with a locked price (stays) or a held offer id (flights). Expires after 20 minutes.
- `pending_payment`: a payment order exists with the provider. Inventory is held (stays: `booked` incremented inside a transaction with a row lock on `unit_inventory`).
- `confirmed`: the provider webhook (or verified client callback) confirmed capture. For flights, the airline order is created at this point; if order creation fails we refund automatically and mark `failed`.
- `expired` / `failed`: inventory hold is released.
- `cancelled`: by traveler within policy or by operator; refund amount computed from the listing's cancellation policy.

All transitions go through `src/server/bookings/transitions.ts` so there is one place that enforces legal moves.

## Rendering and caching

- Public marketing, destination and route pages: static shell plus `"use cache"` data with `cacheLife("hours")` and tags (`listing:<id>`, `destination:<slug>`).
- Search results: dynamic, streamed inside `<Suspense>`; the search form renders in the static shell.
- Listing pages: listing content cached with tag `listing:<id>`; price and availability for chosen dates streamed.
- Account, host, admin, checkout: dynamic, `instant = false` allowed.

## AI surface

- `/llms.txt` and `/llms-full.txt`: what the site offers, how to search, links to key pages.
- `/api/mcp`: MCP server (Streamable HTTP) with tools `search_flights`, `search_stays`, `get_listing`, `get_flight_offer`, `create_booking_link`.
- `/openapi.json`: REST description of `/api/v1/*` for GPT Actions and other agents.
- `/api/v1/search/stays`, `/api/v1/search/flights`, `/api/v1/listings/:slug`: public JSON endpoints, rate limited.
- Natural language search: `src/server/ai/parse-query.ts` turns a sentence into structured filters. Uses Anthropic when `ANTHROPIC_API_KEY` is set, otherwise a rule-based parser.

## Environments

- Local: Postgres on localhost, Duffel test token, Razorpay and Stripe test keys.
- Preview (Vercel preview deploys): separate database branch or schema.
- Production: Supabase Postgres (pooled connection string on port 6543 for serverless), live keys.
