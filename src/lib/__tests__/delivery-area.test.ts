import { describe, expect, it } from "vitest";
import { DELIVERY_AREA, isInDeliveryArea, STORE_MAP_COORDINATES } from "../delivery-area";
import { deliveryZoneForPoint } from "../delivery-zone";

const store = { lat: STORE_MAP_COORDINATES[1], lng: STORE_MAP_COORDINATES[0] };
const zones = [
  { id: "near", min_radius_km: 0, radius_km: 4 },
  { id: "middle", min_radius_km: 4, radius_km: 6 },
  { id: "far", min_radius_km: 6, radius_km: 10 },
];

describe("couverture officielle Glovo", () => {
  it("inclut le centre de Marrakech et lui attribue une tranche", () => {
    expect(isInDeliveryArea(31.6258, -7.9891)).toBe(true);
    expect(deliveryZoneForPoint(31.6258, -7.9891, store, zones)?.id).toBe("middle");
  });
  it("exclut un point extérieur même si une tranche de distance le couvre", () => {
    expect(isInDeliveryArea(31.515, -8.05)).toBe(false);
    expect(deliveryZoneForPoint(31.515, -8.05, store, zones)).toBeNull();
  });
  it("inclut exactement chaque sommet et milieu de segment", () => {
    expect(DELIVERY_AREA).toHaveLength(228);
    for (let i = 0; i < DELIVERY_AREA.length; i++) {
      const a = DELIVERY_AREA[i];
      const b = DELIVERY_AREA[(i + 1) % DELIVERY_AREA.length];
      for (const [lat, lng] of [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]) {
        expect(isInDeliveryArea(lat, lng), `frontière ${i}`).toBe(true);
        expect(deliveryZoneForPoint(lat, lng, store, zones), `tranche frontière ${i}`).not.toBeNull();
      }
    }
  });
  it("utilise la dernière tranche au bord officiel au-delà de son rayon", () => {
    expect(deliveryZoneForPoint(31.679125, -8.019188, store, zones)?.id).toBe("far");
    expect(deliveryZoneForPoint(31.679126, -8.019188, store, zones)).toBeNull();
  });
  it("trie les tranches sans modifier leur tableau et ignore les rayons absents", () => {
    const input = [zones[2], { id: "unset", min_radius_km: 0, radius_km: null }, zones[0], zones[1]];
    const original = [...input];
    expect(deliveryZoneForPoint(store.lat, store.lng, store, input)?.id).toBe("near");
    expect(input).toEqual(original);
    expect(deliveryZoneForPoint(store.lat, store.lng, store, [])).toBeNull();
  });
  it.each([[NaN, -8], [Infinity, -8], [91, -8], [31, 181]])("refuse les coordonnées invalides %s, %s", (lat, lng) => {
    expect(isInDeliveryArea(lat, lng)).toBe(false);
    expect(deliveryZoneForPoint(lat, lng, store, zones)).toBeNull();
  });
});