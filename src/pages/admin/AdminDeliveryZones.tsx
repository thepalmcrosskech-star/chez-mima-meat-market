import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import OpenStreetMap from "@/components/OpenStreetMap";
import L from "leaflet";
import { addMapMarker } from "@/lib/open-map";
import { DELIVERY_AREA } from "@/lib/delivery-area";
import { generateCircleGeoJSON } from "@/lib/geo";
import { formatPrice } from "@/lib/format";

interface Zone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  free_delivery_threshold: number | null;
  color: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  radius_km: number | null;
  min_radius_km: number | null;
}

const AdminDeliveryZones = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [name, setName] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [minimumOrder, setMinimumOrder] = useState("");
  const [freeThreshold, setFreeThreshold] = useState("");
  const [color, setColor] = useState("#D3111A");
  const [isActive, setIsActive] = useState(true);
  const [radiusKm, setRadiusKm] = useState("");
  const [minRadiusKm, setMinRadiusKm] = useState("0");
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number }>({ lat: 31.589, lng: -8.019 });
  const [storeLoaded, setStoreLoaded] = useState(false);
  const overviewMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    const [zonesRes, latRes, lngRes] = await Promise.all([
      supabase.from("delivery_zones").select("*").order("sort_order"),
      supabase.from("app_settings").select("value").eq("key", "store_latitude").single(),
      supabase.from("app_settings").select("value").eq("key", "store_longitude").single(),
    ]);

    const lat = latRes.data ? parseFloat(String(latRes.data.value)) : 31.589;
    const lng = lngRes.data ? parseFloat(String(lngRes.data.value)) : -8.019;
    setStoreLocation({ lat, lng });
    setStoreLoaded(true);

    if (zonesRes.data) setZones(zonesRes.data as Zone[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName(""); setDeliveryFee(""); setMinimumOrder(""); setFreeThreshold("");
    setColor("#D3111A"); setIsActive(true); setEditing(null);
    setRadiusKm(""); setMinRadiusKm("0");
  };

  const openEdit = (z: Zone) => {
    setEditing(z);
    setName(z.name);
    setDeliveryFee(String(z.delivery_fee));
    setMinimumOrder(String(z.minimum_order));
    setFreeThreshold(z.free_delivery_threshold ? String(z.free_delivery_threshold) : "");
    setColor(z.color || "#D3111A");
    setIsActive(z.is_active ?? true);
    setRadiusKm(z.radius_km ? String(z.radius_km) : "");
    setMinRadiusKm(z.min_radius_km ? String(z.min_radius_km) : "0");
    setIsDialogOpen(true);
  };

  const handleOverviewMapReady = (map: L.Map) => {
    overviewMapRef.current = map;
    renderZonesOnMap(map, zones);
  };

  const zoneLayersRef = useRef<L.LayerGroup | null>(null);
  const renderZonesOnMap = (map: L.Map, zonesList: Zone[]) => {
    zoneLayersRef.current?.remove();
    const layers = L.layerGroup().addTo(map);
    zoneLayersRef.current = layers;
    const coverage = L.polygon(DELIVERY_AREA, { color: "hsl(var(--success))", weight: 2, fillOpacity: 0.08, interactive: false }).addTo(layers);
    addMapMarker(map, [storeLocation.lng, storeLocation.lat], { color: "hsl(var(--success))" }).addTo(layers);
    zonesList.forEach((zone) => {
      if (!zone.radius_km) return;
      L.geoJSON(generateCircleGeoJSON(storeLocation.lng, storeLocation.lat, zone.radius_km), {
        style: { color: zone.color || "hsl(var(--primary))", weight: 2, fillOpacity: 0.15 },
      }).addTo(layers);
      const label = document.createElement("div");
      label.className = "open-map-zone-label";
      label.textContent = zone.name;
      if (zone.color) label.style.setProperty("--pin-color", zone.color);
      addMapMarker(map, [storeLocation.lng, storeLocation.lat + zone.radius_km / 110.574], { element: label, popup: zone.name }).addTo(layers);
    });
    map.fitBounds(coverage.getBounds(), { padding: [30, 30] });
  };

  useEffect(() => {
    if (overviewMapRef.current) renderZonesOnMap(overviewMapRef.current, zones);
  }, [zones, storeLocation]);

  const handleSave = async () => {
    if (!name || !deliveryFee || !minimumOrder || !radiusKm) {
      toast({ title: "Erreur", description: "Champs requis manquants", variant: "destructive" });
      return;
    }

    const rKm = parseFloat(radiusKm);
    const minRKm = parseFloat(minRadiusKm) || 0;

    if (rKm <= 0) {
      toast({ title: "Erreur", description: "Le rayon doit être supérieur à 0", variant: "destructive" });
      return;
    }
    if (minRKm >= rKm) {
      toast({ title: "Erreur", description: "Le rayon min doit être inférieur au rayon max", variant: "destructive" });
      return;
    }

    const payload = {
      name,
      delivery_fee: parseFloat(deliveryFee),
      minimum_order: parseFloat(minimumOrder),
      free_delivery_threshold: freeThreshold ? parseFloat(freeThreshold) : null,
      color,
      is_active: isActive,
      radius_km: rKm,
      min_radius_km: minRKm,
      polygon: null, // No longer using polygons
    };

    try {
      if (editing) {
        const { error } = await supabase.from("delivery_zones").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Zone mise à jour" });
      } else {
        const { error } = await supabase.from("delivery_zones").insert(payload);
        if (error) throw error;
        toast({ title: "Zone ajoutée" });
      }
      setIsDialogOpen(false); resetForm(); initData();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette zone ?")) return;
    const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Zone supprimée" }); initData(); }
  };

  const toggleActive = async (z: Zone) => {
    await supabase.from("delivery_zones").update({ is_active: !z.is_active }).eq("id", z.id);
    initData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zones de livraison</h1>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Modifier" : "Ajouter"} une zone</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Zone Centre" /></div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rayon min (km)</Label>
                  <Input type="number" step="0.1" min="0" value={minRadiusKm} onChange={(e) => setMinRadiusKm(e.target.value)} placeholder="0" />
                  <p className="text-xs text-muted-foreground mt-1">Distance minimale depuis le magasin</p>
                </div>
                <div>
                  <Label>Rayon max (km) *</Label>
                  <Input type="number" step="0.1" min="0.1" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} placeholder="5" />
                  <p className="text-xs text-muted-foreground mt-1">Distance maximale depuis le magasin</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><Label>Frais de livraison (MAD)</Label><Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} /></div>
                <div><Label>Commande minimum (MAD)</Label><Input type="number" value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} /></div>
              </div>
              <div><Label>Livraison gratuite dès (MAD)</Label><Input type="number" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} placeholder="Optionnel" /></div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Couleur</Label>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                </div>
                <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Active</Label></div>
              </div>

              {/* Preview circle */}
              {radiusKm && parseFloat(radiusKm) > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Zone couvrant de <strong>{minRadiusKm || "0"} km</strong> à <strong>{radiusKm} km</strong> autour du magasin
                  </p>
                </div>
              )}

              <Button onClick={handleSave} className="w-full">{editing ? "Enregistrer" : "Ajouter"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Map with circles */}
      {storeLoaded && (
        <Card>
          <CardContent className="pt-4">
            <Label className="mb-2 block flex items-center gap-2"><MapPin className="h-4 w-4" /> Couverture Glovo et zones tarifaires</Label>
            <OpenStreetMap
              className="w-full h-72"
              center={[storeLocation.lng, storeLocation.lat]}
              zoom={11}
              onMapReady={handleOverviewMapReady}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Rayon</TableHead>
                <TableHead>Frais</TableHead>
                <TableHead>Min. commande</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z) => (
                <TableRow key={z.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color || "#D3111A" }} />
                      <span className="font-medium">{z.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {z.min_radius_km || 0} – {z.radius_km || "?"} km
                    </span>
                  </TableCell>
                  <TableCell>{formatPrice(z.delivery_fee)}</TableCell>
                  <TableCell>{formatPrice(z.minimum_order)}</TableCell>
                  <TableCell>
                    <Badge variant={z.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleActive(z)}>
                      {z.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(z)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(z.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {zones.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune zone</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDeliveryZones;
