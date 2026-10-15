import "server-only";
import type { DB } from "@/db";
import type { StayQuote, StayQuoteInput } from "./types";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * CONTRACT (owned by the stays workstream).
 * Prices a stay from the database. Pure read. Includes taxes, cleaning fee and the zero fee line.
 */
export async function quoteStay(input: StayQuoteInput, tx?: Tx): Promise<StayQuote> {
  void input;
  void tx;
  throw new Error("quoteStay not implemented");
}

/**
 * CONTRACT. Inside a transaction: lock the unit_inventory rows for each night (creating missing rows),
 * verify capacity, and increment `booked` by `units`. Returns false if any night is full or closed.
 */
export async function holdInventory(tx: Tx, input: { unitId: string; checkIn: string; checkOut: string; units: number }): Promise<boolean> {
  void tx;
  void input;
  throw new Error("holdInventory not implemented");
}

/** CONTRACT. Inside a transaction: decrement `booked` for each night, never below zero. */
export async function releaseInventory(tx: Tx, input: { unitId: string; checkIn: string; checkOut: string; units: number }): Promise<void> {
  void tx;
  void input;
  throw new Error("releaseInventory not implemented");
}
