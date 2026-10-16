import { describe, expect, it } from "vitest";
import { explainPolicy } from "../policy";

describe("explainPolicy", () => {
  it("names the real deadline when a check in date is known", () => {
    expect(explainPolicy("flexible", "2026-11-14").steps[0]).toBe("Cancel before 14:00 on Fri 13 Nov for a full refund.");
    expect(explainPolicy("moderate", "2026-11-14", "12:00").steps[0]).toBe("Cancel before 12:00 on Mon 9 Nov for a full refund.");
    expect(explainPolicy("strict", "2026-11-14").steps[0]).toBe("Cancel before 14:00 on Sat 7 Nov and you get half of what you paid back.");
  });

  it("falls back to relative wording without dates", () => {
    expect(explainPolicy("moderate").steps).toEqual([
      "Cancel at least 5 days before check in for a full refund.",
      "Cancel later than that and you get half of what you paid back.",
    ]);
    expect(explainPolicy("non_refundable", "2026-11-14").steps).toHaveLength(1);
  });

  it("keeps the label and summary from the shared policy text", () => {
    expect(explainPolicy("strict")).toMatchObject({ label: "Strict" });
    expect(explainPolicy("unknown")).toMatchObject({ label: "Moderate" });
  });
});
