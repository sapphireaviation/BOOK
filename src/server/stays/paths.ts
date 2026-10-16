import { slugify } from "@/lib/slug";

/** The place segment of a listing URL: its destination, or its city when it has none. */
export function placeSlugOf(l: { destination_slug?: string | null; destinationSlug?: string | null; city: string }) {
  return l.destinationSlug ?? l.destination_slug ?? slugify(l.city);
}

/** `/stays/<place>/<slug>` */
export function listingPath(l: { slug: string; destination_slug?: string | null; destinationSlug?: string | null; city: string }) {
  return `/stays/${placeSlugOf(l)}/${l.slug}`;
}
