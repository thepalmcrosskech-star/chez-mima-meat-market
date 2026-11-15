import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Users, Bike, Car, Truck, Plus, Pencil, Trash2, Star, LogOut } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

interface DriverProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string | null;
  status: string;
  rating: number | null;
  total_deliveries: number | null;
  profiles?: Profile;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [vehicleType, setVehicleType] = useState("moto");
  const [licensePlate, setLicensePlate] = useState("");

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        toast({ title: "Accès refusé", description: "Vous n'êtes pas administrateur", variant: "destructive" });
        navigate("/");
        return;
      }

      await fetchData();
    } catch (error) {
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    const [driversRes, usersRes] = await Promise.all([
      supabase.from("driver_profiles").select("*, profiles(*)"),
      supabase.from("profiles").select("*").eq("role", "user")
    ]);

    if (driversRes.data) setDrivers(driversRes.data as DriverProfile[]);
    if (usersRes.data) setUsers(usersRes.data);
  };

  const addDriver = async () => {
    if (!selectedUserId) return;

    try {
      // Create driver profile
      const { error: driverError } = await supabase.from("driver_profiles").insert({
        user_id: selectedUserId,
        vehicle_type: vehicleType,
        license_plate: licensePlate || null,
        status: "offline"
      });

      if (driverError) throw driverError;

      // Update user role
      const { error: roleError } = await supabase.rpc("set_profile_role_as_admin", {
        _target_user_id: selectedUserId,
        _new_role: "driver",
      });

      if (roleError) throw roleError;

      toast({ title: "Succès", description: "Livreur ajouté avec succès" });
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const updateDriver = async () => {
    if (!selectedDriver) return;

    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          vehicle_type: vehicleType,
          license_plate: licensePlate || null
        })
        .eq("id", selectedDriver.id);

      if (error) throw error;

      toast({ title: "Succès", description: "Livreur mis à jour" });
      setIsEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const deleteDriver = async (driver: DriverProfile) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce livreur ?")) return;

    try {
      // Delete driver profile
      const { error: deleteError } = await supabase
        .from("driver_profiles")
        .delete()
        .eq("id", driver.id);

      if (deleteError) throw deleteError;

      // Reset user role
      const { error: roleError } = await supabase.rpc("set_profile_role_as_admin", {
        _target_user_id: driver.user_id,
        _new_role: "user",
      });

      if (roleError) throw roleError;

      toast({ title: "Succès", description: "Livreur supprimé" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (driver: DriverProfile) => {
    setSelectedDriver(driver);
    setVehicleType(driver.vehicle_type);
    setLicensePlate(driver.license_plate || "");
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedUserId("");
    setVehicleType("moto");
    setLicensePlate("");
    setSelectedDriver(null);
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "moto": return <Bike className="h-4 w-4" />;
      case "car": return <Car className="h-4 w-4" />;
      case "truck": return <Truck className="h-4 w-4" />;
      default: return <Bike className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      available: "default",
      busy: "secondary",
      offline: "destructive"
    };
    const labels: Record<string, string> = {
      available: "Disponible",
      busy: "En livraison",
      offline: "Hors ligne"
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-hero text-primary-foreground p-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/20">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold">Panel Admin</h1>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login");
            }} 
            className="text-primary-foreground hover:bg-white/20 gap-2"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
        <p className="text-white/80">Gestion des livreurs et paramètres</p>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-6">
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-lg animate-slide-up">
            <CardContent className="pt-4 text-center">
              <Users className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{drivers.length}</p>
              <p className="text-xs text-muted-foreground">Livreurs</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <CardContent className="pt-4 text-center">
              <Bike className="h-6 w-6 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold">{drivers.filter(d => d.status === "available").length}</p>
              <p className="text-xs text-muted-foreground">Disponibles</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <CardContent className="pt-4 text-center">
              <Star className="h-6 w-6 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold">
                {(drivers.reduce((acc, d) => acc + (d.rating || 0), 0) / (drivers.length || 1)).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">Note moy.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drivers List */}
      <div className="px-4 mt-6">
        <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Liste des livreurs</CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un livreur</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Utilisateur</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un utilisateur" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type de véhicule</Label>
                    <Select value={vehicleType} onValueChange={setVehicleType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moto">Moto</SelectItem>
                        <SelectItem value="car">Voiture</SelectItem>
                        <SelectItem value="truck">Camion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plaque d'immatriculation</Label>
                    <Input value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="AB-123-CD" />
                  </div>
                  <Button onClick={addDriver} className="w-full">Ajouter le livreur</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Véhicule</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map(driver => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{driver.profiles?.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getVehicleIcon(driver.vehicle_type)}
                          <span className="capitalize">{driver.vehicle_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(driver.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {driver.rating?.toFixed(1) || "4.5"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(driver)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteDriver(driver)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {drivers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Aucun livreur pour le moment
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le livreur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Type de véhicule</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="car">Voiture</SelectItem>
                  <SelectItem value="truck">Camion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plaque d'immatriculation</Label>
              <Input value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="AB-123-CD" />
            </div>
            <Button onClick={updateDriver} className="w-full">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
