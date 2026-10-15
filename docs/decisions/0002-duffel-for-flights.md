# 0002: Duffel as the first flight provider

Status: accepted, 2026-10-15

## Context

We want direct airline content (NDC) without a travel agency accreditation on day one, with a test mode, instant ticketing, and no requirement to add a markup.

## Decision

Integrate Duffel behind a `FlightProvider` interface in `src/server/flights/`. Pay airlines from our Duffel balance and collect from the traveler through our own payment provider. Markup is zero.

## Consequences

- Duffel charges a per-order fee to the business. This is a cost of the business, not a fee to the traveler.
- Other providers (Amadeus Self-Service, Travelport, airline direct APIs) can be added as further adapters. Search can fan out and merge by lowest price.
- Without `DUFFEL_ACCESS_TOKEN` the flight vertical shows a clear "flights are not connected yet" state and the rest of the site works.
