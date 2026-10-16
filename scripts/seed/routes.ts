/**
 * Popular flight routes that get an SEO page at /flights/<slug>.
 *
 * Slugs are built from the city names in the airports table ("delhi-to-goa"), so run the airports
 * seed first. Only real IATA codes are used; a route whose airport is missing is skipped with a warning.
 *
 * Run directly:   pnpm tsx --env-file=.env.local scripts/seed/routes.ts
 * Or import:      await seedRoutes(db)
 */
import { inArray, sql } from "drizzle-orm";
import { airports, routes } from "../../src/db/schema/places";
import { slugify } from "../../src/lib/slug";
import type { SeedDb } from "./airports";

export type RouteGroup = "Within India" | "India and the Gulf" | "India and Southeast Asia" | "India and the UK" | "Around the world";

export const POPULAR_ROUTES: { origin: string; destination: string; group: RouteGroup }[] = [
  // Busiest Indian domestic routes
  { origin: "DEL", destination: "BOM", group: "Within India" },
  { origin: "BOM", destination: "DEL", group: "Within India" },
  { origin: "DEL", destination: "BLR", group: "Within India" },
  { origin: "BLR", destination: "DEL", group: "Within India" },
  { origin: "BOM", destination: "BLR", group: "Within India" },
  { origin: "BLR", destination: "BOM", group: "Within India" },
  { origin: "DEL", destination: "GOI", group: "Within India" },
  { origin: "BOM", destination: "GOI", group: "Within India" },
  { origin: "DEL", destination: "HYD", group: "Within India" },
  { origin: "DEL", destination: "MAA", group: "Within India" },
  { origin: "DEL", destination: "CCU", group: "Within India" },
  { origin: "BOM", destination: "HYD", group: "Within India" },
  { origin: "BOM", destination: "MAA", group: "Within India" },
  { origin: "BOM", destination: "CCU", group: "Within India" },
  { origin: "BLR", destination: "CCU", group: "Within India" },
  { origin: "BLR", destination: "HYD", group: "Within India" },
  { origin: "DEL", destination: "COK", group: "Within India" },
  { origin: "DEL", destination: "PNQ", group: "Within India" },
  { origin: "DEL", destination: "AMD", group: "Within India" },
  { origin: "DEL", destination: "SXR", group: "Within India" },
  // India and the Gulf
  { origin: "DEL", destination: "DXB", group: "India and the Gulf" },
  { origin: "BOM", destination: "DXB", group: "India and the Gulf" },
  { origin: "COK", destination: "DXB", group: "India and the Gulf" },
  { origin: "BLR", destination: "DXB", group: "India and the Gulf" },
  { origin: "BOM", destination: "AUH", group: "India and the Gulf" },
  { origin: "DEL", destination: "DOH", group: "India and the Gulf" },
  { origin: "HYD", destination: "JED", group: "India and the Gulf" },
  // India and Southeast Asia
  { origin: "DEL", destination: "SIN", group: "India and Southeast Asia" },
  { origin: "BOM", destination: "SIN", group: "India and Southeast Asia" },
  { origin: "MAA", destination: "SIN", group: "India and Southeast Asia" },
  { origin: "DEL", destination: "BKK", group: "India and Southeast Asia" },
  { origin: "BOM", destination: "BKK", group: "India and Southeast Asia" },
  { origin: "MAA", destination: "KUL", group: "India and Southeast Asia" },
  // India and the UK
  { origin: "DEL", destination: "LHR", group: "India and the UK" },
  { origin: "BOM", destination: "LHR", group: "India and the UK" },
  { origin: "LHR", destination: "DEL", group: "India and the UK" },
  // Global trunk routes
  { origin: "LHR", destination: "JFK", group: "Around the world" },
  { origin: "JFK", destination: "LAX", group: "Around the world" },
  { origin: "SIN", destination: "SYD", group: "Around the world" },
  { origin: "DXB", destination: "LHR", group: "Around the world" },
];

export function routeSlug(originCity: string, destinationCity: string) {
  return `${slugify(originCity)}-to-${slugify(destinationCity)}`;
}

export async function seedRoutes(db: SeedDb) {
  const codes = [...new Set(POPULAR_ROUTES.flatMap((r) => [r.origin, r.destination]))];
  const found = await db.select({ iata: airports.iata, city: airports.city }).from(airports).where(inArray(airports.iata, codes));
  const city = new Map(found.map((a) => [a.iata, a.city]));

  const rows: (typeof routes.$inferInsert)[] = [];
  const slugs = new Set<string>();
  for (const r of POPULAR_ROUTES) {
    const from = city.get(r.origin);
    const to = city.get(r.destination);
    if (!from || !to) {
      console.warn(`Routes: skipped ${r.origin}-${r.destination}, airport not seeded.`);
      continue;
    }
    const slug = routeSlug(from, to);
    if (slugs.has(slug)) throw new Error(`Routes: duplicate slug ${slug}`);
    slugs.add(slug);
    rows.push({ slug, origin: r.origin, destination: r.destination, facts: { group: r.group } });
  }
  if (rows.length) {
    await db
      .insert(routes)
      .values(rows)
      .onConflictDoUpdate({
        target: routes.slug,
        set: { origin: sql`excluded.origin`, destination: sql`excluded.destination`, facts: sql`excluded.facts`, updatedAt: sql`now()` },
      });
  }
  console.log(`Routes: upserted ${rows.length}.`);
  return rows.length;
}

const isMain = /scripts[\\/]seed[\\/]routes\.ts$/.test(process.argv[1] ?? "");
if (isMain) {
  (async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const client = postgres(url, { prepare: false, max: 1 });
    try {
      await seedRoutes(drizzle(client, { casing: "snake_case" }));
    } finally {
      await client.end();
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
