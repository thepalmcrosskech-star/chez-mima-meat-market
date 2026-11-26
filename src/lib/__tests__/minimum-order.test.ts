import { describe, it, expect } from "vitest";
import { minimumOrderStatus } from "@/lib/minimum-order";

describe("minimum de commande en livraison", () => {
  it("refuse juste en dessous du minimum", () => {
    expect(minimumOrderStatus(149.99, 150, false)).toEqual({ minimum: 150, remaining: 0.01, meetsMinimum: false });
  });
  it("accepte un montant égal au minimum", () => {
    expect(minimumOrderStatus(150, 150, false).meetsMinimum).toBe(true);
  });
  it("accepte au-dessus du minimum", () => {
    expect(minimumOrderStatus(150.01, 150, false).meetsMinimum).toBe(true);
  });
  it("n'applique pas le minimum au retrait en boutique", () => {
    expect(minimumOrderStatus(20, 150, true)).toEqual({ minimum: 0, remaining: 0, meetsMinimum: true });
  });
  it("affiche le montant restant à atteindre", () => {
    expect(minimumOrderStatus(100, 150, false).remaining).toBe(50);
  });
});
