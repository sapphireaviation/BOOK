/**
 * Only same-origin paths are allowed as a post sign in destination. Anything
 * else (absolute URLs, protocol relative "//evil.com", backslash tricks,
 * control characters) falls back to the default.
 */
export function safeNext(next: string | null | undefined, fallback = "/trips") {
  if (!next || typeof next !== "string") return fallback;
  if (next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://same.origin");
    if (url.origin !== "http://same.origin") return fallback;
    // Never send someone back to an auth page after signing in.
    if (/^\/(sign-in|sign-up|forgot-password|reset-password)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Builds an auth page link that carries the destination along. */
export function withNext(path: string, next: string | null | undefined) {
  const safe = next ? safeNext(next, "") : "";
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
