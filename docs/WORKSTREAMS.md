# Workstreams

The build is split into parallel workstreams. Each owns a set of paths. Do not edit paths owned by another workstream; if you need something from one, code against its contract (the stub signatures in `src/server/**`) and note the need in your report.

Shared paths (`src/db/schema/*`, `src/components/ui/*`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(site)/layout.tsx`, `src/config/*`, `src/lib/*`, `package.json`) may only receive small, additive changes. List every shared-path change in your report. Never generate migrations; the lead integrates schema changes and generates migrations once.

| Workstream | Owns | Contracts it implements |
| --- | --- | --- |
| flights | `src/server/flights/**`, `src/components/flights/**`, `src/app/(site)/flights/**`, `src/app/api/v1/airports/**`, `src/data/airports*`, `scripts/seed/airports.ts`, `scripts/seed/routes.ts` | `getFlightProvider`, `searchFlights`, `getOffer`, `searchAirports` |
| stays | `src/server/stays/**`, `src/components/stays/**`, `src/app/(site)/stays/**`, `src/app/(site)/saved/**`, `src/app/api/v1/places/**`, `scripts/seed/destinations.ts`, `scripts/seed/demo-listings.ts` | `quoteStay`, `holdInventory`, `releaseInventory`, `searchStays`, `suggestPlaces` |
| bookings | `src/server/bookings/**`, `src/server/payments/**`, `src/server/email/**`, `src/components/checkout/**`, `src/app/(site)/checkout/**`, `src/app/(site)/bookings/**`, `src/app/(account)/trips/**`, `src/app/api/webhooks/**`, `src/app/api/cron/**`, `src/app/api/payments/**`, `vercel.json` | `createStayBooking`, `createFlightBooking`, `cancelBooking`, `previewCancellation` |
| host | `src/server/host/**`, `src/server/admin/**`, `src/components/host/**`, `src/components/admin/**`, `src/app/host/**`, `src/app/admin/**`, `src/app/api/uploads/**` | none |
| platform | `src/server/ai/**`, `src/server/seo/**`, `src/server/rate-limit.ts`, `src/app/api/mcp/**`, `src/app/api/v1/search/**`, `src/app/api/v1/listings/**`, `src/app/(auth)/**`, `src/app/(account)/account/**`, `src/app/(account)/layout.tsx`, `src/app/(site)/search/**`, `src/app/(site)/(static)/**` (help, terms, privacy, cancellation, how-it-works, developers, hosting), `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`, `src/app/llms.txt/**`, `src/app/llms-full.txt/**`, `src/app/openapi.json/**`, `src/app/.well-known/**`, `src/app/opengraph-image.tsx`, `src/app/icon*`, `src/app/apple-icon*`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/proxy.ts` | none |
| search | `src/components/search/**`, `src/components/ui/popover.tsx`, `src/components/ui/date-range-picker.tsx`, `src/components/ui/combobox.tsx`, `src/app/(site)/page.tsx`, `src/app/(site)/destinations/**`, `src/app/(site)/routes/**` | `FlightSearchForm`, `StaySearchForm` |

## Local setup inside a worktree

```bash
pnpm install --frozen-lockfile
cp ../.env.local .env.local 2>/dev/null || true   # or write it fresh, see below
```

`.env.local` for workstream `<ws>`:

```
DATABASE_URL=postgres://app:app@localhost:5432/booking_<ws>
BETTER_AUTH_SECRET=<any 32+ char string>
BETTER_AUTH_URL=http://localhost:<port>
NEXT_PUBLIC_SITE_URL=http://localhost:<port>
```

Ports: flights 3101, stays 3102, bookings 3103, host 3104, platform 3105, search 3106.

Each workstream database already has the initial migration applied. Apply your own additive schema changes with `pnpm db:push`.

## Definition of done for a workstream

- `pnpm lint:copy`, `pnpm typecheck`, `pnpm lint` and `pnpm build` pass in the worktree.
- New logic has vitest tests where it computes something (prices, refunds, parsing, state transitions).
- Pages verified in a running dev server (curl the HTML at minimum; check headings, JSON-LD, no console errors).
- Work committed on the worktree branch with clear messages. Do not push.
