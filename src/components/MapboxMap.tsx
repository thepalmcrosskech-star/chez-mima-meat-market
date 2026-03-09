import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";

let _cachedToken: string | null = null;

async function getMapboxToken(): Promise<string> {
  if (_cachedToken) return _cachedToken;
  // Try env first
  const envToken = import.meta.env.VITE_MAPBOX_TOKEN;
  if (envToken) { _cachedToken = envToken; return envToken; }
  // Fetch from edge function
  try {
    const { data } = await supabase.functions.invoke("get-mapbox-token");
    if (data?.token) { _cachedToken = data.token; return data.token; }
  } catch {}
  return "";
}

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getMapboxToken();
      if (cancelled) return;
      if (!token) { setError("Token Mapbox non configuré"); return; }
      if (!mapContainer.current) return;

      mapboxgl.accessToken = token;

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
        setReady(true);
        onMapReady?.(map);
      });
    })();

    return () => { cancelled = true; mapRef.current?.remove(); };
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

export { getMapboxToken };
export default MapboxMap;
