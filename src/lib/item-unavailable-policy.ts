export type ItemUnavailablePolicy = "replace" | "remove_item";

export function itemUnavailablePolicy(value: unknown): ItemUnavailablePolicy {
  return value === "remove_item" ? "remove_item" : "replace";
}

export function updateItemPreference<T extends { id: string; unavailable_policy?: ItemUnavailablePolicy }>(
  items: T[], id: string, policy: ItemUnavailablePolicy,
): T[] {
  return items.map(item => item.id === id ? { ...item, unavailable_policy: policy } : item);
}

export function orderItemPayload(items: { id: string; quantity: number; unavailable_policy?: ItemUnavailablePolicy }[]) {
  return items.map(item => ({
    product_id: item.id,
    quantity_value: item.quantity,
    unavailable_policy: itemUnavailablePolicy(item.unavailable_policy),
  }));
}

export function canReplaceArticle(policy: string | null | undefined): boolean {
  return policy !== "remove_item";
}