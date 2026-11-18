// Classement importé de Chez Mima Gestion, ventes des 30 derniers jours.
// Viande hachée 25% MG, Panuzzo Classique et Paleron ne figurent plus dans le catalogue en vente.
export const TOP_SELLING_PRODUCT_IDS = [
  "c7a5025a-78d6-4cce-8a50-a79d04430422", // 1 — Filet Poulet
  "19a1e9e5-1cbf-4957-919d-b16babb4805d", // 2 — Viande Hachée
  "a844631b-ff51-48f6-b004-3debfdd22f9e", // 5 — Merguez Boeuf Maison
  "4b834132-5f1e-4dff-b598-c765578aff74", // 6 — Viande Hachée Régime
  "2c6fccc0-8437-4ec3-90ce-11346989a4ad", // 7 — Merguez Piquante
  "20450307-1fcb-41ef-ab9d-968f726b16a8", // 8 — Brochettes Poulet
  "30d22cfa-55af-4013-91ff-011f93aeb469", // 9 — Saucisson Sec Maison
  "642505a2-522f-43d4-b807-98ebe2d1fa8b", // 10 — Steak Haché
  "13451b1d-df59-4daa-9cb1-0ff476227329", // 11 — Poulet rôti
  "065d7c95-11f8-473c-978f-a7f0b611a013", // 13 — Cuisse De Poulet
  "87f90141-ccd2-491c-b481-312bd327ed1c", // 14 — Cordons Bleus
  "13578157-a826-4cbd-bb62-218434fc5c51", // 15 — Jarret Boeuf Sans Os
  "d636b335-e7be-410d-b416-1db781bbe8a8", // 16 — Tajine Boeuf Avec Os
  "d7c856bc-6fda-46d1-abe2-c890ad1192e6", // 17 — Filet Poulet Premium
  "6bd05fe3-8dc7-4e3d-8126-cfb5effcd8b8", // 18 — Steak Rumsteak
  "febc0d27-6537-42d3-9daf-bf56df5fe7dc", // 19 — Bacon
  "6a3a043b-72d1-4e8a-8b5a-a48bfcb41b41", // 20 — Jarret Boeuf Avec Os
] as const;

const salesRank = new Map<string, number>(
  TOP_SELLING_PRODUCT_IDS.map((productId, index) => [productId, index]),
);

/** Retains only products present in the imported sales ranking, in that exact order. */
export function getTopSellingProducts<T extends { id: string }>(products: T[]): T[] {
  return products
    .filter((product) => salesRank.has(product.id))
    .sort((a, b) => (salesRank.get(a.id) ?? Infinity) - (salesRank.get(b.id) ?? Infinity));
}
