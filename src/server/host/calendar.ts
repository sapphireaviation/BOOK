import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { listingUnits, unitInventory } from "@/db/schema";
import { ValidationError } from "./errors";
import { revalidateListing } from "./listings";
import { loadManagedUnit } from "./units";
import { buildMonthCells, calendarUpsertPlan, eachDateInclusive, MAX_CALENDAR_RANGE_DAYS, monthDates, parseMoneyInput, type Actor, type CalendarAction } from "./rules";
import type { z } from "zod";
import type { calendarSchema } from "./schemas";

/** One month of one unit: price, rooms left, bookings and closures per day. */
export async function getUnitMonth(actor: Actor, listingId: string, unitId: string, month: string) {
  const { listing, unit } = await loadManagedUnit(actor, listingId, unitId);
  const dates = monthDates(month);
  const rows = await db
    .select({ date: unitInventory.date, booked: unitInventory.booked, total: unitInventory.total, price: unitInventory.price, closed: unitInventory.closed })
    .from(unitInventory)
    .where(and(eq(unitInventory.unitId, unitId), gte(unitInventory.date, dates[0]), lte(unitInventory.date, dates[dates.length - 1])))
    .orderBy(asc(unitInventory.date));
  return { listing, unit, cells: buildMonthCells(dates, unit, rows) };
}

export async function listUnitsForCalendar(listingId: string) {
  return db
    .select({ id: listingUnits.id, name: listingUnits.name, active: listingUnits.active })
    .from(listingUnits)
    .where(eq(listingUnits.listingId, listingId))
    .orderBy(asc(listingUnits.position), asc(listingUnits.createdAt));
}

/**
 * Applies a price, closure or room count to every date in a range.
 * Inserts missing rows with booked = 0 and, for rows that exist, updates only the column
 * the action changes. `booked` belongs to the booking flow and is never written here.
 */
export async function updateCalendarRange(actor: Actor, listingId: string, unitId: string, input: z.infer<typeof calendarSchema>) {
  const { listing, unit } = await loadManagedUnit(actor, listingId, unitId);
  const dates = eachDateInclusive(input.from, input.to);
  if (dates.length > MAX_CALENDAR_RANGE_DAYS) throw new ValidationError("Choose a range of one year or less.");

  let action: CalendarAction;
  switch (input.kind) {
    case "price": {
      const p = parseMoneyInput(input.price, listing.currency);
      if (!p.ok) throw new ValidationError(p.error, { price: p.error });
      if (!p.value) throw new ValidationError("The nightly price must be more than 0.", { price: "The nightly price must be more than 0." });
      action = { kind: "price", price: p.value };
      break;
    }
    case "total": {
      const raw = input.total.trim();
      if (raw === "") action = { kind: "total", total: null };
      else {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 1000) throw new ValidationError("Enter a whole number of rooms from 0 to 1000.", { total: "Enter a whole number of rooms from 0 to 1000." });
        action = { kind: "total", total: n === unit.quantity ? null : n };
      }
      break;
    }
    default:
      action = { kind: input.kind };
  }

  const plan = calendarUpsertPlan(unitId, dates, action);
  await db.transaction(async (tx) => {
    // Chunked so a year of dates stays well under the parameter limit.
    for (let i = 0; i < plan.rows.length; i += 200) {
      await tx
        .insert(unitInventory)
        .values(plan.rows.slice(i, i + 200))
        .onConflictDoUpdate({ target: [unitInventory.unitId, unitInventory.date], set: plan.set });
    }
  });
  if (listing.status === "published") await revalidateListing(listingId);
  return { days: dates.length };
}
