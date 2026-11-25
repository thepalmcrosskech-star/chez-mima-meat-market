import coordinates from "./glovo-delivery-area.json";

/** Exact store delivery polygon supplied by Glovo. Coordinates are [latitude, longitude]. */
export const DELIVERY_AREA: [number, number][] = coordinates.map(([lat, lng]) => [lat, lng]);

/** Ray casting with an inclusive boundary, without rounding or expanding the official polygon. */
export function isInDeliveryArea(lat: number, lng: number, area: [number, number][] = DELIVERY_AREA): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || area.length < 3) return false;
  let inside = false;
  for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
    const [yi, xi] = area[i];
    const [yj, xj] = area[j];
    const cross = (lng - xi) * (yj - yi) - (lat - yi) * (xj - xi);
    if (Math.abs(cross) <= 1e-12 && lng >= Math.min(xi, xj) && lng <= Math.max(xi, xj) && lat >= Math.min(yi, yj) && lat <= Math.max(yi, yj)) return true;
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
