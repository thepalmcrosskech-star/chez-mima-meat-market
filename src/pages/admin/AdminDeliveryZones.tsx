import { useState, useEffect, useRef, useCallback } from "react";
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
import MapboxMap, { MAPBOX_TOKEN } from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";

interface Zone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  free_delivery_threshold: number | null;
  color: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  polygon: any;
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
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const overviewMapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => { fetchZones(); }, []);

  const fetchZones = async () => {
    const { data } = await supabase.from("delivery_zones").select("*").order("sort_order");
    if (data) setZones(data as Zone[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName(""); setDeliveryFee(""); setMinimumOrder(""); setFreeThreshold("");
    setColor("#D3111A"); setIsActive(true); setEditing(null); setPolygonPoints([]); setIsDrawing(false);
    clearDrawingMarkers();
  };

  const clearDrawingMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  const openEdit = (z: Zone) => {
    setEditing(z); setName(z.name); setDeliveryFee(String(z.delivery_fee));
    setMinimumOrder(String(z.minimum_order)); setFreeThreshold(z.free_delivery_threshold ? String(z.free_delivery_threshold) : "");
    setColor(z.color || "#D3111A"); setIsActive(z.is_active ?? true);
    // Load existing polygon points
    const coords = z.polygon?.coordinates?.[0] || [];
    setPolygonPoints(coords.length > 0 ? coords.slice(0, -1) : []); // Remove closing point
    setIsDialogOpen(true);
  };

  const handleMapClick = useCallback((lngLat: { lng: number; lat: number }) => {
    if (!isDrawing) return;
    const point: [number, number] = [lngLat.lng, lngLat.lat];
    setPolygonPoints((prev) => [...prev, point]);
  }, [isDrawing]);

  // Draw polygon on map when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear markers
    clearDrawingMarkers();

    // Add markers for each point
    polygonPoints.forEach((pt, i) => {
      const el = document.createElement("div");
      el.className = "w-3 h-3 rounded-full border-2 border-white cursor-pointer";
      el.style.backgroundColor = color;
      const marker = new mapboxgl.Marker({ element: el }).setLngLat(pt).addTo(map);
      markersRef.current.push(marker);
    });

    // Draw polygon
    if (map.getSource("draw-polygon")) {
      (map.getSource("draw-polygon") as mapboxgl.GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: polygonPoints.length >= 3 ? [[...polygonPoints, polygonPoints[0]]] : [],
        },
      });
    }

    // Draw lines
    if (map.getSource("draw-lines")) {
      (map.getSource("draw-lines") as mapboxgl.GeoJSONSource).setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: polygonPoints.length >= 2 ? polygonPoints : [],
        },
      });
    }
  }, [polygonPoints, color]);

  const handleDrawMapReady = (map: mapboxgl.Map) => {
    mapRef.current = map;

    map.addSource("draw-polygon", {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [] } },
    });
    map.addLayer({
      id: "draw-polygon-fill",
      type: "fill",
      source: "draw-polygon",
      paint: { "fill-color": color, "fill-opacity": 0.2 },
    });
    map.addLayer({
      id: "draw-polygon-outline",
      type: "line",
      source: "draw-polygon",
      paint: { "line-color": color, "line-width": 2 },
    });
    map.addSource("draw-lines", {
      type: "geojson",
      data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
    });
    map.addLayer({
      id: "draw-lines-layer",
      type: "line",
      source: "draw-lines",
      paint: { "line-color": color, "line-width": 2, "line-dasharray": [2, 2] },
    });

    // If editing, show existing polygon
    if (polygonPoints.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      polygonPoints.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { padding: 50 });
    }
  };

  const handleOverviewMapReady = (map: mapboxgl.Map) => {
    overviewMapRef.current = map;
    renderZonesOnMap(map, zones);
  };

  const renderZonesOnMap = (map: mapboxgl.Map, zonesList: Zone[]) => {
    zonesList.forEach((zone, i) => {
      const coords = zone.polygon?.coordinates;
      if (!coords || !coords[0] || coords[0].length < 3) return;

      const sourceId = `zone-${zone.id}`;
      if (map.getSource(sourceId)) return;

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { name: zone.name },
          geometry: { type: "Polygon", coordinates: coords },
        },
      });
      map.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": zone.color || "#D3111A", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: { "line-color": zone.color || "#D3111A", "line-width": 2 },
      });
    });

    // Fit bounds to all zones
    const allCoords: [number, number][] = [];
    zonesList.forEach((z) => {
      const coords = z.polygon?.coordinates?.[0];
      if (coords) coords.forEach((c: [number, number]) => allCoords.push(c));
    });
    if (allCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      allCoords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 50 });
    }
  };

  const handleSave = async () => {
    if (!name || !deliveryFee || !minimumOrder) {
      toast({ title: "Erreur", description: "Champs requis manquants", variant: "destructive" });
      return;
    }
    if (polygonPoints.length < 3) {
      toast({ title: "Erreur", description: "Dessinez au moins 3 points sur la carte", variant: "destructive" });
      return;
    }

    const closedPolygon = [...polygonPoints, polygonPoints[0]]; // Close the polygon
    const payload = {
      name,
      delivery_fee: parseFloat(deliveryFee),
      minimum_order: parseFloat(minimumOrder),
      free_delivery_threshold: freeThreshold ? parseFloat(freeThreshold) : null,
      color,
      is_active: isActive,
      polygon: { type: "Polygon", coordinates: [closedPolygon] },
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
      setIsDialogOpen(false); resetForm(); fetchZones();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette zone ?")) return;
    const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Zone supprimée" }); fetchZones(); }
  };

  const toggleActive = async (z: Zone) => {
    await supabase.from("delivery_zones").update({ is_active: !z.is_active }).eq("id", z.id);
    fetchZones();
  };

  const undoLastPoint = () => setPolygonPoints((prev) => prev.slice(0, -1));
  const clearPoints = () => { setPolygonPoints([]); clearDrawingMarkers(); };

  const formatPrice = (n: number) => new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zones de livraison</h1>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Modifier" : "Ajouter"} une zone</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Frais de livraison</Label><Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} /></div>
                <div><Label>Commande minimum</Label><Input type="number" value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} /></div>
              </div>
              <div><Label>Livraison gratuite dès</Label><Input type="number" value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} placeholder="Optionnel" /></div>
              <div className="flex items-center gap-3">
                <Label>Couleur</Label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              </div>
              <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Active</Label></div>

              {/* Map for drawing zone */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Dessiner la zone sur la carte</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={isDrawing ? "default" : "secondary"} size="sm" onClick={() => setIsDrawing(!isDrawing)}>
                      {isDrawing ? "Arrêter" : "Dessiner"}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={undoLastPoint} disabled={polygonPoints.length === 0}>Annuler</Button>
                    <Button type="button" variant="secondary" size="sm" onClick={clearPoints} disabled={polygonPoints.length === 0}>Effacer</Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {isDrawing ? "Cliquez sur la carte pour ajouter des points. Minimum 3 points." : "Cliquez sur \"Dessiner\" pour commencer."}
                  {polygonPoints.length > 0 && ` (${polygonPoints.length} point${polygonPoints.length > 1 ? "s" : ""})`}
                </p>
                <MapboxMap
                  className="w-full h-72"
                  onClick={handleMapClick}
                  onMapReady={handleDrawMapReady}
                />
              </div>

              <Button onClick={handleSave} className="w-full">{editing ? "Enregistrer" : "Ajouter"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Map */}
      {zones.some((z) => z.polygon?.coordinates?.[0]?.length > 0) && (
        <Card>
          <CardContent className="pt-4">
            <Label className="mb-2 block">Aperçu des zones</Label>
            <MapboxMap className="w-full h-64" onMapReady={handleOverviewMapReady} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
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
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune zone</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDeliveryZones;
