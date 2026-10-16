import { describe, expect, it } from "vitest";
import {
  addMonths,
  clampDate,
  daysInMonth,
  isBetween,
  formatShortDay,
  localToday,
  monthGrid,
  monthsBetween,
  moveFocus,
  selectDay,
  suggestedTrip,
  weekday,
  weekdayLabels,
} from "./calendar";

describe("month math", () => {
  it("counts days in months, including leap February", () => {
    expect(daysInMonth("2026-10-15")).toBe(31);
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2028-02-10")).toBe(29);
  });

  it("adds months and clamps the day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-24", 3)).toBe("2027-01-24");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-10-24", -12)).toBe("2025-10-24");
  });

  it("counts months between two dates", () => {
    expect(monthsBetween("2026-10-01", "2027-09-30")).toBe(11);
    expect(monthsBetween("2026-10-01", "2026-10-31")).toBe(0);
  });

  it("builds a Monday first grid with padding", () => {
    // 1 October 2026 is a Thursday.
    const grid = monthGrid("2026-10-15", 1);
    expect(grid[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(grid.at(-1)?.at(-1)).toBeNull();
  });

  it("builds a Sunday first grid", () => {
    const grid = monthGrid("2026-11-01", 0);
    // 1 November 2026 is a Sunday.
    expect(grid[0][0]).toBe("2026-11-01");
  });

  it("labels weekdays from the chosen start", () => {
    expect(weekdayLabels("en-GB", 1).map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(weekdayLabels("en-GB", 0)[0].long).toBe("Sunday");
  });
});

describe("keyboard movement", () => {
  it("moves by day and week", () => {
    expect(moveFocus("2026-10-31", "ArrowRight")).toBe("2026-11-01");
    expect(moveFocus("2026-11-01", "ArrowLeft")).toBe("2026-10-31");
    expect(moveFocus("2026-10-28", "ArrowDown")).toBe("2026-11-04");
    expect(moveFocus("2026-10-03", "ArrowUp")).toBe("2026-09-26");
  });

  it("jumps to the ends of the week", () => {
    // Friday 16 October 2026.
    expect(weekday("2026-10-16")).toBe(5);
    expect(moveFocus("2026-10-16", "Home")).toBe("2026-10-12");
    expect(moveFocus("2026-10-16", "End")).toBe("2026-10-18");
    expect(moveFocus("2026-10-16", "Home", { weekStartsOn: 0 })).toBe("2026-10-11");
  });

  it("pages by month, or by year with shift", () => {
    expect(moveFocus("2026-01-31", "PageDown")).toBe("2026-02-28");
    expect(moveFocus("2026-10-16", "PageUp")).toBe("2026-09-16");
    expect(moveFocus("2026-10-16", "PageDown", { shift: true })).toBe("2027-10-16");
  });

  it("clamps to the allowed window", () => {
    expect(clampDate("2026-10-01", "2026-10-16")).toBe("2026-10-16");
    expect(clampDate("2028-01-01", "2026-10-16", "2027-10-15")).toBe("2027-10-15");
    expect(clampDate("2026-12-01", "2026-10-16", "2027-10-15")).toBe("2026-12-01");
  });
});

describe("range selection", () => {
  const range = { mode: "range" as const };

  it("single mode finishes on one pick", () => {
    expect(selectDay({}, "2026-10-24", { mode: "single", editing: "start" })).toEqual({
      value: { start: "2026-10-24" },
      editing: "start",
      done: true,
    });
  });

  it("picks start then end", () => {
    const first = selectDay({}, "2026-10-24", { ...range, editing: "start", minGap: 1 });
    expect(first).toEqual({ value: { start: "2026-10-24" }, editing: "end", done: false });
    const second = selectDay(first.value, "2026-10-27", { ...range, editing: first.editing, minGap: 1 });
    expect(second).toEqual({ value: { start: "2026-10-24", end: "2026-10-27" }, editing: "start", done: true });
  });

  it("restarts when the end is before the start", () => {
    const r = selectDay({ start: "2026-10-24" }, "2026-10-20", { ...range, editing: "end" });
    expect(r).toEqual({ value: { start: "2026-10-20" }, editing: "end", done: false });
  });

  it("stays need at least one night, flights can return the same day", () => {
    expect(selectDay({ start: "2026-10-24" }, "2026-10-24", { ...range, editing: "end", minGap: 1 }).done).toBe(false);
    expect(selectDay({ start: "2026-10-24" }, "2026-10-24", { ...range, editing: "end", minGap: 0 })).toEqual({
      value: { start: "2026-10-24", end: "2026-10-24" },
      editing: "start",
      done: true,
    });
  });

  it("changing the start keeps an end that is still valid", () => {
    const r = selectDay({ start: "2026-10-24", end: "2026-10-30" }, "2026-10-26", { ...range, editing: "start", minGap: 1 });
    expect(r).toEqual({ value: { start: "2026-10-26", end: "2026-10-30" }, editing: "start", done: true });
  });

  it("changing the start past the end drops the end", () => {
    const r = selectDay({ start: "2026-10-24", end: "2026-10-27" }, "2026-10-27", { ...range, editing: "start", minGap: 1 });
    expect(r).toEqual({ value: { start: "2026-10-27" }, editing: "end", done: false });
  });

  it("editing the end with no start sets the start", () => {
    const r = selectDay({}, "2026-10-24", { ...range, editing: "end" });
    expect(r.value).toEqual({ start: "2026-10-24" });
    expect(r.editing).toBe("end");
  });

  it("knows which days fall between", () => {
    expect(isBetween("2026-10-25", "2026-10-24", "2026-10-27")).toBe(true);
    expect(isBetween("2026-10-24", "2026-10-24", "2026-10-27")).toBe(false);
    expect(isBetween("2026-10-25", "2026-10-24")).toBe(false);
  });
});

describe("defaults", () => {
  it("suggests the first Friday at least three days away, back on Monday", () => {
    // Thursday 15 October 2026: Sunday is three days away, so the next Friday is the 23rd.
    expect(suggestedTrip("2026-10-15")).toEqual({ start: "2026-10-23", end: "2026-10-26" });
    // Tuesday 13 October 2026: Friday the 16th is exactly three days away.
    expect(suggestedTrip("2026-10-13")).toEqual({ start: "2026-10-16", end: "2026-10-19" });
  });

  it("formats days in house style without a comma", () => {
    expect(formatShortDay("2026-10-24")).toBe("Sat 24 Oct");
    expect(formatShortDay("2026-10-23", "en-GB")).toBe("Fri 23 Oct");
  });

  it("reads today from the local calendar", () => {
    expect(localToday(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05");
  });
});
