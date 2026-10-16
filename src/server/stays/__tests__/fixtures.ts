import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { destinations, listings, listingUnits, user } from "@/db/schema";
import { newId } from "@/lib/id";

type ListingInsert = typeof listings.$inferInsert;
type UnitInsert = typeof listingUnits.$inferInsert;

/**
 * Creates throwaway rows in the test database and removes them afterwards.
 * Every row gets a random id, so tests can run against a database that also holds seed data.
 */
export function fixtures() {
  const userIds: string[] = [];
  const listingIds: string[] = [];
  const destinationSlugs: string[] = [];

  async function host() {
    const id = newId("usr");
    userIds.push(id);
    await db.insert(user).values({ id, name: "Test host", email: `${id}@test.invalid`, role: "host" });
    return id;
  }

  async function listing(overrides: Partial<ListingInsert> = {}, units: Partial<UnitInsert>[] = [{}]) {
    const hostId = overrides.hostId ?? (await host());
    const id = newId("lst");
    listingIds.push(id);
    await db.insert(listings).values({
      id,
      hostId,
      slug: id.replace("_", "-"),
      title: "Test listing",
      city: "Testville",
      countryCode: "IN",
      lat: 10,
      lng: 10,
      status: "published",
      currency: "INR",
      ...overrides,
    });
    const unitRows = units.map((u, i) => ({
      id: newId("unt"),
      listingId: id,
      name: `Room ${i + 1}`,
      basePrice: 300_000,
      ...u,
    }));
    await db.insert(listingUnits).values(unitRows);
    return { id, hostId, unitIds: unitRows.map((u) => u.id) };
  }

  async function destination(overrides: Partial<typeof destinations.$inferInsert> & { slug: string }) {
    destinationSlugs.push(overrides.slug);
    await db.insert(destinations).values({ name: overrides.slug, countryCode: "IN", countryName: "India", lat: 0, lng: 0, ...overrides });
  }

  async function cleanup() {
    if (listingIds.length) await db.delete(listings).where(inArray(listings.id, listingIds));
    if (userIds.length) await db.delete(user).where(inArray(user.id, userIds));
    if (destinationSlugs.length) await db.delete(destinations).where(inArray(destinations.slug, destinationSlugs));
  }

  return { host, listing, destination, cleanup };
}
