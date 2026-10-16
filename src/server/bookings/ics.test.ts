import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine } from "./ics";

describe("ics", () => {
  it("escapes text values", () => {
    expect(escapeIcsText("Room 2, sea view; quiet\nNo smoking \\ pets")).toBe("Room 2\\, sea view\\; quiet\\nNo smoking \\\\ pets");
  });

  it("folds long lines at 75 octets", () => {
    const folded = foldIcsLine(`DESCRIPTION:${"a".repeat(200)}`);
    for (const line of folded.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`DESCRIPTION:${"a".repeat(200)}`);
  });

  it("writes floating times for stays and zoned times for flights", () => {
    const ics = buildIcs({
      prodId: "-//Test//EN",
      now: new Date("2026-10-15T10:00:00Z"),
      events: [
        { uid: "a@x", title: "Stay", start: { local: "2026-10-24T14:00" }, end: { local: "2026-10-27T11:00" } },
        { uid: "b@x", title: "Flight", start: { local: "2026-10-24T06:15", timeZone: "Asia/Kolkata" }, end: { local: "2026-10-24T08:50", timeZone: "Asia/Kolkata" } },
      ],
    });
    expect(ics).toContain("DTSTART:20261024T140000\r\n");
    expect(ics).toContain("DTEND:20261027T110000\r\n");
    expect(ics).toContain("DTSTART;TZID=Asia/Kolkata:20261024T061500\r\n");
    expect(ics).toContain("DTSTAMP:20261015T100000Z");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
