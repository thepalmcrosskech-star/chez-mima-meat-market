import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, MapPin } from "lucide-react";
import MapboxMap from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";

interface AppSetting {
  id: string;
  key: string;
  value: any;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    store_name: "Chez Mima",
    store_phone: "",
    store_email: "",
    store_address: "",
    store_latitude: "31.589020",
    store_longitude: "-8.019172",
    currency: "MAD",
    opening_hours: "",
    whatsapp_number: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("app_settings").select("*");
    if (data) {
      const map: Record<string, string> = { ...settings };
      data.forEach((s: AppSetting) => { map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value); });
      setSettings(map);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await supabase.from("app_settings").upsert({ key, value: value as any }, { onConflict: "key" });
      }
      toast({ title: "Paramètres enregistrés" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const handleMapReady = (map: mapboxgl.Map) => {
    mapRef.current = map;
    const lat = parseFloat(settings.store_latitude) || 33.5731;
    const lng = parseFloat(settings.store_longitude) || -7.5898;
    placeMarker([lng, lat], map);
    map.flyTo({ center: [lng, lat], zoom: 15 });
  };

  const placeMarker = (coords: [number, number], map?: mapboxgl.Map) => {
    const m = map || mapRef.current;
    if (!m) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new mapboxgl.Marker({ color: "#D3111A" }).setLngLat(coords).addTo(m);
  };

  const handleMapClick = (lngLat: { lng: number; lat: number }) => {
    updateSetting("store_latitude", lngLat.lat.toFixed(6));
    updateSetting("store_longitude", lngLat.lng.toFixed(6));
    placeMarker([lngLat.lng, lngLat.lat]);
  };

  const fields = [
    { key: "store_name", label: "Nom du magasin" },
    { key: "store_phone", label: "Téléphone" },
    { key: "store_email", label: "Email" },
    { key: "store_address", label: "Adresse" },
    { key: "currency", label: "Devise" },
    { key: "opening_hours", label: "Horaires d'ouverture" },
    { key: "whatsapp_number", label: "Numéro WhatsApp" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations du magasin</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input value={settings[f.key] || ""} onChange={(e) => updateSetting(f.key, e.target.value)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Localisation de la boutique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Cliquez sur la carte pour placer votre boutique</p>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Latitude</Label><Input value={settings.store_latitude} onChange={(e) => updateSetting("store_latitude", e.target.value)} /></div>
            <div><Label>Longitude</Label><Input value={settings.store_longitude} onChange={(e) => updateSetting("store_longitude", e.target.value)} /></div>
          </div>
          <MapboxMap
            className="w-full h-72"
            center={[parseFloat(settings.store_longitude) || -7.5898, parseFloat(settings.store_latitude) || 33.5731]}
            zoom={15}
            onClick={handleMapClick}
            onMapReady={handleMapReady}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
