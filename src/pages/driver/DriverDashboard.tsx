import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Package, Star, TrendingUp, Navigation, MapPin, Loader2 } from "lucide-react";
import { formatPrice, getStatusInfo } from "@/lib/format";
import DeliveryRequest from "@/components/driver/DeliveryRequest";

const GPS_FAST_INTERVAL = 5_000;
const GPS_SLOW_INTERVAL = 30_000;

interface DriverProfileData {
  id: string;
  user_id: string;
  status: string;
  rating: number | null;
  total_deliveries: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface ActiveOrder {
  id: string;
  status: string;
  total_price: number;
  delivery_address_snapshot: any;
  profiles?: { name: string; phone: string | null };
}

interface IncomingAssignment {
  id: string;
  order_id: string;
  driver_id: string;
  status: string;
  expires_at: string;
  distance_to_shop: number | null;
  estimated_duration: number | null;
}

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [driverProfile, setDriverProfile] = useState<DriverProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [todayDeliveries, setTodayDeliveries] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [incomingAssignment, setIncomingAssignment] = useState<IncomingAssignment | null>(null);
  const [incomingOrder, setIncomingOrder] = useState<any>(null);

  const watchIdRef = useRef<number | null>(null);
  const slowIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fastIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
    return () => stopGps();
  }, []);

  // Subscribe to new assignments
  useEffect(() => {
    if (!driverProfile) return;

    const channel = supabase
      .channel(`driver-assignments-${driverProfile.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "delivery_assignments",
        filter: `driver_id=eq.${driverProfile.id}`,
      }, async (payload) => {
        const assignment = payload.new as any;
        if (assignment.status === "pending") {
          // Fetch the order details
          const { data: orderData } = await supabase
            .from("orders")
            .select("*, profiles(name, phone)")
            .eq("id", assignment.order_id)
            .single();
          
          if (orderData) {
            setIncomingAssignment(assignment);
            setIncomingOrder(orderData);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverProfile?.id]);

  // Auto-start/stop GPS
  useEffect(() => {
    if (!driverProfile) return;
    const shouldTrack = driverProfile.status === "available" || driverProfile.status === "busy";
    if (shouldTrack && !gpsActive) startGps();
    else if (!shouldTrack && gpsActive) stopGps();
  }, [driverProfile?.status]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: dp } = await supabase.from("driver_profiles").select("*").eq("user_id", user.id).single();
    if (!dp) { setLoading(false); return; }

    setDriverProfile(dp);
    setIsAvailable(dp.status === "available" || dp.status === "busy");

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayAssignments } = await supabase
      .from("delivery_assignments")
      .select("id, order_id")
      .eq("driver_id", dp.id)
      .eq("status", "accepted")
      .gte("created_at", today.toISOString());

    // Count delivered orders today via delivery_assignments with delivered_at set today
    const { count } = await supabase
      .from("delivery_assignments")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", dp.id)
      .not("delivered_at", "is", null)
      .gte("created_at", today.toISOString());

    setTodayDeliveries(count || 0);

    // Fetch active order (if busy)
    if (dp.status === "busy") {
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("*, profiles(name, phone)")
        .eq("driver_id", dp.id)
        .in("status", ["confirmed", "preparing", "ready", "delivering"])
        .limit(1);
      if (activeOrders?.[0]) setActiveOrder(activeOrders[0] as any);
    }

    // Check for pending assignments
    const { data: pendingAssignment } = await supabase
      .from("delivery_assignments")
      .select("*")
      .eq("driver_id", dp.id)
      .eq("status", "pending")
      .limit(1);

    if (pendingAssignment?.[0]) {
      const { data: orderData } = await supabase
        .from("orders")
        .select("*, profiles(name, phone)")
        .eq("id", pendingAssignment[0].order_id)
        .single();
      if (orderData) {
        setIncomingAssignment(pendingAssignment[0] as any);
        setIncomingOrder(orderData);
      }
    }

    setLoading(false);
  };

  const sendLocationFast = useCallback(async (position?: GeolocationPosition) => {
    if (!driverProfile) return;
    try {
      let lat: number, lng: number, heading: number | null = null, speed: number | null = null;

      if (position) {
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        heading = position.coords.heading;
        speed = position.coords.speed ? position.coords.speed * 3.6 : null; // m/s to km/h
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        heading = pos.coords.heading;
        speed = pos.coords.speed ? pos.coords.speed * 3.6 : null;
      }

      // Upsert into driver_locations (fast, every 5s)
      await supabase.from("driver_locations").upsert({
        driver_id: driverProfile.id,
        latitude: lat,
        longitude: lng,
        heading,
        speed,
        updated_at: new Date().toISOString(),
      }, { onConflict: "driver_id" });

    } catch (err: any) {
      console.error("GPS error:", err.message);
    }
  }, [driverProfile?.id]);

  const sendLocationSlow = useCallback(async () => {
    if (!driverProfile) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      await supabase.from("driver_profiles").update({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        location_updated_at: new Date().toISOString(),
      }).eq("id", driverProfile.id);
    } catch {}
  }, [driverProfile?.id]);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Erreur", description: "GPS non supporté", variant: "destructive" });
      return;
    }

    sendLocationFast();
    sendLocationSlow();

    fastIntervalRef.current = setInterval(sendLocationFast, GPS_FAST_INTERVAL);
    slowIntervalRef.current = setInterval(sendLocationSlow, GPS_SLOW_INTERVAL);
    setGpsActive(true);
  }, [sendLocationFast, sendLocationSlow]);

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (fastIntervalRef.current) { clearInterval(fastIntervalRef.current); fastIntervalRef.current = null; }
    if (slowIntervalRef.current) { clearInterval(slowIntervalRef.current); slowIntervalRef.current = null; }
    setGpsActive(false);
  }, []);

  const toggleAvailability = async (available: boolean) => {
    if (!driverProfile) return;
    const newStatus = available ? "available" : "offline";
    const { error } = await supabase.from("driver_profiles").update({ status: newStatus }).eq("id", driverProfile.id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    setDriverProfile({ ...driverProfile, status: newStatus });
    setIsAvailable(available);
    toast({ title: available ? "Vous êtes disponible 🟢" : "Vous êtes hors ligne" });
  };

  const handleAcceptDelivery = async () => {
    if (!incomingAssignment || !incomingOrder || !driverProfile) return;

    const { data, error } = await supabase.rpc("respond_to_driver_assignment", {
      _order_id: incomingAssignment.order_id,
      _response: "accepted",
    });
    if (error || data !== "accepted") {
      toast({ title: "Demande indisponible", description: error?.message ?? "Cette livraison a déjà été attribuée.", variant: "destructive" });
      setIncomingAssignment(null);
      setIncomingOrder(null);
      return;
    }

    setDriverProfile({ ...driverProfile, status: "busy" });
    setIncomingAssignment(null);
    setIncomingOrder(null);
    navigate(`/driver/delivery/${incomingAssignment.order_id}`);
  };

  const handleRejectDelivery = async () => {
    if (!incomingAssignment) return;

    const { error } = await supabase.functions.invoke("assign-driver", {
      body: { order_id: incomingAssignment.order_id, response: "rejected" },
    });
    if (error) {
      toast({ title: "Erreur", description: "Impossible de transmettre le refus.", variant: "destructive" });
      return;
    }

    setIncomingAssignment(null);
    setIncomingOrder(null);
    toast({ title: "Livraison refusée", description: "Un autre livreur sera recherché" });
  };

  const handleExpireDelivery = async () => {
    if (!incomingAssignment) return;

    const { error } = await supabase.functions.invoke("assign-driver", {
      body: { order_id: incomingAssignment.order_id, response: "expired" },
    });
    if (error) {
      toast({ title: "Erreur", description: "Impossible de transmettre l’expiration de la demande.", variant: "destructive" });
      return;
    }

    setIncomingAssignment(null);
    setIncomingOrder(null);
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
      {/* Delivery Request Overlay */}
      {incomingAssignment && incomingOrder && (
        <DeliveryRequest
          assignment={incomingAssignment}
          order={incomingOrder}
          onAccept={handleAcceptDelivery}
          onReject={handleRejectDelivery}
          onExpire={handleExpireDelivery}
        />
      )}

      {/* Availability Toggle */}
      <Card className="border-purple-500/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isAvailable ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
              <div>
                <p className="font-bold text-lg">
                  {driverProfile?.status === "busy" ? "En livraison" : isAvailable ? "Disponible" : "Hors ligne"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gpsActive ? "📍 GPS actif" : "GPS inactif"}
                </p>
              </div>
            </div>
            <Switch
              checked={isAvailable}
              onCheckedChange={toggleAvailability}
              disabled={driverProfile?.status === "busy"}
              className="data-[state=checked]:bg-green-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 text-purple-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{todayDeliveries}</p>
            <p className="text-xs text-muted-foreground">Aujourd'hui</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{driverProfile?.rating?.toFixed(1) || "4.5"}</p>
            <p className="text-xs text-muted-foreground">Note moyenne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{driverProfile?.total_deliveries || 0}</p>
            <p className="text-xs text-muted-foreground">Total livraisons</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Navigation className={`h-5 w-5 mx-auto mb-1 ${gpsActive ? "text-green-500" : "text-muted-foreground"}`} />
            <p className="text-2xl font-bold text-sm">
              {driverProfile?.status === "busy" ? "🔴 Occupé" : isAvailable ? "🟢 Dispo" : "⚫ Offline"}
            </p>
            <p className="text-xs text-muted-foreground">Statut</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Order */}
      {activeOrder && driverProfile?.status === "busy" && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-500" />
                Commande en cours
              </h3>
              <Badge className="bg-purple-500/20 text-purple-400 border-0">
                {getStatusInfo(activeOrder.status).label}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{activeOrder.profiles?.name || "Client"}</p>
              {activeOrder.delivery_address_snapshot?.full_address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {activeOrder.delivery_address_snapshot.full_address}
                </p>
              )}
              <p className="text-sm font-bold text-purple-500">{formatPrice(activeOrder.total_price)}</p>
            </div>
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => navigate(`/driver/delivery/${activeOrder.id}`)}
            >
              Voir la livraison
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DriverDashboard;
