import type { Json } from "@/integrations/supabase/types";
import { useState, useEffect, useRef } from "react";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, MapPin, Clock, Store, Phone, Mail, MessageCircle, Coins } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DAY_LABELS, parseWeeklyHours, type DayHours, type WeeklyHours } from "@/lib/store-hours";
import OpenStreetMap from "@/components/OpenStreetMap";
import L from "leaflet";
import { addMapMarker, mapPoint } from "@/lib/open-map";

interface AppSetting {
  id: string;
  key: string;
  value: Json;
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
    store_opening_hour: "10:00",
    store_closing_hour: "20:00",
  });
  const [week, setWeek] = useState<WeeklyHours>(() => parseWeeklyHours(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("app_settings").select("*");
    if (data) {
      const map: Record<string, string> = { ...settings };
      data.forEach((s: AppSetting) => { map[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value); });
      setSettings(map);
      setWeek(parseWeeklyHours(map.weekly_hours, map.store_opening_hour?.replace(/"/g, ""), map.store_closing_hour?.replace(/"/g, "")));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const open = week.filter((d) => !d.closed);
      const all: Record<string, string> = {
        ...settings,
        weekly_hours: JSON.stringify(week),
        // Compatibilité : résumé simple pour les anciens écrans
        store_opening_hour: open.length ? open.map((d) => d.open).sort()[0] : settings.store_opening_hour,
        store_closing_hour: open.length ? open.map((d) => d.close).sort().slice(-1)[0] : settings.store_closing_hour,
      };
      for (const [key, value] of Object.entries(all)) {
        await supabase.from("app_settings").upsert({ key, value: value as Json }, { onConflict: "key" });
      }
      toast({ title: "Paramètres enregistrés" });
    } catch (e) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (i: number, patch: Partial<DayHours>) => setWeek((w) => w.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const copyToAll = (i: number) => setWeek((w) => w.map(() => ({ ...w[i] })));

  const updateSetting = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
    const lat = parseFloat(settings.store_latitude) || 31.589;
    const lng = parseFloat(settings.store_longitude) || -8.019;
    placeMarker([lng, lat], map);
    map.flyTo([lat, lng], 15);
  };

  const placeMarker = (coords: [number, number], map?: L.Map) => {
    const m = map || mapRef.current;
    if (!m) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = addMapMarker(m, coords);
  };

  const handleMapClick = (lngLat: { lng: number; lat: number }) => {
    updateSetting("store_latitude", lngLat.lat.toFixed(6));
    updateSetting("store_longitude", lngLat.lng.toFixed(6));
    placeMarker([lngLat.lng, lngLat.lat]);
  };

  const fields = [
    { key: "store_name", label: "Nom du magasin", icon: Store, placeholder: "Chez Mima" },
    { key: "store_phone", label: "Téléphone", icon: Phone, placeholder: "05 24 00 00 00", type: "tel" },
    { key: "whatsapp_number", label: "Numéro WhatsApp", icon: MessageCircle, placeholder: "06 00 00 00 00", type: "tel" },
    { key: "store_email", label: "E-mail", icon: Mail, placeholder: "contact@chezmima.ma", type: "email" },
    { key: "currency", label: "Devise", icon: Coins, placeholder: "MAD" },
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Informations du magasin</CardTitle>
          <p className="text-sm text-muted-foreground">Coordonnées affichées aux clients et utilisées pour les contacter.</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><f.icon className="h-4 w-4 text-muted-foreground" />{f.label}</Label>
              <Input type={f.type || "text"} placeholder={f.placeholder} value={settings[f.key] || ""} onChange={(e) => updateSetting(f.key, e.target.value)} />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted-foreground" />Adresse</Label>
            <Input placeholder="Rue, quartier, ville" value={settings.store_address || ""} onChange={(e) => updateSetting("store_address", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horaires de prise de commande</CardTitle>
          <p className="text-sm text-muted-foreground">Réglez chaque jour librement, heure du Maroc. En dehors de ces horaires ou pendant une pause, la commande est programmée à la prochaine ouverture.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {week.map((d, i) => (
            <div key={DAY_LABELS[i]} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{DAY_LABELS[i]}</span>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => copyToAll(i)}>Copier sur tous les jours</Button>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={!d.closed} onCheckedChange={(v) => updateDay(i, { closed: !v })} />
                    {d.closed ? "Fermé" : "Ouvert"}
                  </label>
                </div>
              </div>
              {!d.closed && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div><Label className="text-xs">Ouverture</Label><Input type="time" value={d.open} onChange={(e) => updateDay(i, { open: e.target.value })} /></div>
                  <div><Label className="text-xs">Fermeture</Label><Input type="time" value={d.close} onChange={(e) => updateDay(i, { close: e.target.value })} /></div>
                  <div><Label className="text-xs">Début de pause (facultatif)</Label><Input type="time" value={d.breakStart} onChange={(e) => updateDay(i, { breakStart: e.target.value })} /></div>
                  <div><Label className="text-xs">Fin de pause</Label><Input type="time" value={d.breakEnd} onChange={(e) => updateDay(i, { breakEnd: e.target.value })} /></div>
                </div>
              )}
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
          <OpenStreetMap
            className="w-full h-72"
            center={[parseFloat(settings.store_longitude) || -8.019, parseFloat(settings.store_latitude) || 31.589]}
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
