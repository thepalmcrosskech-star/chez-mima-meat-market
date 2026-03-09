import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Bike, Car, Truck, Star, MapPin, Phone, Clock } from "lucide-react";

interface DriverProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string | null;
  status: string;
  rating: number | null;
  total_deliveries: number | null;
}

interface Profile {
  name: string;
  email: string;
  phone: string | null;
}

const DriverProfilePage = () => {
  const navigate = useNavigate();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDriverProfile();
  }, []);

  const fetchDriverProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const [driverRes, profileRes] = await Promise.all([
        supabase.from("driver_profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("profiles").select("name, email, phone").eq("id", user.id).single()
      ]);

      if (driverRes.error) throw driverRes.error;
      if (profileRes.error) throw profileRes.error;

      setDriverProfile(driverRes.data);
      setProfile(profileRes.data);
    } catch (error: any) {
      toast({ title: "Erreur", description: "Profil livreur introuvable", variant: "destructive" });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!driverProfile) return;
    
    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({ status: newStatus })
        .eq("id", driverProfile.id);

      if (error) throw error;

      setDriverProfile({ ...driverProfile, status: newStatus });
      toast({ title: "Statut mis à jour", description: `Vous êtes maintenant ${newStatus === "available" ? "disponible" : newStatus === "busy" ? "en livraison" : "hors ligne"}` });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "moto": return <Bike className="h-6 w-6" />;
      case "car": return <Car className="h-6 w-6" />;
      case "truck": return <Truck className="h-6 w-6" />;
      default: return <Bike className="h-6 w-6" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-500";
      case "busy": return "bg-amber-500";
      case "offline": return "bg-muted";
      default: return "bg-muted";
    }
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
      <div className="gradient-hero text-primary-foreground p-6 pb-20 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground hover:bg-white/20">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">Mon Profil Livreur</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            {getVehicleIcon(driverProfile?.vehicle_type || "moto")}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{profile?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>{driverProfile?.rating?.toFixed(1) || "4.5"}</span>
              <span className="text-white/70">• {driverProfile?.total_deliveries || 0} livraisons</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="px-4 -mt-12">
        <Card className="shadow-lg animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Statut actuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {["available", "busy", "offline"].map((status) => (
                <Button
                  key={status}
                  variant={driverProfile?.status === status ? "default" : "outline"}
                  className={`flex-1 ${driverProfile?.status === status ? getStatusColor(status) : ""}`}
                  onClick={() => updateStatus(status)}
                >
                  {status === "available" ? "Disponible" : status === "busy" ? "En livraison" : "Hors ligne"}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="px-4 mt-6 space-y-4 pb-24">
        <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {getVehicleIcon(driverProfile?.vehicle_type || "moto")}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Véhicule</p>
                <p className="font-semibold capitalize">{driverProfile?.vehicle_type}</p>
                {driverProfile?.license_plate && (
                  <Badge variant="secondary" className="mt-1">{driverProfile.license_plate}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Téléphone</p>
                <p className="font-semibold">{profile?.phone || "Non renseigné"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-semibold">{profile?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <CardHeader>
            <CardTitle>Mes Statistiques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-xl bg-primary/10">
                <p className="text-3xl font-bold text-primary">{driverProfile?.total_deliveries || 0}</p>
                <p className="text-sm text-muted-foreground">Livraisons</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-amber-500/10">
                <p className="text-3xl font-bold text-amber-600">{driverProfile?.rating?.toFixed(1) || "4.5"}</p>
                <p className="text-sm text-muted-foreground">Note moyenne</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverProfilePage;
