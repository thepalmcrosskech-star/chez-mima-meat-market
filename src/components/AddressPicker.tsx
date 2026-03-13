import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Search, Loader2, Crosshair } from "lucide-react";
import MapboxMap, { getMapboxToken } from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";

interface AddressPickerProps {
  onSelect: (address: { full_address: string; latitude: number; longitude: number }) => void;
  defaultValue?: { latitude: number; longitude: number; full_address: string };
}

const AddressPicker = ({ onSelect, defaultValue }: AddressPickerProps) => {
  const [query, setQuery] = useState(defaultValue?.full_address || "");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(
    defaultValue ? [defaultValue.longitude, defaultValue.latitude] : null
  );
  const [locating, setLocating] = useState(false);
  const [token, setToken] = useState("");
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getMapboxToken().then(setToken);
  }, []);

  const searchAddress = async (text: string) => {
    if (text.length < 3 || !token) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${token}&country=ma&language=fr&limit=5`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(value), 400);
  };

  const selectSuggestion = (feature: any) => {
    const [lng, lat] = feature.center;
    setQuery(feature.place_name);
    setSelectedCoords([lng, lat]);
    setSuggestions([]);
    onSelect({ full_address: feature.place_name, latitude: lat, longitude: lng });
    updateMarker([lng, lat]);
  };

  const handleMapClick = (lngLat: { lng: number; lat: number }) => {
    setSelectedCoords([lngLat.lng, lngLat.lat]);
    updateMarker([lngLat.lng, lngLat.lat]);
    // Always notify parent with coordinates immediately
    const fallbackAddress = `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
    onSelect({ full_address: fallbackAddress, latitude: lngLat.lat, longitude: lngLat.lng });
    // Then try to get a proper address name
    reverseGeocode(lngLat.lng, lngLat.lat);
  };

  const reverseGeocode = async (lng: number, lat: number) => {
    if (!token) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=fr&limit=1`
      );
      const data = await res.json();
      const placeName = data.features?.[0]?.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setQuery(placeName);
      onSelect({ full_address: placeName, latitude: lat, longitude: lng });
    } catch {
      onSelect({ full_address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, latitude: lat, longitude: lng });
    }
  };

  const updateMarker = (coords: [number, number]) => {
    if (markerRef.current) markerRef.current.remove();
    if (mapRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: "#D3111A" }).setLngLat(coords).addTo(mapRef.current);
      mapRef.current.flyTo({ center: coords, zoom: 15 });
    }
  };

  const handleMapReady = (map: mapboxgl.Map) => {
    mapRef.current = map;
    if (selectedCoords) {
      updateMarker(selectedCoords);
      map.flyTo({ center: selectedCoords, zoom: 15 });
    }
  };

  const geolocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setSelectedCoords(coords);
        updateMarker(coords);
        reverseGeocode(coords[0], coords[1]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4" /> Adresse</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Rechercher une adresse..."
            className="pl-10 pr-10"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {suggestions.length > 0 && (
          <div className="mt-1 border border-border rounded-lg bg-popover overflow-hidden shadow-lg z-50 relative">
            {suggestions.map((s: any) => (
              <button
                key={s.id}
                onClick={() => selectSuggestion(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{s.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={geolocate} disabled={locating} className="gap-2">
          <Crosshair className="h-4 w-4" />
          {locating ? "Localisation..." : "Ma position"}
        </Button>
      </div>

      <MapboxMap className="w-full h-48" onClick={handleMapClick} onMapReady={handleMapReady} />

      {selectedCoords && (
        <p className="text-xs text-muted-foreground">
          📍 {selectedCoords[1].toFixed(5)}, {selectedCoords[0].toFixed(5)}
        </p>
      )}
    </div>
  );
};

export default AddressPicker;
