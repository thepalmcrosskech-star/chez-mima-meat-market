export interface ReorderSourceItem {
  product_id: string | null;
  quantity_value: number;
  ordered_quantity_value: number | null;
  item_status: string;
  unavailable_policy?: string | null;
  product: {
    id: string; name: string; price: number; unit_type: string;
    image_url: string | null; category_id: string | null;
    is_active: boolean | null; stock_quantity: number;
  } | null;
}

/** Articles d'une ancienne commande remis au panier : seulement les produits encore en vente, au prix actuel. */
export function buildReorderLines(items: ReorderSourceItem[]) {
  const lines: { product: NonNullable<ReorderSourceItem["product"]>; quantity: number; policy?: string | null }[] = [];
  let skipped = 0;
  for (const it of items) {
    const p = it.product;
    if (it.item_status === "removed" || !p || p.is_active === false || p.stock_quantity <= 0) { skipped++; continue; }
    const quantity = Number(it.ordered_quantity_value ?? it.quantity_value);
    if (!(quantity > 0)) { skipped++; continue; }
    lines.push({ product: p, quantity, policy: it.unavailable_policy });
  }
  return { lines, skipped };
}
