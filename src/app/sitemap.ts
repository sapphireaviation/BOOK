import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { countPublishedListings, getIndexableDestinations, getListingPaths, getRoutes, LISTINGS_PER_SITEMAP } from "@/server/seo/data";
import { staticPages } from "@/server/seo/pages";

/**
 * Split sitemaps: 0 static pages, 1 destinations, 2 flight routes, 3 and up
 * published listings in chunks. Served at /sitemap/<id>.xml and listed in robots.txt.
 */
const STATIC = 0;
const DESTINATIONS = 1;
const ROUTES = 2;
const LISTINGS = 3;

export async function generateSitemaps() {
  const listingChunks = Math.max(1, Math.ceil((await countPublishedListings()) / LISTINGS_PER_SITEMAP));
  return [{ id: STATIC }, { id: DESTINATIONS }, { id: ROUTES }, ...Array.from({ length: listingChunks }, (_, i) => ({ id: LISTINGS + i }))];
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);

  if (id === STATIC) {
    return staticPages.map((p) => ({ url: absoluteUrl(p.path), changeFrequency: p.changeFrequency, priority: p.priority }));
  }
  if (id === DESTINATIONS) {
    return (await getIndexableDestinations()).map((d) => ({
      url: absoluteUrl(`/stays/${d.slug}`),
      lastModified: d.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));
  }
  if (id === ROUTES) {
    return (await getRoutes()).map((r) => ({ url: absoluteUrl(`/flights/${r.slug}`), lastModified: r.updatedAt, changeFrequency: "daily", priority: 0.8 }));
  }
  if (id >= LISTINGS) {
    return (await getListingPaths(id - LISTINGS)).map((l) => ({ url: absoluteUrl(l.path), lastModified: l.updatedAt, changeFrequency: "weekly", priority: 0.7 }));
  }
  return [];
}
