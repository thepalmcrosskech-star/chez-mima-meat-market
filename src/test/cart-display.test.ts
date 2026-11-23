import { describe, expect, it } from "vitest";
import { cartBadgeCount, formatCartQuantity } from "@/lib/cart-display";

describe("cart display", () => {
  it("counts one article for 250 g of a product, not 0.25", () => {
    expect(cartBadgeCount([{ quantity: 0.25 }])).toBe(1);
    expect(cartBadgeCount([{ quantity: 0.25 }, { quantity: 3 }])).toBe(2);
  });

  it("shows weights under 1 kg in grams", () => {
    expect(formatCartQuantity(0.25, "weight")).toBe("250 g");
    expect(formatCartQuantity(0.75, "kg")).toBe("750 g");
  });

  it("shows weights from 1 kg with a French decimal comma", () => {
    expect(formatCartQuantity(1, "weight")).toBe("1 kg");
    expect(formatCartQuantity(1.5, "weight")).toBe("1,5 kg");
  });

  it("shows pieces as a plain count", () => {
    expect(formatCartQuantity(3, "piece")).toBe("3");
  });
});
