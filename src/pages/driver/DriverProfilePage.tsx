import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Bike, Car, Truck, Star, Phone, Mail, LogOut, Loader2 } from "lucide-react";

const DriverProfilePage = () => {
  const navigate = useNavigate();
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [dpRes, profRes] = await Promise.all([
      supabase.from("driver_profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("profiles").select("name, email, phone").eq("id", user.id).single(),
    ]);

    if (dpRes.data) setDriverProfile(dpRes.data);
    if (profRes.data) setProfile(profRes.data);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
    toast({ title: "Déconnexion réussie" });
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "car": return <Car className="h-6 w-6" />;
      case "truck": return <Truck className="h-6 w-6" />;
      default: return <Bike className="h-6 w-6" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile Header */}
      <div className="text-center py-6">
        <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
          {getVehicleIcon(driverProfile?.vehicle_type || "moto")}
        </div>
        <h1 className="text-xl font-bold">{profile?.name}</h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-medium">{driverProfile?.rating?.toFixed(1) || "4.5"}</span>
          <span className="text-muted-foreground">• {driverProfile?.total_deliveries || 0} livraisons</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-purple-500">{driverProfile?.total_deliveries || 0}</p>
            <p className="text-xs text-muted-foreground">Livraisons totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{driverProfile?.rating?.toFixed(1) || "4.5"}</p>
            <p className="text-xs text-muted-foreground">Note moyenne</p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Véhicule</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            {getVehicleIcon(driverProfile?.vehicle_type || "moto")}
            <span className="capitalize font-medium">{driverProfile?.vehicle_type}</span>
          </div>
          {driverProfile?.license_plate && (
            <Badge variant="secondary">{driverProfile.license_plate}</Badge>
          )}
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{profile?.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{profile?.phone || "Non renseigné"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Se déconnecter
      </Button>
    </div>
  );
};

export default DriverProfilePage;
