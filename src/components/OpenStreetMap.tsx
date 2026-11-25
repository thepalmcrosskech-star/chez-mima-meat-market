import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./OpenStreetMap.css";
import { STREET_ATTRIBUTION, STREET_TILES, mapPoint } from "@/lib/open-map";

interface OpenStreetMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  onMapReady?: (map: L.Map) => void;
  onClick?: (lngLat: { lng: number; lat: number }) => void;
  interactive?: boolean;
}

export default function OpenStreetMap({ center = [-8.019, 31.589], zoom = 12, className = "w-full h-64", onMapReady, onClick, interactive = true }: OpenStreetMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onMapReady, onClick });
  callbacks.current = { onMapReady, onClick };
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      zoomControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    }).setView(mapPoint(center), zoom);
    if (interactive) L.control.zoom({ position: "topright" }).addTo(map);
    const tiles = L.tileLayer(STREET_TILES, { attribution: STREET_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));
    map.on("click", (event: L.LeafletMouseEvent) => callbacks.current.onClick?.({ lng: event.latlng.lng, lat: event.latlng.lat }));
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    callbacks.current.onMapReady?.(map);
    return () => { resize.disconnect(); map.remove(); };
    // Views manage subsequent center and marker updates through onMapReady.
  }, []);

  return <div className={`open-map ${className} rounded-lg overflow-hidden`}>
    <div ref={container} className="h-full w-full" aria-label="Carte OpenStreetMap" />
    {tileError && <div role="status" className="absolute top-2 left-2 z-[1000] bg-background text-foreground rounded px-2 py-1 text-xs">Le fond de carte est temporairement indisponible.</div>}
  </div>;
}