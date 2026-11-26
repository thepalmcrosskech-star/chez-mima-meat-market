/**
 * Address search through the public OpenStreetMap Nominatim service.
 * Its usage policy forbids autocomplete and allows at most one request per second,
 * so searches run only on an explicit action, are throttled, cached and capped per session.
 */
export interface AddressResult { label: string; latitude: number; longitude: number }

export const MIN_QUERY_LENGTH = 3;
export const MIN_INTERVAL_MS = 1100;
export const MAX_SEARCHES_PER_SESSION = 20;
// Marrakech area (left, top, right, bottom) – results are restricted to it.
const VIEWBOX = "-8.20,31.75,-7.85,31.50";

const cache = new Map<string, AddressResult[]>();
let lastCall = 0;
let calls = 0;

export class AddressSearchError extends Error {}

export function normalizeQuery(q: string) { return q.trim().replace(/\s+/g, " ").toLowerCase(); }

export async function searchAddress(query: string, signal?: AbortSignal, now = () => Date.now(), fetcher: typeof fetch = fetch): Promise<AddressResult[]> {
  const key = normalizeQuery(query);
  if (key.length < MIN_QUERY_LENGTH) throw new AddressSearchError("Saisissez au moins 3 caractères.");
  const cached = cache.get(key);
  if (cached) return cached;
  if (calls >= MAX_SEARCHES_PER_SESSION) throw new AddressSearchError("Trop de recherches. Placez le repère directement sur le plan.");
  const wait = lastCall + MIN_INTERVAL_MS - now();
  if (wait > 0) throw new AddressSearchError("Patientez une seconde avant une nouvelle recherche.");
  lastCall = now();
  calls += 1;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ma&bounded=1&viewbox=${VIEWBOX}&accept-language=fr&q=${encodeURIComponent(query.trim())}`;
  let response: Response;
  try { response = await fetcher(url, { signal, headers: { Accept: "application/json" } }); }
  catch (e) { if ((e as Error).name === "AbortError") throw e; throw new AddressSearchError("La recherche est indisponible. Placez le repère sur le plan."); }
  if (!response.ok) throw new AddressSearchError("La recherche est indisponible. Placez le repère sur le plan.");
  const rows = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  const results = rows.map(r => ({ label: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon) }))
    .filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
  cache.set(key, results);
  return results;
}

/** Test helper. */
export function resetAddressSearch() { cache.clear(); lastCall = 0; calls = 0; }
