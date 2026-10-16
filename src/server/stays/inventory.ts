import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, type DB } from "@/db";
import { listings, listingUnits, unitInventory } from "@/db/schema";
import { nightsBetween } from "@/lib/dates";
import { priceStay, validateStayDates } from "./pricing";
import type { StayQuote, StayQuoteInput } from "./types";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type HoldInput = { unitId: string; checkIn: string; checkOut: string; units: number };

/**
 * CONTRACT (owned by the stays workstream).
 * Prices a stay from the database. Pure read. Includes taxes, cleaning fee and the zero fee line.
 */
export async function quoteStay(input: StayQuoteInput, tx?: Tx): Promise<StayQuote> {
  const conn = tx ?? db;
  const dateError = validateStayDates(input.checkIn, input.checkOut);
  if (dateError) return { available: false, reason: dateError };

  const [row] = await conn
    .select({
      listing: {
        status: listings.status,
        kind: listings.kind,
        currency: listings.currency,
        cleaningFee: listings.cleaningFee,
        taxBps: listings.taxBps,
        minNights: listings.minNights,
        maxNights: listings.maxNights,
      },
      unit: {
        active: listingUnits.active,
        maxGuests: listingUnits.maxGuests,
        basePrice: listingUnits.basePrice,
        extraGuestPrice: listingUnits.extraGuestPrice,
        includedGuests: listingUnits.includedGuests,
        quantity: listingUnits.quantity,
      },
    })
    .from(listingUnits)
    .innerJoin(listings, eq(listings.id, listingUnits.listingId))
    .where(and(eq(listingUnits.id, input.unitId), eq(listingUnits.listingId, input.listingId)))
    .limit(1);

  if (!row) return { available: false, reason: "We could not find this room. It may have been removed." };

  const inventory = await conn
    .select({
      date: unitInventory.date,
      booked: unitInventory.booked,
      total: unitInventory.total,
      price: unitInventory.price,
      closed: unitInventory.closed,
    })
    .from(unitInventory)
    .where(and(eq(unitInventory.unitId, input.unitId), gte(unitInventory.date, input.checkIn), lt(unitInventory.date, input.checkOut)));

  return priceStay({ ...input, listing: row.listing, unit: row.unit, inventory });
}

function validHold(input: HoldInput) {
  return validateStayDates(input.checkIn, input.checkOut) === null && Number.isInteger(input.units) && input.units >= 1;
}

class HoldRejected extends Error {}

/**
 * CONTRACT. Inside a transaction: lock the unit_inventory rows for each night (creating missing rows),
 * verify capacity, and increment `booked` by `units`. Returns false if any night is full or closed.
 *
 * The work runs in a savepoint, so a rejected hold leaves no rows behind in the caller's transaction.
 */
export async function holdInventory(tx: Tx, input: HoldInput): Promise<boolean> {
  if (!validHold(input)) return false;
  const nights = nightsBetween(input.checkIn, input.checkOut);

  try {
    await tx.transaction(async (sp) => {
      await sp.execute(sql`
        insert into unit_inventory (unit_id, date)
        select lu.id, d::date
        from listing_units lu
        cross join generate_series(${input.checkIn}::date, ${input.checkOut}::date - 1, interval '1 day') as d
        where lu.id = ${input.unitId}
        on conflict do nothing
      `);

      const rows = await sp.execute<{ date: string; free: number; closed: boolean }>(sql`
        select ui.date::text as date,
               coalesce(ui.total, lu.quantity) - ui.booked as free,
               ui.closed
        from unit_inventory ui
        join listing_units lu on lu.id = ui.unit_id
        where ui.unit_id = ${input.unitId}
          and ui.date >= ${input.checkIn}::date
          and ui.date < ${input.checkOut}::date
        order by ui.date
        for update of ui
      `);

      if (rows.length !== nights) throw new HoldRejected();
      for (const r of rows) if (r.closed || Number(r.free) < input.units) throw new HoldRejected();

      await sp.execute(sql`
        update unit_inventory
        set booked = booked + ${input.units}
        where unit_id = ${input.unitId}
          and date >= ${input.checkIn}::date
          and date < ${input.checkOut}::date
      `);
    });
    return true;
  } catch (err) {
    if (err instanceof HoldRejected) return false;
    throw err;
  }
}

/** CONTRACT. Inside a transaction: decrement `booked` for each night, never below zero. */
export async function releaseInventory(tx: Tx, input: HoldInput): Promise<void> {
  if (!validHold(input)) return;
  await tx.execute(sql`
    update unit_inventory
    set booked = greatest(booked - ${input.units}, 0)
    where unit_id = ${input.unitId}
      and date >= ${input.checkIn}::date
      and date < ${input.checkOut}::date
  `);
}
