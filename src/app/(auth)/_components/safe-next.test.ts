import { describe, expect, it } from "vitest";
import { safeNext, withNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/stays/goa?checkin=2026-10-24#map")).toBe("/stays/goa?checkin=2026-10-24#map");
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/%0d%0aLocation:x\r\n",
    "",
    undefined,
    null,
  ])("rejects %s", (value) => {
    expect(safeNext(value as string)).toBe("/trips");
  });

  it("does not loop back to auth pages", () => {
    expect(safeNext("/sign-in?next=/account")).toBe("/trips");
  });

  it("uses the given fallback", () => {
    expect(safeNext("https://x.example", "/")).toBe("/");
  });
});

describe("withNext", () => {
  it("carries a safe destination", () => expect(withNext("/sign-up", "/account")).toBe("/sign-up?next=%2Faccount"));
  it("drops an unsafe destination", () => expect(withNext("/sign-up", "https://evil.example")).toBe("/sign-up"));
});
