import "server-only";
import { sql } from "drizzle-orm";

/**
 * Postgres token bucket on the `rate_limits` table.
 *
 * Tokens are stored in thousandths so slow refill rates (one token every few
 * seconds) do not lose fractions between requests. Each check runs in a short
 * transaction with a row lock, so concurrent requests from one client cannot
 * spend the same token twice.
 */

export type BucketPolicy = { capacity: number; refillPerSecond: number };

/** Pure token bucket arithmetic: refill for the time elapsed, then spend `cost` if there is enough. */
export function refillBucket(
  state: { tokensMilli: number; elapsedMs: number; cost?: number },
  policy: BucketPolicy,
): { ok: boolean; tokensMilli: number; retryAfter: number } {
  const capacityMilli = policy.capacity * 1000;
  const cost = (state.cost ?? 1) * 1000;
  const refilled = Math.max(0, state.elapsedMs) * policy.refillPerSecond;
  const available = Math.min(capacityMilli, Math.max(0, state.tokensMilli) + Math.floor(refilled));
  if (available >= cost) return { ok: true, tokensMilli: available - cost, retryAfter: 0 };
  const retryAfter = Math.max(1, Math.ceil((cost - available) / 1000 / policy.refillPerSecond));
  return { ok: false, tokensMilli: available, retryAfter };
}

export const policies = {
  /** Public JSON search API. */
  api: { capacity: 30, refillPerSecond: 0.5 },
  /** MCP tool calls from assistants. */
  mcp: { capacity: 60, refillPerSecond: 1 },
  /** Natural language parsing on the site. */
  search: { capacity: 20, refillPerSecond: 0.5 },
  /** Account changes such as password and deletion. */
  account: { capacity: 10, refillPerSecond: 0.05 },
} satisfies Record<string, BucketPolicy>;

export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number; limit: number };

export async function consume(key: string, policy: BucketPolicy, cost = 1): Promise<RateLimitResult> {
  const capacityMilli = policy.capacity * 1000;
  try {
    // Imported lazily so the bucket arithmetic above can be unit tested without a database.
    const { db } = await import("@/db");
    return await db.transaction(async (tx) => {
      await tx.execute(sql`insert into rate_limits (key, tokens, updated_at) values (${key}, ${capacityMilli}, now()) on conflict (key) do nothing`);
      const rows = await tx.execute<{ tokens: number; elapsed_ms: string }>(
        sql`select tokens, (extract(epoch from (clock_timestamp() - updated_at)) * 1000)::bigint as elapsed_ms from rate_limits where key = ${key} for update`,
      );
      const row = rows[0];
      const result = refillBucket({ tokensMilli: Number(row?.tokens ?? capacityMilli), elapsedMs: Number(row?.elapsed_ms ?? 0), cost }, policy);
      await tx.execute(sql`update rate_limits set tokens = ${result.tokensMilli}, updated_at = clock_timestamp() where key = ${key}`);
      if (Math.random() < 0.01) {
        // Occasional cleanup of buckets idle for a day; a full bucket and a missing row behave the same.
        await tx.execute(sql`delete from rate_limits where updated_at < now() - interval '1 day'`);
      }
      return { ok: result.ok, remaining: Math.floor(result.tokensMilli / 1000), retryAfter: result.retryAfter, limit: policy.capacity };
    });
  } catch (err) {
    // A rate limiter that is down must not take the site with it.
    console.error("[rate-limit] check failed, allowing request:", err instanceof Error ? err.message : err);
    return { ok: true, remaining: policy.capacity, retryAfter: 0, limit: policy.capacity };
  }
}

/** Client IP from the proxy headers Vercel and most hosts set. */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = { "RateLimit-Limit": String(r.limit), "RateLimit-Remaining": String(r.remaining) };
  if (!r.ok) h["Retry-After"] = String(r.retryAfter);
  return h;
}

/**
 * Checks the bucket for `route` and the caller's IP. Returns a 429 response
 * to send back, or null when the request may continue.
 */
export async function limitRequest(
  req: Request,
  route: string,
  policy: BucketPolicy,
  extraHeaders: Record<string, string> = {},
): Promise<{ blocked: Response | null; headers: Record<string, string> }> {
  const r = await consume(`${route}:${clientIp(req.headers)}`, policy);
  const headers = rateLimitHeaders(r);
  if (r.ok) return { blocked: null, headers };
  return {
    blocked: Response.json(
      { error: { code: "rate_limited", message: `Too many requests. Try again in ${r.retryAfter} seconds.` } },
      { status: 429, headers: { ...extraHeaders, ...headers } },
    ),
    headers,
  };
}
