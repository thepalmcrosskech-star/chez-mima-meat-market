import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { DELIVERY_AREA } from "@/lib/delivery-area";

interface Props {
  coordinates: [number, number] | null;
  onSelect: (coordinates: [number, number]) => void;
}

export default function DeliveryLocationMap({ coordinates, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const selectRef = useRef(onSelect);
  const [tileError, setTileError] = useState(false);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current).setView([31.63, -8.01], 12);
    mapRef.current = map;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      maxZoom: 19,
    }).addTo(map);
    tiles.on("tileerror", () => setTileError(true));
    const zone = L.polygon(DELIVERY_AREA, { className: "delivery-area-outline", interactive: false }).addTo(map);
    if (!coordinates) map.fitBounds(zone.getBounds(), { padding: [16, 16] });
    map.on("click", (event: L.LeafletMouseEvent) => selectRef.current([event.latlng.lng, event.latlng.lat]));
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coordinates) return;
    const point: L.LatLngTuple = [coordinates[1], coordinates[0]];
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "delivery-location-marker",
        html: '<span class="delivery-location-pin"></span>',
        iconSize: [28, 28], iconAnchor: [14, 28],
      });
      const marker = L.marker(point, { icon, draggable: true, title: "Position de livraison" }).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        selectRef.current([position.lng, position.lat]);
      });
      markerRef.current = marker;
    } else markerRef.current.setLatLng(point);
    map.setView(point, Math.max(map.getZoom(), 16));
  }, [coordinates]);

  return <div className="space-y-2">
    <div ref={container} aria-label="Plan de livraison" className="relative z-0 h-64 w-full rounded-lg border border-border" />
    {tileError && <div role="alert" className="space-y-2 text-sm text-destructive">
      <p>Le fond de carte n’a pas pu être chargé. Votre position reste conservée.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => {
        setTileError(false);
        mapRef.current?.eachLayer(layer => { if (layer instanceof L.TileLayer) layer.redraw(); });
      }}>Réessayer le plan</Button>
    </div>}
  </div>;
}