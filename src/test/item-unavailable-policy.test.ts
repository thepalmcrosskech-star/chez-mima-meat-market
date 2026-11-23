import { describe, expect, it } from "vitest";
import { canReplaceArticle, itemUnavailablePolicy, orderItemPayload, updateItemPreference } from "@/lib/item-unavailable-policy";

describe("consignes par article", () => {
  it("remplace par défaut les articles sans choix", () => {
    expect(itemUnavailablePolicy(undefined)).toBe("replace");
    expect(orderItemPayload([{ id: "poulet", quantity: 0.25 }])[0].unavailable_policy).toBe("replace");
  });
  it("change un seul article sans changer les autres ni le panier initial", () => {
    const items = [{ id: "poulet", quantity: 0.25 }, { id: "boeuf", quantity: 0.5 }];
    const updated = updateItemPreference(items, "poulet", "remove_item");
    expect(orderItemPayload(updated)).toEqual([
      { product_id: "poulet", quantity_value: 0.25, unavailable_policy: "remove_item" },
      { product_id: "boeuf", quantity_value: 0.5, unavailable_policy: "replace" },
    ]);
    expect(items[0]).not.toHaveProperty("unavailable_policy");
  });
  it("conserve les choix après sauvegarde du panier", () => {
    const items = [{ id: "poulet", quantity: 0.25, unavailable_policy: "remove_item" as const }];
    expect(orderItemPayload(JSON.parse(JSON.stringify(items)))[0].unavailable_policy).toBe("remove_item");
  });
  it("interdit le remplacement d’un article demandé en retrait", () => {
    expect(canReplaceArticle("remove_item")).toBe(false);
    expect(canReplaceArticle("replace")).toBe(true);
    expect(canReplaceArticle(null)).toBe(true);
  });
});