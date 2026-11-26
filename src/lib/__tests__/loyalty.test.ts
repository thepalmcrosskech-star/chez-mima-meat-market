import { describe, expect, it } from "vitest";
import { pointsEarned, pointsValue, usablePoints } from "../loyalty";

describe("fidélité : calcul des points", () => {
  it.each([[0, 0], [9.99, 0], [10, 1], [19.99, 1], [20, 2], [129.9, 12], [500, 50], [-10, 0]])("%s DH réglés donnent %s points", (paid, points) => {
    expect(pointsEarned(paid)).toBe(points);
  });
  it.each([[0, 0], [50, 10], [100, 20], [150, 30]])("%s points valent %s DH", (points, value) => {
    expect(pointsValue(points)).toBe(value);
  });
  it.each([[49, 300, 0], [50, 300, 50], [99, 300, 50], [120, 300, 100], [-50, 300, 0]])("solde %s et articles %s : utilise %s points en blocs de 50", (balance, amount, expected) => {
    expect(usablePoints(balance, amount)).toBe(expected);
  });
  it.each([[50, 10, 0], [100, 20, 50], [200, 25, 100], [50, 10.01, 50], [100, 0, 0]])("ne couvre jamais 100 %% des articles : solde %s, montant %s", (balance, amount, expected) => {
    const used = usablePoints(balance, amount);
    expect(used).toBe(expected);
    if (amount > 0) expect(pointsValue(used)).toBeLessThan(amount);
  });
  it("crédite les articles réglés après la remise fidélité", () => {
    const used = usablePoints(50, 250);
    expect(used).toBe(50);
    expect(pointsValue(used)).toBe(10);
    expect(pointsEarned(250 - pointsValue(used))).toBe(24);
  });
});