import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clientIp, rateLimitHeaders, refillBucket } from "./rate-limit";

const policy = { capacity: 10, refillPerSecond: 0.5 };

describe("refillBucket", () => {
  it("spends one token from a full bucket", () => {
    expect(refillBucket({ tokensMilli: 10_000, elapsedMs: 0 }, policy)).toEqual({ ok: true, tokensMilli: 9_000, retryAfter: 0 });
  });

  it("refuses an empty bucket and says how long to wait", () => {
    expect(refillBucket({ tokensMilli: 0, elapsedMs: 0 }, policy)).toEqual({ ok: false, tokensMilli: 0, retryAfter: 2 });
  });

  it("keeps fractions of a token between requests", () => {
    const first = refillBucket({ tokensMilli: 0, elapsedMs: 1_000 }, policy);
    expect(first).toMatchObject({ ok: false, tokensMilli: 500, retryAfter: 1 });
    expect(refillBucket({ tokensMilli: first.tokensMilli, elapsedMs: 1_000 }, policy)).toMatchObject({ ok: true, tokensMilli: 0 });
  });

  it("never fills past capacity", () => {
    expect(refillBucket({ tokensMilli: 9_000, elapsedMs: 3_600_000 }, policy).tokensMilli).toBe(9_000);
  });

  it("ignores negative clock skew", () => {
    expect(refillBucket({ tokensMilli: 2_000, elapsedMs: -5_000 }, policy).tokensMilli).toBe(1_000);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("rateLimitHeaders", () => {
  it("adds Retry-After only when blocked", () => {
    expect(rateLimitHeaders({ ok: true, remaining: 4, retryAfter: 0, limit: 10 })).not.toHaveProperty("Retry-After");
    expect(rateLimitHeaders({ ok: false, remaining: 0, retryAfter: 3, limit: 10 })["Retry-After"]).toBe("3");
  });
});
