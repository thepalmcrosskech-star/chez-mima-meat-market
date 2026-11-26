import L from "leaflet";

export const STREET_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const STREET_ATTRIBUTION = "© OpenStreetMap contributors";

import { haversineDistance } from "./geo";

/** Average urban courier speed used for the straight-line ETA estimate. */
export const COURIER_SPEED_KMH = 25;

/** Direct line between two [lng, lat] points with haversine distance (m) and estimated duration (s). */
export function getDirectRoute(start: [number, number], end: [number, number]) {
  const km = haversineDistance(start[1], start[0], end[1], end[0]);
  return { distance: km * 1000, duration: (km / COURIER_SPEED_KMH) * 3600, geometry: { coordinates: [start, end] } };
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