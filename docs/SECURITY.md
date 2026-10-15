# Security

## Secrets

- Only in environment variables. `.env.local` is git ignored. `.env.example` lists names with no values.
- `src/config/env.ts` validates env at startup with zod. Server secrets are never imported into client components (`import "server-only"`).

## Auth

- Better Auth sessions in HTTP-only, secure, SameSite=Lax cookies.
- Roles: `traveler` (default), `host`, `admin`. Check roles in the service layer, not only in the UI.
- `proxy.ts` does an optimistic cookie check for `/account`, `/host`, `/admin` and redirects to sign in; the real check happens in the page or action.

## Payments

- Amounts are computed on the server from the booking record. Never trust a client amount.
- Razorpay: verify `razorpay_signature` with HMAC SHA256 on the client callback, and verify webhook signatures with the webhook secret. Stripe: verify webhook signatures with `constructEvent`.
- Webhook handlers are idempotent: keyed by provider event id in `payment_events`.
- We never see or store card numbers. Checkout uses the provider's hosted fields or hosted page.

## Personal data

- Passenger names, dates of birth, passport numbers (if an airline requires them) are stored only on `flight_bookings.passengers` and only as long as needed. Access limited to the booking owner and admins.
- Hosts see guest name, email and phone only for confirmed bookings of their own listings.
- Account deletion removes PII and keeps anonymized booking records for accounting.

## Abuse

- Rate limits on search APIs, MCP, auth and checkout (`src/server/rate-limit.ts`, Postgres backed token bucket).
- Listing photos: type and size checked before upload; served through `next/image`.
- All user text rendered as text. No `dangerouslySetInnerHTML` except JSON-LD produced by our own helper (which escapes `<`).

## Headers

Set in `next.config.ts`: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`. Content Security Policy allows Razorpay and Stripe script and frame origins.
