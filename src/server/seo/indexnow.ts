import "server-only";
import { absoluteUrl, site } from "@/config/site";

/**
 * IndexNow tells Bing, Yandex, Seznam, Naver and other participating engines
 * that pages changed, so new and updated listings are crawled within minutes.
 * Call it after a listing is published, updated or unpublished.
 *
 * The key file is served at /<INDEXNOW_KEY>.txt (proxy.ts rewrites that path
 * to /.well-known/indexnow). Without INDEXNOW_KEY this does nothing.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS = 10_000;

export type IndexNowResult = { sent: number; skipped?: "no_key" | "no_urls"; status?: number; error?: string };

export function indexNowKey() {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
}

export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = indexNowKey();
  if (!key) return { sent: 0, skipped: "no_key" };

  const host = new URL(site.url).host;
  const list = [
    ...new Set(
      urls
        .map((u) => (u.startsWith("/") ? absoluteUrl(u) : u))
        .filter((u) => {
          try {
            return new URL(u).host === host;
          } catch {
            return false;
          }
        }),
    ),
  ].slice(0, MAX_URLS);
  if (!list.length) return { sent: 0, skipped: "no_urls" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation: absoluteUrl(`/${key}.txt`), urlList: list }),
      signal: AbortSignal.timeout(5000),
    });
    // 200 and 202 both mean accepted. Anything else is logged; indexing is best effort and never blocks a publish.
    if (res.status !== 200 && res.status !== 202) console.warn(`[indexnow] ${res.status} for ${list.length} urls`);
    return { sent: list.length, status: res.status };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn("[indexnow] ping failed:", error);
    return { sent: 0, error };
  }
}
