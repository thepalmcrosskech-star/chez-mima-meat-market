import { afterEach, describe, expect, it, vi } from "vitest";
import L from "leaflet";
import { addMapMarker, getRoadRoute, mapPoint, STREET_TILES } from "@/lib/open-map";

afterEach(() => vi.unstubAllGlobals());

describe("cartes sans clé", () => {
  it("charge les tuiles OpenStreetMap sans jeton", () => {
    expect(STREET_TILES).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  });
  it("préserve les coordonnées longitude/latitude lors du passage à Leaflet", () => {
    expect(mapPoint([-8.019188, 31.588938])).toEqual([31.588938, -8.019188]);
  });
  it("conserve les distances et délais routiers sans clé Mapbox", async () => {
    const route = { duration: 600, distance: 4200, geometry: { coordinates: [[-8.019188, 31.588938], [-8.01, 31.6]] } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "Ok", routes: [route] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await getRoadRoute([-8.019188, 31.588938], [-8.01, 31.6])).toEqual(route);
    expect(fetchMock.mock.calls[0][0]).toBe("https://router.project-osrm.org/route/v1/driving/-8.019188,31.588938;-8.01,31.6?overview=full&geometries=geojson");
  });
  it("ne fabrique pas d’estimation lorsque le service routier est indisponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(getRoadRoute([-8, 31], [-8.01, 31.1])).rejects.toThrow("503");
  });
  it("refuse les réponses sans itinéraire", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "NoRoute", routes: [] }) }));
    await expect(getRoadRoute([-8, 31], [-8.01, 31.1])).rejects.toThrow("Aucun itinéraire");
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