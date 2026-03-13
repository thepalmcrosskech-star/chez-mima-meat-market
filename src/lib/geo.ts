/**
 * Point-in-polygon test using ray casting.
 * Handles GeoJSON Polygon format: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
 * Also handles raw coordinate arrays: [[lng, lat], ...]
 */
export function pointInPolygon(lat: number, lng: number, polygon: any): boolean {
  // Extract coordinates from GeoJSON format
  let ring: number[][];
  if (polygon?.type === "Polygon" && Array.isArray(polygon.coordinates)) {
    ring = polygon.coordinates[0]; // outer ring
  } else if (Array.isArray(polygon) && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
    // [[[ lng, lat ], ...]] format
    ring = polygon[0];
  } else if (Array.isArray(polygon) && Array.isArray(polygon[0]) && typeof polygon[0][0] === "number") {
    // [[ lng, lat ], ...] format
    ring = polygon;
  } else {
    return false;
  }

  if (!ring || ring.length < 3) return false;

  let inside = false;
  // GeoJSON coordinates are [lng, lat]
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1], yi = ring[i][0]; // lat, lng
    const xj = ring[j][1], yj = ring[j][0];
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
