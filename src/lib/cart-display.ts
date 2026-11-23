import { isWeightUnit } from "@/lib/product-units";

/** Cart badge counts distinct products, never kilograms (0.25 kg = 1 article). */
export const cartBadgeCount = (items: { quantity: number }[]) => items.length;

/** French display of a cart quantity: grams under 1 kg, "1,5 kg" above, plain count for pieces. */
export const formatCartQuantity = (quantity: number, unitType?: string | null) => {
  if (!isWeightUnit(unitType ?? "")) return String(quantity);
  if (quantity < 1) return `${Math.round(quantity * 1000)} g`;
  return `${String(+quantity.toFixed(3)).replace(".", ",")} kg`;
};
