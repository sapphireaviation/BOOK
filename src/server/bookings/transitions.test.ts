import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES, canTransition, LEGAL_TRANSITIONS, transition, TransitionError, type BookingStatus, type Executor } from "./transitions";

const LEGAL: [BookingStatus, BookingStatus][] = [
  ["draft", "pending_payment"],
  ["draft", "expired"],
  ["draft", "failed"],
  ["pending_payment", "confirmed"],
  ["pending_payment", "expired"],
  ["pending_payment", "failed"],
  ["confirmed", "completed"],
  ["confirmed", "cancelled"],
  ["confirmed", "failed"],
  ["cancelled", "refunded"],
];

const isLegal = (from: BookingStatus, to: BookingStatus) => LEGAL.some(([f, t]) => f === from && t === to);

/** A stand-in for drizzle's update builder that records what it was given and returns `rows`. */
function fakeDb(rows: { id: string }[]) {
  const seen: { set?: Record<string, unknown>; where?: SQL } = {};
  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        seen.set = values;
        return {
          where: (where: SQL) => {
            seen.where = where;
            return { returning: async () => rows };
          },
        };
      },
    }),
  };
  return { db: db as unknown as Executor, seen };
}

describe("booking state machine", () => {
  it("allows exactly the documented moves", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(isLegal(from, to));
      }
    }
  });

  it("has terminal states with no way out", () => {
    for (const s of ["completed", "refunded", "expired", "failed"] as const) expect(LEGAL_TRANSITIONS[s]).toEqual([]);
  });

  it("never lets money states go backwards", () => {
    expect(canTransition("confirmed", "pending_payment")).toBe(false);
    expect(canTransition("refunded", "cancelled")).toBe(false);
    expect(canTransition("expired", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  describe("transition()", () => {
    for (const [from, to] of LEGAL) {
      it(`applies ${from} -> ${to} guarded by the current status`, async () => {
        const { db, seen } = fakeDb([{ id: "bkg_1" }]);
        await transition(db, "bkg_1", from, to);
        expect(seen.set?.status).toBe(to);
        const query = new PgDialect().sqlToQuery(seen.where!);
        expect(query.sql).toMatch(/"status" = \$\d/);
        expect(query.params).toEqual(expect.arrayContaining(["bkg_1", from]));
      });
    }

    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        if (isLegal(from, to)) continue;
        it(`rejects ${from} -> ${to} without touching the database`, async () => {
          const { db, seen } = fakeDb([{ id: "bkg_1" }]);
          const err = await transition(db, "bkg_1", from, to).catch((e) => e);
          expect(err).toBeInstanceOf(TransitionError);
          expect(err.code).toBe("illegal");
          expect(seen.set).toBeUndefined();
        });
      }
    }

    it("reports a conflict when the row is no longer in the expected status", async () => {
      const { db } = fakeDb([]);
      const err = await transition(db, "bkg_1", "pending_payment", "confirmed").catch((e) => e);
      expect(err).toBeInstanceOf(TransitionError);
      expect(err.code).toBe("conflict");
    });

    it("passes extra columns through with the status", async () => {
      const { db, seen } = fakeDb([{ id: "bkg_1" }]);
      const at = new Date("2026-10-15T10:00:00Z");
      await transition(db, "bkg_1", "confirmed", "cancelled", { cancelledAt: at, cancelReason: "Plans changed" });
      expect(seen.set).toMatchObject({ status: "cancelled", cancelledAt: at, cancelReason: "Plans changed" });
    });
  });
});
