# Search and AI discoverability

Goal: rank for flight route and stay destination queries, and be the source assistants cite and call when someone asks them to find a trip.

## Technical SEO (every public page)

- `generateMetadata` returns: unique `title` (under 60 chars), `description` (140 to 160 chars), `alternates.canonical`, `openGraph` (title, description, url, image, type), `twitter` card `summary_large_image`.
- One `<h1>` per page. Headings follow order.
- JSON-LD via `src/lib/jsonld.ts` helpers, rendered with `<JsonLd data={...} />`:
  - Root layout: `Organization`, `WebSite` with `SearchAction`.
  - Listing page: `LodgingBusiness` (or `Hotel`, `Hostel`, `VacationRental` by property type) with `address`, `geo`, `amenityFeature`, `aggregateRating`, `review`, `offers` (`Offer` with `price`, `priceCurrency`, `availability`).
  - Destination page: `TouristDestination` plus `ItemList` of listings, `BreadcrumbList`, `FAQPage` when FAQs exist.
  - Route page (`/flights/del-goi`): `Trip` or `Flight` style `ItemList` of sample fares with dates, `BreadcrumbList`, `FAQPage`.
- `app/sitemap.ts` uses `generateSitemaps` to split: static pages, destinations, routes, listings. `lastModified` from `updated_at`.
- `app/robots.ts` allows everything public, disallows `/account`, `/host`, `/admin`, `/checkout`, `/api/` (except `/api/v1/` and `/api/mcp`). Explicitly allows AI crawlers: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bingbot`.
- Open Graph images via `opengraph-image.tsx` per route type (listing, destination, route) using `ImageResponse`.
- URLs are lowercase, hyphenated, stable: `/stays/goa`, `/stays/goa/<listing-slug>`, `/flights/delhi-to-goa`, `/flights/del-goi` redirects to the named form.
- Pagination uses real links (`?page=2`) with canonical to self.
- Core Web Vitals: LCP under 2.0s on 4G, CLS under 0.05, INP under 150ms. Images use `next/image` with explicit sizes; hero image gets `priority`.
- IndexNow ping on listing publish and update (`src/server/seo/indexnow.ts`) for Bing, Yandex and partners.
- `hreflang` is ready for when locales are added (`en-IN` default, `en` x-default).

## Programmatic pages

- `/stays/[place]`: one per destination with at least 3 published listings. Real content: intro written per destination, neighborhoods, price ranges computed from our data, FAQ computed from data ("What is the average price of a stay in Goa?" answered from live numbers).
- `/flights/[from]-to-[to]`: one per popular route. Computed facts: airlines flying it, typical duration, cheapest month from recent searches, airports.
- Thin pages are worse than no pages. A page with no listings or no data is `noindex`.

## Generative engine optimization (LLMs)

Assistants pick sources that state facts clearly and can be quoted. Rules:

- Lead every page with a one-paragraph factual summary that answers the page's question directly (who, what, price range, how to book).
- Facts in plain HTML text, not only in images or client-rendered widgets.
- FAQ sections with real question phrasing.
- Prices always with currency and date context ("from ₹3,420 per night in October 2026").
- Server-rendered: content must be in the initial HTML.

## Being usable from assistants

- `/llms.txt`: short index per llmstxt.org with links to `/llms-full.txt`, `/openapi.json`, the MCP endpoint and key pages.
- `/llms-full.txt`: generated text describing how search works, filters, policies, the zero-fee rule, and the top destinations and routes.
- `/openapi.json`: OpenAPI 3.1 for `/api/v1/*` (search stays, search flights, get listing, get offer). Works as a ChatGPT GPT Action.
- `/api/mcp`: MCP over Streamable HTTP. Tools take structured filters, return compact JSON with absolute booking URLs. No auth needed for search.
- `/.well-known/mcp.json` (discovery hint) pointing to the MCP endpoint.
- Natural language search on the site and in the API (`q` parameter) so an assistant can pass the user's sentence directly.
