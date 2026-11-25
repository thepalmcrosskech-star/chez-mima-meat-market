import { describe, expect, it } from "vitest";
import { pointsEarned, pointsValue, usablePoints } from "@/lib/loyalty";

describe("fidélité boutique", () => {
  it("conserve 2 % : 500 DH donnent 50 points valant 10 DH", () => {
    expect(pointsEarned(500)).toBe(50);
    expect(pointsValue(pointsEarned(500))).toBe(10);
  });
  it("ne crédite que les articles réellement réglés après fidélité", () => {
    const used = usablePoints(50, 250);
    expect(used).toBe(50);
    expect(pointsEarned(250 - pointsValue(used))).toBe(24);
  });
});