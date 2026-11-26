import { deliveryZoneForPoint } from "@/lib/delivery-zone";
import { isOpenAt, nextOpening, type WeeklyHours } from "@/lib/store-hours";
import { minimumOrderStatus } from "@/lib/minimum-order";
import { usablePoints, pointsValue } from "@/lib/loyalty";

export interface CheckoutDeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  free_delivery_threshold: number | null;
  radius_km: number | null;
  min_radius_km: number | null;
  is_active: boolean | null;
}

interface CheckoutSummaryInput {
  subtotal: number;
  isPickup: boolean;
  deliveryPoint: { latitude: number; longitude: number } | null;
  storeLocation: { lat: number; lng: number } | null;
  zones: CheckoutDeliveryZone[];
  promoCode: string | null;
  useLoyalty: boolean;
  loyaltyBalance: number;
  weeklyHours: WeeklyHours;
}

const TZ = "Africa/Casablanca";

function formatOpening(nextOpen: Date | null) {
  if (!nextOpen) return "prochaine ouverture";
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(nextOpen).replace(":", " h ");
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (dayKey(nextOpen) === dayKey(today)) return `aujourd'hui à ${time}`;
  if (dayKey(nextOpen) === dayKey(tomorrow)) return `demain à ${time}`;
  return `${new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long" }).format(nextOpen)} à ${time}`;
}

/** Delivery fee, BIENVENUE / loyalty discounts and opening-hours state for checkout display and order payload. */
export function useCheckoutSummary(input: CheckoutSummaryInput) {
  const { subtotal, isPickup, deliveryPoint, storeLocation, zones, promoCode, useLoyalty, loyaltyBalance, weeklyHours } = input;

  let deliveryZone: CheckoutDeliveryZone | null = null;
  let deliveryFee: number | null = null;
  if (isPickup) {
    deliveryFee = 0;
  } else if (deliveryPoint && storeLocation) {
    deliveryZone = deliveryZoneForPoint(deliveryPoint.latitude, deliveryPoint.longitude, storeLocation, zones);
    deliveryFee = deliveryZone
      ? (deliveryZone.free_delivery_threshold && subtotal >= deliveryZone.free_delivery_threshold ? 0 : deliveryZone.delivery_fee)
      : null;
  }

  const discount = promoCode ? Math.round(subtotal * 10) / 100 : 0;
  const loyaltyPoints = useLoyalty ? usablePoints(loyaltyBalance, subtotal - discount) : 0;
  const loyaltyDiscount = pointsValue(loyaltyPoints);
  const total = -loyaltyDiscount + (isPickup ? subtotal : (deliveryFee !== null ? subtotal + deliveryFee : subtotal)) - discount;

  const { minimum: minimumOrder, remaining: minimumRemaining, meetsMinimum } = minimumOrderStatus(subtotal, deliveryZone?.minimum_order, isPickup);

  const isStoreOpen = isOpenAt(weeklyHours);
  const nextOpen = nextOpening(weeklyHours);
  const openingHour = formatOpening(nextOpen);
  const getNextOpeningDate = () => nextOpen ?? new Date();

  return { minimumOrder, minimumRemaining, meetsMinimum, deliveryZone, deliveryFee, discount, loyaltyPoints, loyaltyDiscount, total, isStoreOpen, openingHour, getNextOpeningDate };
}
