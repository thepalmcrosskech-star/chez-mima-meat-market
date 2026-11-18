import type { Product } from "@/types/product";

export type CatalogueEntry =
  | { kind: "product"; product: Product }
  | { kind: "family"; family: string; products: Product[]; lead: Product };

/** Groups products sharing the same family into one catalogue card; each flavour stays its own product. */
export function groupByFamily(products: Product[]): CatalogueEntry[] {
  const entries: CatalogueEntry[] = [];
  const families = new Map<string, Product[]>();
  for (const product of products) {
    const family = product.family?.trim();
    if (!family) {
      entries.push({ kind: "product", product });
      continue;
    }
    const members = families.get(family);
    if (members) {
      members.push(product);
    } else {
      const list = [product];
      families.set(family, list);
      entries.push({ kind: "family", family, products: list, lead: product });
    }
  }
  return entries.map((entry) => {
    if (entry.kind !== "family") return entry;
    if (entry.products.length === 1) return { kind: "product", product: entry.products[0] };
    const lead = entry.products.find((p) => p.is_active) ?? entry.products[0];
    return { ...entry, lead };
  });
}

export const familyMinPrice = (products: Product[]) => {
  const available = products.filter((p) => p.is_active);
  return Math.min(...(available.length ? available : products).map((p) => Number(p.price)));
};
