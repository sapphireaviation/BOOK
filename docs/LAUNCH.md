# Launch runbook

Everything needed to take the site from this repository to a live domain. Steps are in order.

## 1. Database (Supabase)

1. Create a Supabase project for this product only (Settings: region `ap-south-1` Mumbai for India traffic). The organization is on the free plan, which allows two active projects; pause or upgrade as needed.
2. Copy the **transaction pooler** connection string (port 6543). This is `DATABASE_URL`.
3. From your machine: `DATABASE_URL=<that url> pnpm db:migrate`, then `DATABASE_URL=<that url> pnpm db:seed` (airports, flight routes and destinations; never pass `--demo` in production).
4. In the Supabase dashboard confirm Row Level Security is enabled on every table (migration `0001` enables it with no policies, so the public REST API exposes nothing; the app connects as the database owner).

## 2. Accounts and keys

| Variable | Where to get it | Needed for |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Sessions (required) |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL` | Your domain, e.g. `https://example.com` | Links in emails, canonical URLs |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL` | Branding decision | Everything people see |
| `DUFFEL_ACCESS_TOKEN` | duffel.com, Developers, Access tokens. Start with a test token (`duffel_test_...`), switch to live after Duffel activates your account and you top up the balance | Flights |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay dashboard, API keys | INR payments |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay, Webhooks, add `https://<domain>/api/webhooks/razorpay` with events `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed` | Payment confirmation |
| `STRIPE_SECRET_KEY` | Stripe dashboard, Developers, API keys | Non INR payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe, Webhooks, endpoint `https://<domain>/api/webhooks/stripe` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded` | Payment confirmation |
| `RESEND_API_KEY`, `EMAIL_FROM` | resend.com; verify the domain's DNS records | Confirmation emails, sign in links |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud console, OAuth client, redirect `https://<domain>/api/auth/callback/google` | Sign in with Google (optional) |
| `BLOB_READ_WRITE_TOKEN` | Vercel project, Storage, create a Blob store (added automatically) | Listing photo uploads |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Better natural language search (optional) |
| `INDEXNOW_KEY` | Any 32 character hex string | Faster Bing indexing |
| `CRON_SECRET` | `openssl rand -hex 32` | Protects cron routes |
| `ADMIN_EMAILS` | Your email | Operator console access |

Never set `ALLOW_TEST_PAYMENTS` in production: it confirms bookings without taking money. `FLIGHTS_PROVIDER=fixture` is ignored in production.

Legal pages (`/terms`, `/privacy`, `/cancellation`) are drafts. Have a lawyer review them before launch, in particular the refund when a host cancels, data retention periods, the Grievance Officer contact under India's IT Rules, and governing law.

## 3. Vercel

1. Import the GitHub repository as a new Vercel project (framework: Next.js, install `pnpm install`, build `pnpm build`).
2. Add every variable above for Production (and Preview with test keys).
3. Deploy. Check `/api/auth/ok`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/openapi.json`.
   Crons in `vercel.json` run daily (the Hobby plan limit): expiring unpaid holds and completing past stays. Unpaid holds are also released lazily whenever someone books the same room, so daily is enough.
4. Domains: add the apex and `www`, set the redirect from `www` to apex, update DNS at the registrar as Vercel shows.

## 4. Smoke test on the live URL (test keys first)

- Sign up, sign in, sign out, magic link email arrives.
- Become a host, create a listing with 3 photos, a unit and prices, publish. It appears in `/stays/search` for its city.
- Book it as another user with the Razorpay test card; confirmation page and both emails arrive; host sees the booking and the payout owed.
- Cancel within policy; refund shows in the Razorpay dashboard.
- Search a flight with the Duffel test token (Duffel Airways, code ZZ, serves test routes such as LHR to JFK), book it, confirm the airline reference appears.
- If a flight payment succeeds but ticketing fails, the traveler is refunded automatically and emailed. A booking left with `ticketing: in_progress` in `meta` after a crash needs a manual check in the Duffel dashboard before any action, so we never pay for two orders.
- Call the MCP endpoint from Claude (Settings, Connectors, add custom connector `https://<domain>/api/mcp`) and ask it to find a stay.

## 5. Switch to live

Swap to live keys, redeploy, run one real low value booking and refund it.

## 6. Search engines and assistants

- Google Search Console and Bing Webmaster Tools: verify the domain, submit `https://<domain>/sitemap.xml`.
- Bing Webmaster also covers ChatGPT search and Copilot indexing.
- Submit the MCP endpoint and OpenAPI document where assistants list connectors when those directories open to submissions.
