import { isInDeliveryArea } from "./delivery-area";
import { haversineDistance } from "./geo";

interface Zone {
  min_radius_km: number | null;
  radius_km: number | null;
}

/** The provider polygon defines coverage; distance bands determine the existing tariff only. */
export function deliveryZoneForPoint<T extends Zone>(lat: number, lng: number, store: { lat: number; lng: number }, zones: T[]): T | null {
  if (!isInDeliveryArea(lat, lng)) return null;
  const distance = haversineDistance(store.lat, store.lng, lat, lng);
  const sorted = [...zones].filter(z => z.radius_km !== null).sort((a, b) => (a.radius_km ?? 0) - (b.radius_km ?? 0));
  return sorted.find((zone, index) => distance >= (zone.min_radius_km ?? 0) &&
    (distance <= (zone.radius_km ?? 0) || index === sorted.length - 1)) ?? null;
}