import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Mapbox token from env (public/publishable key)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

interface MapboxMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  onMapReady?: (map: mapboxgl.Map) => void;
  onClick?: (lngLat: { lng: number; lat: number }) => void;
  interactive?: boolean;
}

const MapboxMap = ({ center = [-7.5898, 33.5731], zoom = 12, className = "w-full h-64", onMapReady, onClick, interactive = true }: MapboxMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!MAPBOX_TOKEN) {
      setError("Token Mapbox non configuré");
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
      interactive,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    if (onClick) {
      map.on("click", (e) => onClick({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
    }

    map.on("load", () => {
      mapRef.current = map;
      onMapReady?.(map);
    });

    return () => map.remove();
  }, []);

  if (error) {
    return (
      <div className={`${className} rounded-lg border border-border bg-accent/50 flex items-center justify-center text-muted-foreground text-sm`}>
        {error}
      </div>
    );
  }

  return <div ref={mapContainer} className={`${className} rounded-lg overflow-hidden`} />;
};

export { MapboxMap, MAPBOX_TOKEN };
export default MapboxMap;
