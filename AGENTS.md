<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules

This repository is a zero-fee travel booking platform (codename **sapphire4**). Flights come directly from airlines through an NDC aggregator; stays and other inventory are listed directly by their owners. Travelers and hosts never pay a platform fee.

Read these before changing anything:

| Document | What it governs |
| --- | --- |
| `docs/PRODUCT.md` | What we are building, for whom, and what "done" means for launch |
| `docs/ARCHITECTURE.md` | Stack, module boundaries, data model, booking state machine |
| `docs/DESIGN.md` | Visual system, tokens, components, layout rules |
| `docs/WRITING.md` | Voice and copy rules (no AI slop) |
| `docs/SEO_AND_AI.md` | Search engine and LLM discoverability requirements |
| `docs/SECURITY.md` | Auth, payments, PII, secrets |
| `docs/LAUNCH.md` | Environment variables and the go-live runbook |
| `docs/decisions/` | Architecture decision records. Add one for any hard-to-reverse choice |

## Non-negotiables

1. **No branding is hard coded.** The product name, domain, support email and legal entity come from `src/config/site.ts`, which reads env vars. Never write a brand name in a component.
2. **No em dashes or en dashes in user-facing copy.** Not in UI strings, metadata, emails, or docs shown to users. Use a comma, period, colon or parentheses. Run `pnpm lint:copy` before committing.
3. **Money is integer minor units** (paise, cents) with an ISO 4217 currency next to it. Never use floats for money. Format only through `src/lib/money.ts`.
4. **Zero platform fee is a product rule.** Every price breakdown shows a fee line of 0. Never add a markup or service fee anywhere.
5. **Server is the source of truth for prices.** The client never sends an amount that is trusted. Re-price on the server before creating a payment.
6. **Cache Components is on.** Data reads that depend on the request (cookies, headers, searchParams, DB reads that must be fresh) go inside `<Suspense>`. Shared, slow-changing data uses `"use cache"` with `cacheLife` and `cacheTag`. Transactional routes (checkout, account, host, admin) may set `export const instant = false`. Read `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` if a build error mentions blocking prerender.
7. **`proxy.ts` replaces `middleware.ts`** in this Next.js version.
8. **Every public page ships metadata and JSON-LD** per `docs/SEO_AND_AI.md`.
9. **Accessibility floor:** visible focus, labelled inputs, keyboard reachable, `prefers-reduced-motion` respected, contrast AA.
10. **Validate all input with zod** at the boundary (server actions, route handlers, MCP tools).

## Commands

```bash
pnpm dev            # local dev server
pnpm build          # production build (must pass before pushing)
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm lint:copy      # fails on em/en dashes in user-facing source
pnpm db:generate    # drizzle-kit generate (only the lead integrates migrations)
pnpm db:migrate     # apply migrations to DATABASE_URL
pnpm db:seed        # seed airports, destinations and demo listings
```

Local database: Postgres at `postgres://app:app@localhost:5432/booking`.

## Code layout

```
src/
  app/                 routes (App Router)
    (site)/            public pages with the main header and footer
    (account)/         signed-in traveler area
    host/              host dashboard
    admin/             operator console
    api/               route handlers (webhooks, MCP, OpenAPI)
  components/ui/       design system primitives (no business logic)
  components/<area>/   feature components
  config/              site and feature config read from env
  db/                  drizzle client and schema (one file per domain)
  lib/                 pure helpers (money, dates, slugs, json-ld)
  server/              server-only domain services (bookings, payments, flights, stays, search, ai)
```

Domain logic lives in `src/server/**` and is called by routes, server actions, and MCP tools alike. Routes stay thin.

## Skills

Skills from GitHub are installed in `.agents/skills/`:

- `humanizer`: apply to every piece of user-facing copy and every doc.
- `next-dev-loop`: runtime verification against `next dev`.
