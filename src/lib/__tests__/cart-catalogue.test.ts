import { describe, it, expect } from "vitest";
import { compareCartWithCatalogue } from "../cart-catalogue";

const line = { id: "a", name: "Kefta", price: 90, unit_type: "kg", quantity: 1 };
describe("compareCartWithCatalogue", () => {
  it("flags a price change and uses the catalogue price", () => {
    const r = compareCartWithCatalogue([line], [{ id: "a", name: "Kefta", price: 95, unit_type: "kg", is_active: true }]);
    expect(r.changes).toEqual([{ kind: "price", id: "a", name: "Kefta", oldPrice: 90, newPrice: 95 }]);
    expect(r.updated[0].price).toBe(95);
  });
  it("removes inactive or deleted products", () => {
    expect(compareCartWithCatalogue([line], [{ id: "a", name: "Kefta", price: 90, unit_type: "kg", is_active: false }]).updated).toHaveLength(0);
    expect(compareCartWithCatalogue([line], []).changes[0].kind).toBe("unavailable");
  });
  it("reports nothing when the cart matches", () => {
    expect(compareCartWithCatalogue([line], [{ id: "a", name: "Kefta", price: 90, unit_type: "kg", is_active: true }]).changes).toEqual([]);
  });
});
