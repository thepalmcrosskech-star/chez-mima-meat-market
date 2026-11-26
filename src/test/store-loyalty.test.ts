import { describe, expect, it } from "vitest";
import { loyaltyReversalTargets, pointsEarned, pointsValue, usablePoints } from "@/lib/loyalty";

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
  it("rend les 50 points et retire les 11 points gagnés quand un ticket de 120 DH avec 10 DH de remise est annulé", () => {
    expect(loyaltyReversalTargets(120, 50, 11, 110)).toEqual({ pointsUsed: 50, earnedPoints: 11 });
  });
  it("calcule un remboursement partiel sur la somme payée après remise", () => {
    expect(loyaltyReversalTargets(120, 50, 11, 55)).toEqual({ pointsUsed: 25, earnedPoints: 5 });
  });
});