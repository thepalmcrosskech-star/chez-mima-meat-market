import { describe, it, expect } from "vitest";
import { isInDeliveryArea } from "@/lib/delivery-area";
describe("zone de livraison Glovo", () => {
  it("accepte la boutique", () => expect(isInDeliveryArea(31.588938, -8.019188)).toBe(true));
  it("accepte Guéliz", () => expect(isInDeliveryArea(31.636, -8.010)).toBe(true));
  it("refuse Tameslouht (hors contour, < 10 km)", () => expect(isInDeliveryArea(31.515, -8.05)).toBe(false));
});
