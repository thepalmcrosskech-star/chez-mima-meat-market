import { describe, it, expect } from "vitest";
import { buildReorderLines } from "@/lib/reorder";
const prod = (o = {}) => ({ id: "p", name: "Steak", price: 120, unit_type: "kg", image_url: null, category_id: null, is_active: true, stock_quantity: 5, ...o });
describe("recommander", () => {
  it("reprend la quantité commandée à l'origine", () => {
    const r = buildReorderLines([{ product_id: "p", quantity_value: 0.4, ordered_quantity_value: 0.5, item_status: "ok", product: prod() }]);
    expect(r.lines[0].quantity).toBe(0.5);
  });
  it("ignore les produits retirés de la vente ou en rupture", () => {
    const r = buildReorderLines([
      { product_id: "p", quantity_value: 1, ordered_quantity_value: null, item_status: "ok", product: prod({ is_active: false }) },
      { product_id: "p", quantity_value: 1, ordered_quantity_value: null, item_status: "ok", product: prod({ stock_quantity: 0 }) },
      { product_id: null, quantity_value: 1, ordered_quantity_value: null, item_status: "ok", product: null },
    ]);
    expect(r.lines).toHaveLength(0);
    expect(r.skipped).toBe(3);
  });
});
