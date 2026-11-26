export interface CartLine { id: string; name: string; price: number; unit_type: string; quantity: number }
export interface CatalogueProduct { id: string; name: string; price: number; unit_type: string; is_active: boolean | null }
export type CartChange =
  | { kind: "price"; id: string; name: string; oldPrice: number; newPrice: number }
  | { kind: "unavailable"; id: string; name: string }
  | { kind: "details"; id: string; name: string; newName: string };

/** Compares cart lines with the current catalogue; the returned cart keeps only available products at current prices. */
export function compareCartWithCatalogue<T extends CartLine>(items: T[], products: CatalogueProduct[]) {
  const byId = new Map(products.map(p => [p.id, p]));
  const changes: CartChange[] = [];
  const updated: T[] = [];
  for (const item of items) {
    const p = byId.get(item.id);
    if (!p || p.is_active !== true || !(Number(p.price) > 0)) { changes.push({ kind: "unavailable", id: item.id, name: item.name }); continue; }
    const price = Number(p.price);
    if (price !== Number(item.price)) changes.push({ kind: "price", id: item.id, name: p.name, oldPrice: Number(item.price), newPrice: price });
    else if (p.name !== item.name || p.unit_type !== item.unit_type) changes.push({ kind: "details", id: item.id, name: item.name, newName: p.name });
    updated.push({ ...item, name: p.name, price, unit_type: p.unit_type });
  }
  return { changes, updated };
}

export const expectedPrices = (items: CartLine[]) => items.map(i => ({ product_id: i.id, price: i.price }));
