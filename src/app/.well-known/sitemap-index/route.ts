import { absoluteUrl } from "@/config/site";
import { generateSitemaps } from "../../sitemap";

/**
 * Sitemap index. proxy.ts rewrites /sitemap.xml here (Next.js reserves that path
 * for app/sitemap.ts, which serves the split sitemaps at /sitemap/<id>.xml).
 */
export async function GET() {
  const ids = await generateSitemaps();
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...ids.map((s) => `  <sitemap><loc>${absoluteUrl(`/sitemap/${s.id}.xml`)}</loc></sitemap>`),
    "</sitemapindex>",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
