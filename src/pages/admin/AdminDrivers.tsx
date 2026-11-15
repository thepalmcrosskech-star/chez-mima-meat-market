import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Bike, Car, Truck, Star, Users, TrendingUp, MapPin } from "lucide-react";
import MapboxMap from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";

interface Profile { id: string; name: string; email: string; phone: string | null; role: string; }
interface DriverProfile {
  id: string; user_id: string; vehicle_type: string; license_plate: string | null;
  status: string; rating: number | null; total_deliveries: number | null;
  latitude: number | null; longitude: number | null;
  profiles?: Profile;
}

const AdminDrivers = () => {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selected, setSelected] = useState<DriverProfile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [vehicleType, setVehicleType] = useState("moto");
  const [licensePlate, setLicensePlate] = useState("");
  const [showMap, setShowMap] = useState(false);
  const markersRef = useState<mapboxgl.Marker[]>([])[0];

  useEffect(() => { fetchData(); }, []);

  // Realtime driver locations
  useEffect(() => {
    const channel = supabase
      .channel("admin-driver-locations")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "driver_locations",
      }, () => {
        // Refresh driver data on location update
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const [d, u] = await Promise.all([
      supabase.from("driver_profiles").select("*, profiles(*)"),
      supabase.from("profiles").select("*").eq("role", "user"),
    ]);
    if (d.data) setDrivers(d.data as DriverProfile[]);
    if (u.data) setUsers(u.data);
    setLoading(false);
  };

  const resetForm = () => { setSelectedUserId(""); setVehicleType("moto"); setLicensePlate(""); setSelected(null); };

  const addDriver = async () => {
    if (!selectedUserId) return;
    try {
      const { error: e1 } = await supabase.from("driver_profiles").insert({ user_id: selectedUserId, vehicle_type: vehicleType, license_plate: licensePlate || null, status: "offline" });
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc("set_profile_role_as_admin", {
        _target_user_id: selectedUserId,
        _new_role: "driver",
      });
      if (e2) throw e2;
      toast({ title: "Livreur ajouté" }); setIsAddOpen(false); resetForm(); fetchData();
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  };

  const updateDriver = async () => {
    if (!selected) return;
    try {
      const { error } = await supabase.from("driver_profiles").update({ vehicle_type: vehicleType, license_plate: licensePlate || null }).eq("id", selected.id);
      if (error) throw error;
      toast({ title: "Livreur mis à jour" }); setIsEditOpen(false); resetForm(); fetchData();
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  };

  const deleteDriver = async (d: DriverProfile) => {
    if (!confirm("Supprimer ce livreur ?")) return;
    try {
      const { error: e1 } = await supabase.from("driver_profiles").delete().eq("id", d.id);
      if (e1) throw e1;
      const { error: roleError } = await supabase.rpc("set_profile_role_as_admin", {
        _target_user_id: d.user_id,
        _new_role: "user",
      });
      if (roleError) throw roleError;
      toast({ title: "Livreur supprimé" }); fetchData();
    } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
  };

  const openEdit = (d: DriverProfile) => {
    setSelected(d); setVehicleType(d.vehicle_type); setLicensePlate(d.license_plate || ""); setIsEditOpen(true);
  };

  const vehicleIcon = (t: string) => {
    if (t === "car") return <Car className="h-4 w-4" />;
    if (t === "truck") return <Truck className="h-4 w-4" />;
    return <Bike className="h-4 w-4" />;
  };

  const statusBadge = (s: string) => {
    const v: Record<string, "default" | "secondary" | "destructive"> = { available: "default", busy: "secondary", offline: "destructive" };
    const l: Record<string, string> = { available: "Disponible", busy: "En livraison", offline: "Hors ligne" };
    return <Badge variant={v[s] || "secondary"}>{l[s] || s}</Badge>;
  };

  const handleMapReady = (map: mapboxgl.Map) => {
    // Add markers for active drivers
    drivers.forEach((d) => {
      if (d.latitude && d.longitude && d.status !== "offline") {
        const color = d.status === "available" ? "#A855F7" : "#EF4444";
        const marker = new mapboxgl.Marker({ color })
          .setLngLat([Number(d.longitude), Number(d.latitude)])
          .setPopup(new mapboxgl.Popup().setHTML(`<b>${d.profiles?.name || "Livreur"}</b><br/>${d.status === "available" ? "Disponible" : "En livraison"}`))
          .addTo(map);
        markersRef.push(marker);
      }
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  const activeCount = drivers.filter(d => d.status === "available").length;
  const busyCount = drivers.filter(d => d.status === "busy").length;
  const totalDeliveries = drivers.reduce((sum, d) => sum + (d.total_deliveries || 0), 0);

  const VehicleForm = () => (
    <>
      <div>
        <Label>Type de véhicule</Label>
        <Select value={vehicleType} onValueChange={setVehicleType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="moto">Moto</SelectItem>
            <SelectItem value="car">Voiture</SelectItem>
            <SelectItem value="truck">Camion</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Plaque d'immatriculation</Label>
        <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} placeholder="AB-123-CD" />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Livreurs</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMap(!showMap)}>
            <MapPin className="h-4 w-4 mr-1" /> {showMap ? "Masquer" : "Carte"}
          </Button>
          <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter un livreur</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Utilisateur</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <VehicleForm />
                <Button onClick={addDriver} className="w-full">Ajouter</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Disponibles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Bike className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{busyCount}</p>
              <p className="text-xs text-muted-foreground">En livraison</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDeliveries}</p>
              <p className="text-xs text-muted-foreground">Total livraisons</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{drivers.length}</p>
              <p className="text-xs text-muted-foreground">Total livreurs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Realtime Map */}
      {showMap && (
        <Card className="overflow-hidden">
          <MapboxMap
            className="w-full h-[300px]"
            center={[-8.0083, 31.6295]}
            zoom={12}
            interactive={true}
            onMapReady={handleMapReady}
          />
        </Card>
      )}

      {/* Drivers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Livraisons</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div><p className="font-medium">{d.profiles?.name}</p><p className="text-xs text-muted-foreground">{d.profiles?.email}</p></div>
                  </TableCell>
                  <TableCell><div className="flex items-center gap-2">{vehicleIcon(d.vehicle_type)}<span className="capitalize">{d.vehicle_type}</span></div></TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell><div className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{d.rating?.toFixed(1) || "4.5"}</div></TableCell>
                  <TableCell>{d.total_deliveries || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDriver(d)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {drivers.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun livreur</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le livreur</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <VehicleForm />
            <Button onClick={updateDriver} className="w-full">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDrivers;
