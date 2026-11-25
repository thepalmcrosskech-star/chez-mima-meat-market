import { describe, it, expect } from "vitest";
import { DELIVERY_AREA, isInDeliveryArea } from "@/lib/delivery-area";
import { deliveryZoneForPoint } from "@/lib/delivery-zone";
import { readFileSync } from "node:fs";
describe("zone de livraison Glovo", () => {
  it("accepte la boutique", () => expect(isInDeliveryArea(31.588938, -8.019188)).toBe(true));
  it("accepte Guéliz", () => expect(isInDeliveryArea(31.636, -8.010)).toBe(true));
  it("refuse Tameslouht (hors contour, < 10 km)", () => expect(isInDeliveryArea(31.515, -8.05)).toBe(false));
  it("conserve les 228 coordonnées exactes dans la règle de commande", () => {
    const sql = readFileSync("drizzle/migrations/0024_definitive_glovo_store_boundary.sql", "utf8");
    const match = sql.match(/pts numeric\[\]\[\] := ARRAY(\[\[.*?\]\]);/s);
    expect(match).not.toBeNull();
    expect(DELIVERY_AREA).toHaveLength(228);
    expect(JSON.parse(match?.[1] ?? "null")).toEqual(DELIVERY_AREA);
    expect(DELIVERY_AREA[0]).toEqual([31.667185, -7.968653]);
  });
  it("inclut tous les sommets et les segments du contour officiel", () => {
    for (let i = 1; i < DELIVERY_AREA.length; i++) {
      const [lat, lng] = DELIVERY_AREA[i];
      const [previousLat, previousLng] = DELIVERY_AREA[i - 1];
      expect(isInDeliveryArea(lat, lng)).toBe(true);
      expect(isInDeliveryArea((lat + previousLat) / 2, (lng + previousLng) / 2)).toBe(true);
    }
  });
  it("refuse le nord de la zone générale Glovo non autorisé pour cette boutique", () => expect(isInDeliveryArea(31.69, -8.02)).toBe(false));
  it("respecte la limite nord précise sans la remplacer par un cercle", () => {
    expect(isInDeliveryArea(31.679124, -8.019188)).toBe(true);
    expect(isInDeliveryArea(31.679126, -8.019188)).toBe(false);
  });
  it("refuse les coordonnées invalides", () => {
    for (const [lat, lng] of [[NaN, -8], [Infinity, -8], [91, -8], [31, 181]]) expect(isInDeliveryArea(lat, lng)).toBe(false);
  });
  it("applique la dernière tranche existante à la limite officielle au-delà de 10 km", () => {
    const zones = [{ min_radius_km: 0, radius_km: 4, fee: 21.6 }, { min_radius_km: 4, radius_km: 6, fee: 23.4 }, { min_radius_km: 6, radius_km: 8, fee: 26.4 }, { min_radius_km: 8, radius_km: 10, fee: 30 }];
    const store = { lat: 31.589020, lng: -8.019172 };
    expect(deliveryZoneForPoint(31.679125, -8.019188, store, zones)?.fee).toBe(30);
    expect(deliveryZoneForPoint(31.69, -8.02, store, zones)).toBeNull();
    expect(deliveryZoneForPoint(31.588938, -8.019188, store, zones)?.fee).toBe(21.6);
  });
});
