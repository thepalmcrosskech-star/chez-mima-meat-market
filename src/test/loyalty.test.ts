import { describe, it, expect } from "vitest";
import { pointsEarned, usablePoints, pointsValue } from "@/lib/loyalty";

describe("fidélité", () => {
  it("1 point par tranche de 10 DH", () => {
    expect(pointsEarned(500)).toBe(50);
    expect(pointsEarned(129.9)).toBe(12);
  });
  it("50 points valent 10 DH", () => {
    expect(pointsValue(50)).toBe(10);
  });
  it("points utilisés par paquets de 50 sans dépasser la commande", () => {
    expect(usablePoints(120, 300)).toBe(100);
    expect(usablePoints(49, 300)).toBe(0);
    expect(usablePoints(200, 25)).toBe(100);
  });
});
