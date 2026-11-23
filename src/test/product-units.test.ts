import { describe, expect, it } from "vitest";
import {
  CHARCUTERIE_CATEGORY_ID,
  getDefaultQuantity,
  getQuantityRules,
  getWeightOptions,
} from "@/lib/product-units";

describe("product quantity rules", () => {
  it("offers charcuterie from 100 g through 500 g", () => {
    expect(getDefaultQuantity("weight", CHARCUTERIE_CATEGORY_ID)).toBe(0.1);
    expect(getDefaultQuantity("kg", CHARCUTERIE_CATEGORY_ID)).toBe(0.1);
    expect(getWeightOptions(CHARCUTERIE_CATEGORY_ID)).toEqual([
      { label: "100g", value: 0.1 },
      { label: "200g", value: 0.2 },
      { label: "300g", value: 0.3 },
      { label: "500g", value: 0.5 },
    ]);
  });

  it("adjusts charcuterie by 100 g between 100 g and 500 g", () => {
    expect(getQuantityRules("weight", CHARCUTERIE_CATEGORY_ID)).toEqual({ minimum: 0.1, maximum: 0.5, step: 0.1 });
  });

  it("keeps the existing 250 g rules outside charcuterie", () => {
    expect(getDefaultQuantity("weight", "another-category")).toBe(0.25);
    expect(getQuantityRules("weight", "another-category")).toEqual({ minimum: 0.25, maximum: null, step: 0.25 });
  });

  it("keeps piece quantities unchanged", () => {
    expect(getQuantityRules("piece", CHARCUTERIE_CATEGORY_ID)).toEqual({ minimum: 1, maximum: null, step: 1 });
  });
});
