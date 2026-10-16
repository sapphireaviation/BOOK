# 0006: No query pipelining on the Supabase transaction pooler

Date: 2026-10-16. Status: accepted.

## Context

`DATABASE_URL` is Supabase's transaction pooler (Supavisor, port 6543), which serverless hosting needs. postgres.js pipelines queries: when more queries are waiting than there are connections, it sends several down one connection without waiting. Queries without parameters go out as Parse, Bind, Execute and Sync in one burst. With several of those in flight on one connection, the pooler stalls and the queries never return. On a Supabase Free project this shows up as prerender timeouts in `next build` and would show up as hung requests under load. Parameterised queries were not affected because postgres.js waits for their Describe step.

The session pooler (port 5432) does not stall, but it caps clients at the pool size (15 on Free), which a build or a few serverless instances exhaust.

## Decision

- Every postgres.js client passes `max_pipeline: 0`, so each connection has one query in flight.
- postgres.js only calls `onexecute` (which `sql.begin` uses to reserve its connection) when the pipeline has room, so with `max_pipeline: 0` transactions fail with `UNSAFE_TRANSACTION`. `patches/postgres@3.4.9.patch` calls `onexecute` regardless and adds `max_pipeline` to the types. pnpm applies it on install.
- Keep the transaction pooler (port 6543) for `DATABASE_URL`.

## Consequences

Throughput per connection is slightly lower (no pipelining); the pool of 5 per instance is still the limit. When upgrading postgres.js, re-create the patch or confirm upstream fixed the `onexecute` ordering. A cold `next build` from a laptop can occasionally hit a connect timeout when many workers open connections at once; rerunning works.
