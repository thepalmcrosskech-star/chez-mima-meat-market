import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Map, Loader2, Crosshair, Check } from "lucide-react";
import DeliveryLocationMap from "@/components/DeliveryLocationMap";

interface AddressPickerProps {
  onSelect: (address: { full_address: string; latitude: number; longitude: number }) => void;
  defaultValue?: { latitude: number; longitude: number; full_address: string };
}

const AddressPicker = ({ onSelect, defaultValue }: AddressPickerProps) => {
  const [addressText, setAddressText] = useState(defaultValue?.full_address || "");
  const [coordinates, setCoordinates] = useState<[number, number] | null>(
    defaultValue ? [defaultValue.longitude, defaultValue.latitude] : null
  );
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const notify = (point: [number, number], text: string) => {
    onSelect({
      full_address: text.trim() || `Position GPS : ${point[1].toFixed(5)}, ${point[0].toFixed(5)}`,
      latitude: point[1], longitude: point[0],
    });
  };

  const selectPoint = (point: [number, number]) => {
    setCoordinates(point);
    setError("");
    setAccuracy(null);
    notify(point, addressText);
  };

  const geolocate = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("La localisation n’est pas disponible sur cet appareil. Vous pouvez choisir votre position sur le plan.");
      setShowMap(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: [number, number] = [position.coords.longitude, position.coords.latitude];
        selectPoint(point);
        setAccuracy(position.coords.accuracy);
        setShowMap(true);
        setLocating(false);
      },
      (failure) => {
        setError(failure.code === 1
          ? "La localisation est refusée. Autorisez-la dans votre navigateur ou choisissez votre position sur le plan."
          : "Votre position n’a pas pu être trouvée. Réessayez ou choisissez votre position sur le plan.");
        setShowMap(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <Button type="button" onClick={geolocate} disabled={locating} className="gap-2 h-auto min-h-12 py-3 whitespace-normal">
        {locating ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Crosshair className="h-5 w-5 shrink-0" />}
        {locating ? "Localisation en cours…" : "Autoriser et me localiser"}
      </Button>
      <Button type="button" variant="outline" aria-expanded={showMap} onClick={() => setShowMap(!showMap)} className="gap-2 h-auto min-h-12 py-3 whitespace-normal">
        <Map className="h-5 w-5 shrink-0" />
        {showMap ? "Masquer le plan" : "Choisir sur le plan"}
      </Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {showMap && <DeliveryLocationMap coordinates={coordinates} onSelect={selectPoint} />}
    {coordinates && <p role="status" className="flex items-start gap-2 text-sm text-success">
      <Check className="h-4 w-4 mt-0.5 shrink-0" />
      <span>Position sélectionnée{accuracy !== null ? ` · précision estimée : ${Math.round(accuracy)} m` : ""}</span>
    </p>}
    <div>
      <Label htmlFor="delivery-residence" className="flex items-center gap-2 mb-1 text-xs">
        <MapPin className="h-4 w-4" /> Quartier / Résidence / Rue
      </Label>
      <Input id="delivery-residence" value={addressText} onChange={event => {
        setAddressText(event.target.value);
        if (coordinates) notify(coordinates, event.target.value);
      }} placeholder="Ex. Guéliz, résidence Les Palmiers" />
    </div>
  </div>;
};

export default AddressPicker;
