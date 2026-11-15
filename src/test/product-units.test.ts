import { describe, expect, it } from "vitest";
import { isWeightUnit } from "@/lib/product-units";

describe("product unit types", () => {
  it("recognizes the database weight unit", () => {
    expect(isWeightUnit("weight")).toBe(true);
  });

  it("keeps piece quantities separate from weight quantities", () => {
    expect(isWeightUnit("piece")).toBe(false);
  });

  it("continues to recognize legacy weight values in saved carts", () => {
    expect(isWeightUnit("kg")).toBe(true);
  });
});