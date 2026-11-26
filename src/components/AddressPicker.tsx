import { useEffect, useRef, useState } from "react";
import { searchAddress, AddressSearchError, MIN_QUERY_LENGTH, type AddressResult } from "@/lib/address-search";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Map, Loader2, Crosshair, Check, Search } from "lucide-react";
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

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AddressResult[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const runSearch = async () => {
    if (searching) return;
    setSearchError("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const found = await searchAddress(query, controller.signal);
      setResults(found);
      if (found.length === 0) setSearchError("Aucune adresse trouvée. Placez le repère sur le plan.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setSearchError(e instanceof AddressSearchError ? e.message : "La recherche est indisponible.");
    } finally { if (abortRef.current === controller) setSearching(false); }
  };

  const pickResult = (r: AddressResult) => {
    const point: [number, number] = [r.longitude, r.latitude];
    const text = addressText.trim() ? addressText : r.label.split(",").slice(0, 3).join(",");
    setAddressText(text);
    setCoordinates(point);
    setAccuracy(null);
    setError("");
    setResults(null);
    setShowMap(true);
    notify(point, text);
  };

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
    <div className="space-y-2">
      <Label htmlFor="address-search" className="text-xs">Rechercher une adresse à Marrakech</Label>
      <div className="flex gap-2">
        <Input id="address-search" value={query} onChange={e => setQuery(e.target.value)} enterKeyHint="search" autoComplete="off"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void runSearch(); } }} placeholder="Ex. Avenue Mohammed VI, Guéliz" />
        <Button type="button" variant="outline" onClick={() => void runSearch()} disabled={searching || query.trim().length < MIN_QUERY_LENGTH} className="min-h-10 shrink-0 gap-2" aria-label="Rechercher l’adresse">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="hidden sm:inline">Rechercher</span>
        </Button>
      </div>
      {searchError && <p role="alert" className="text-sm text-destructive">{searchError}</p>}
      {results && results.length > 0 && <ul className="divide-y divide-border rounded-md border border-border" aria-label="Résultats de recherche">
        {results.map(r => <li key={`${r.latitude},${r.longitude}`}><button type="button" onClick={() => pickResult(r)} className="w-full min-h-11 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">{r.label}</button></li>)}
      </ul>}
      <p className="text-[11px] text-muted-foreground">Recherche © contributeurs OpenStreetMap. Vérifiez puis ajustez le repère sur le plan.</p>
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
