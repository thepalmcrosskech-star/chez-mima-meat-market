import { describe, it, expect } from "vitest";
import { compareProductsForDisplay } from "@/lib/productOrder";

describe("ordre des produits", () => {
  it("place les poulets nature en premier et regroupe les 5 saveurs de cubes marinés", () => {
    const names = ["Cubes de poulet marinés – Tandoori", "Cordons Bleus", "Filet Poulet", "Cubes de poulet marinés – Curry", "Croque Pizza", "Poulet Entier", "Cubes de poulet marinés – 3 Poivres"];
    const sorted = names.map((name) => ({ name })).sort(compareProductsForDisplay).map((p) => p.name);
    expect(sorted.slice(0, 2)).toEqual(["Filet Poulet", "Poulet Entier"]);
    const i = sorted.indexOf("Cubes de poulet marinés – 3 Poivres");
    expect(sorted.slice(i, i + 3).every((n) => n.startsWith("Cubes de poulet marinés"))).toBe(true);
  });
});
