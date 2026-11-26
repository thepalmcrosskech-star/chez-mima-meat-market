/** Delivery minimum is checked on the article subtotal before delivery fee and discounts; pickup is exempt. Mirrors create_customer_order. */
export function minimumOrderStatus(subtotal: number, minimumOrder: number | null | undefined, isPickup: boolean) {
  const minimum = isPickup ? 0 : Math.max(Number(minimumOrder) || 0, 0);
  const remaining = Math.max(Math.round((minimum - subtotal) * 100) / 100, 0);
  return { minimum, remaining, meetsMinimum: remaining === 0 };
}
