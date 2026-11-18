import { describe, expect, it } from "vitest";
import { getTopSellingProducts, TOP_SELLING_PRODUCT_IDS } from "@/lib/top-selling-products";

describe("getTopSellingProducts", () => {
  it("classe l'accueil selon les ventes importées, en commençant par Filet Poulet puis Viande Hachée", () => {
    const products = [
      { id: TOP_SELLING_PRODUCT_IDS[2] },
      { id: "produit-hors-classement" },
      { id: TOP_SELLING_PRODUCT_IDS[1] },
      { id: TOP_SELLING_PRODUCT_IDS[0] },
    ];

    expect(getTopSellingProducts(products).map(({ id }) => id)).toEqual([
      TOP_SELLING_PRODUCT_IDS[0],
      TOP_SELLING_PRODUCT_IDS[1],
      TOP_SELLING_PRODUCT_IDS[2],
    ]);
  });

  it("conserve les 17 articles du fichier qui existent encore dans le catalogue, sans doublon", () => {
    expect(TOP_SELLING_PRODUCT_IDS).toHaveLength(17);
    expect(new Set(TOP_SELLING_PRODUCT_IDS).size).toBe(17);
  });
});
