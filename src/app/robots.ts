import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { generateSitemaps } from "./sitemap";
import { aiCrawlers, privatePaths } from "@/server/seo/pages";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const allow = ["/", "/api/v1/", "/api/mcp", "/llms.txt", "/llms-full.txt", "/openapi.json", "/.well-known/"];
  // The index first, then each split sitemap, so crawlers that ignore indexes still find every file.
  const sitemaps = [absoluteUrl("/sitemap.xml"), ...(await generateSitemaps()).map((s) => absoluteUrl(`/sitemap/${s.id}.xml`))];
  return {
    rules: [
      { userAgent: "*", allow, disallow: privatePaths },
      // A named group replaces the * group for that crawler, so the private paths are repeated here.
      { userAgent: aiCrawlers, allow, disallow: privatePaths },
    ],
    sitemap: sitemaps,
  };
}
