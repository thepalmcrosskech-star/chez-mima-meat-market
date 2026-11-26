import { describe, expect, it } from "vitest";
import L from "leaflet";
import { addMapMarker, getDirectRoute, mapPoint, STREET_TILES } from "@/lib/open-map";


describe("cartes sans clé", () => {
  it("charge les tuiles OpenStreetMap sans jeton", () => {
    expect(STREET_TILES).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  });
  it("préserve les coordonnées longitude/latitude lors du passage à Leaflet", () => {
    expect(mapPoint([-8.019188, 31.588938])).toEqual([31.588938, -8.019188]);
  });
  it("trace une ligne directe avec distance haversine et temps estimé à 25 km/h", () => {
    const route = getDirectRoute([-8.019188, 31.588938], [-8.01, 31.6]);
    expect(route.geometry.coordinates).toEqual([[-8.019188, 31.588938], [-8.01, 31.6]]);
    expect(route.distance / 1000).toBeCloseTo(1.5, 1);
    expect(route.duration).toBeCloseTo((route.distance / 1000 / 25) * 3600, 5);
  });
  it("donne zéro quand le livreur est arrivé", () => {
    expect(getDirectRoute([-8, 31], [-8, 31]).distance).toBe(0);
  });
  it("place et déplace les repères sans inverser les coordonnées et sans interpréter les adresses comme du HTML", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const map = L.map(container).setView([31.588938, -8.019188], 12);
    try {
      const marker = addMapMarker(map, [-8.019188, 31.588938], { popup: '<img src=x onerror="alert(1)">' });
      expect(marker.getLatLng()).toMatchObject({ lat: 31.588938, lng: -8.019188 });
      marker.setLatLng([31.6, -8.01]);
      expect(marker.getLatLng()).toMatchObject({ lat: 31.6, lng: -8.01 });
      const content = marker.getPopup()?.getContent();
      expect(content instanceof HTMLElement && content.querySelector("img")).toBe(null);
    } finally { map.remove(); container.remove(); }
  });
});