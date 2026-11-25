import L from "leaflet";

export const STREET_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const STREET_ATTRIBUTION = "© OpenStreetMap contributors";

/** Public OSRM routing uses OSM road data; unlike tiles, this demo has no SLA. */
export async function getRoadRoute(start: [number, number], end: [number, number]) {
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${start.join(",")};${end.join(",")}?overview=full&geometries=geojson`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new Error(`Itinéraire indisponible (${response.status})`);
  const data = await response.json();
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route || !Array.isArray(route.geometry?.coordinates)) {
    throw new Error("Aucun itinéraire routier disponible");
  }
  return route as { duration: number; distance: number; geometry: { coordinates: [number, number][] } };
}

export function mapPoint([lng, lat]: [number, number]): L.LatLngTuple {
  return [lat, lng];
}

export function addMapMarker(map: L.Map, coordinates: [number, number], options: { element?: HTMLElement; color?: string; popup?: string } = {}) {
  const element = options.element ?? document.createElement("div");
  if (!options.element) {
    element.className = "open-map-pin";
    if (options.color) element.style.setProperty("--pin-color", options.color);
  }
  const marker = L.marker(mapPoint(coordinates), {
    icon: L.divIcon({ html: element, className: "open-map-marker", iconSize: [36, 36], iconAnchor: [18, 18] }),
  }).addTo(map);
  // Leaflet treats strings as HTML: use a node to keep names and addresses safe.
  if (options.popup) {
    const content = document.createElement("div");
    content.textContent = options.popup;
    marker.bindPopup(content);
  }
  return marker;
}