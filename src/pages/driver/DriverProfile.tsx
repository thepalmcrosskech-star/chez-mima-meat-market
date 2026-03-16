import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Bike, Car, Truck, Star, MapPin, Phone, Clock, Navigation, Loader2, Package, Banknote, CreditCard } from "lucide-react";
import { formatPrice, getStatusInfo } from "@/lib/format";

interface DriverProfileData {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string | null;
  status: string;
  rating: number | null;
  total_deliveries: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface Profile {
  name: string;
  email: string;
  phone: string | null;
}

interface DriverOrder {
  id: string;
  status: string;
  total_price: number;
  payment_method: string;
  cash_bill_amount: number | null;
  delivery_mode: string;
  notes: string | null;
  created_at: string | null;
  delivery_address_snapshot: any;
  profiles?: { name: string; phone: string | null };
}

const GPS_INTERVAL = 30_000; // 30 seconds

const DriverProfilePage = () => {
  const navigate = useNavigate();
  const [driverProfile, setDriverProfile] = useState<DriverProfileData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<Date | null>(null);
  const [assignedOrders, setAssignedOrders] = useState<DriverOrder[]>([]);
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    fetchDriverProfile();
    return () => stopGpsTracking();
  }, []);

  // Auto-start/stop GPS based on status
  useEffect(() => {
    if (!driverProfile) return;
    const shouldTrack = driverProfile.status === "available" || driverProfile.status === "busy";
    if (shouldTrack && !gpsActive) {
      startGpsTracking();
    } else if (!shouldTrack && gpsActive) {
      stopGpsTracking();
    }
  }, [driverProfile?.status]);

  const fetchDriverProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

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

  const sendLocation = useCallback(async () => {
    if (!driverProfile) return;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        });
      });

      const { latitude, longitude } = position.coords;
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          latitude,
          longitude,
          location_updated_at: new Date().toISOString(),
        })
        .eq("id", driverProfile.id);

      if (error) throw error;
      setLastGpsUpdate(new Date());
      setDriverProfile((prev) => prev ? { ...prev, latitude, longitude } : null);
    } catch (err: any) {
      console.error("GPS error:", err.message);
    }
  }, [driverProfile?.id]);

  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Erreur", description: "La géolocalisation n'est pas supportée", variant: "destructive" });
      return;
    }

    // Send immediately
    sendLocation();
    // Then every 30s
    gpsIntervalRef.current = setInterval(sendLocation, GPS_INTERVAL);
    setGpsActive(true);
  }, [sendLocation]);

  const stopGpsTracking = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsActive(false);
  }, []);

  const updateStatus = async (newStatus: string) => {
    if (!driverProfile) return;
    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({ status: newStatus })
        .eq("id", driverProfile.id);
      if (error) throw error;
      setDriverProfile({ ...driverProfile, status: newStatus });
      toast({
        title: "Statut mis à jour",
        description: `Vous êtes maintenant ${newStatus === "available" ? "disponible" : newStatus === "busy" ? "en livraison" : "hors ligne"}`,
      });
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
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
          <CardContent className="space-y-4">
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

            {/* GPS Status Indicator */}
            <div className={`flex items-center gap-3 p-3 rounded-lg ${gpsActive ? "bg-green-500/10 border border-green-500/30" : "bg-muted/50 border border-border"}`}>
              <div className="relative">
                <Navigation className={`h-5 w-5 ${gpsActive ? "text-green-500" : "text-muted-foreground"}`} />
                {gpsActive && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${gpsActive ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                  {gpsActive ? "Position GPS active" : "GPS inactif"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gpsActive
                    ? lastGpsUpdate
                      ? `Dernière mise à jour : ${lastGpsUpdate.toLocaleTimeString("fr-FR")}`
                      : "Envoi en cours..."
                    : "Passez en 'Disponible' ou 'En livraison' pour activer"}
                </p>
              </div>
              {gpsActive && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
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
