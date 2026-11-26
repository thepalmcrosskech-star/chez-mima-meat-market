import { describe, expect, it } from "vitest";
import { adjustQuantity, CHARCUTERIE_CATEGORY_ID, getDefaultQuantity, getQuantityRules, getWeightOptions } from "../product-units";

describe("quantités charcuterie", () => {
  it("identifie le rayon et propose uniquement 100, 200, 300 et 500 g", () => {
    expect(CHARCUTERIE_CATEGORY_ID).toBe("0e3b434d-9c58-4c08-b571-b40238a0c567");
    expect(getWeightOptions(CHARCUTERIE_CATEGORY_ID).map(option => option.value)).toEqual([0.1, 0.2, 0.3, 0.5]);
  });
  describe.each(["weight", "kg"])("unité %s", unit => {
    it("commence à 100 g et borne à 500 g", () => {
      expect(getDefaultQuantity(unit, CHARCUTERIE_CATEGORY_ID)).toBe(0.1);
      expect(getQuantityRules(unit, CHARCUTERIE_CATEGORY_ID)).toEqual({ minimum: 0.1, maximum: 0.5, step: 0.1 });
      expect(adjustQuantity(unit, CHARCUTERIE_CATEGORY_ID, 0.1, -1)).toBe(0.1);
      expect(adjustQuantity(unit, CHARCUTERIE_CATEGORY_ID, 0.5, 1)).toBe(0.5);
    });
    it("parcourt tous les grammages autorisés et saute 400 g dans les deux sens", () => {
      const values = [0.1, 0.2, 0.3, 0.5];
      for (let i = 0; i < values.length - 1; i++) {
        expect(adjustQuantity(unit, CHARCUTERIE_CATEGORY_ID, values[i], 1)).toBe(values[i + 1]);
        expect(adjustQuantity(unit, CHARCUTERIE_CATEGORY_ID, values[i + 1], -1)).toBe(values[i]);
      }
    });
  });
});

describe("produits standards", () => {
  it.each(["weight", "kg"])("poids %s : minimum et pas de 250 g, sans maximum", unit => {
    expect(getDefaultQuantity(unit, "other")).toBe(0.25);
    expect(getQuantityRules(unit, "other")).toEqual({ minimum: 0.25, maximum: null, step: 0.25 });
    expect(adjustQuantity(unit, "other", 0.25, -1)).toBe(0.25);
    expect(adjustQuantity(unit, "other", 0.25, 1)).toBe(0.5);
    expect(adjustQuantity(unit, "other", 1, 1)).toBe(1.25);
  });
  it("propose les poids standards sans les confondre avec la charcuterie", () => {
    expect(getWeightOptions().map(option => option.value)).toEqual([0.25, 0.5, 0.75, 1]);
  });
  it("conserve les unités entières pour les produits à la pièce", () => {
    expect(getQuantityRules("piece", CHARCUTERIE_CATEGORY_ID)).toEqual({ minimum: 1, maximum: null, step: 1 });
    expect(adjustQuantity("piece", CHARCUTERIE_CATEGORY_ID, 1, -1)).toBe(1);
    expect(adjustQuantity("piece", CHARCUTERIE_CATEGORY_ID, 1, 1)).toBe(2);
  });
});