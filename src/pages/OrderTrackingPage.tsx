import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Package, Bike, CheckCircle2, Clock, MapPin } from "lucide-react";
import MapboxMap from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";

interface Order {
  id: string;
  status: string;
  total_price: number;
  delivery_fee: number;
  subtotal: number;
  created_at: string | null;
  delivery_address_snapshot: any;
  driver_id: string | null;
  notes: string | null;
}

interface DriverLocation {
  latitude: number | null;
  longitude: number | null;
  status: string;
}

const statusSteps = [
  { key: "pending", label: "En attente", icon: Clock, description: "Votre commande est en cours de validation" },
  { key: "confirmed", label: "Confirmée", icon: CheckCircle2, description: "Votre commande a été acceptée" },
  { key: "preparing", label: "En préparation", icon: Package, description: "Nous préparons votre commande" },
  { key: "delivering", label: "En livraison", icon: Bike, description: "Le livreur est en route vers vous" },
  { key: "delivered", label: "Livrée", icon: CheckCircle2, description: "Votre commande a été livrée" },
];

import { formatPrice } from "@/lib/format";

const OrderTrackingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchOrder();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id]);

  const fetchOrder = async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      navigate("/orders");
      return;
    }

    setOrder(data as any);
    setLoading(false);

    // Start polling driver location if order has a driver and is in delivering status
    if (data.driver_id && ["confirmed", "preparing", "delivering"].includes(data.status)) {
      fetchDriverLocation(data.driver_id);
      pollingRef.current = setInterval(() => fetchDriverLocation(data.driver_id!), 30000);
    }

    // Subscribe to order status changes in real-time
    const channel = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, (payload) => {
        const updated = payload.new as any;
        setOrder((prev) => prev ? { ...prev, ...updated } : null);

        // Start/stop polling based on new status
        if (updated.driver_id && ["confirmed", "preparing", "delivering"].includes(updated.status)) {
          if (!pollingRef.current) {
            fetchDriverLocation(updated.driver_id);
            pollingRef.current = setInterval(() => fetchDriverLocation(updated.driver_id), 30000);
          }
        } else if (updated.status === "delivered" || updated.status === "cancelled") {
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const fetchDriverLocation = async (driverId: string) => {
    const { data } = await supabase
      .from("driver_profiles")
      .select("latitude, longitude, status")
      .eq("id", driverId)
      .single();

    if (data) {
      setDriverLocation(data);
      updateDriverMarker(data.latitude, data.longitude);
    }
  };

  const updateDriverMarker = (lat: number | null, lng: number | null) => {
    if (!mapRef.current || lat === null || lng === null) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.className = "driver-marker";
      el.innerHTML = `<div style="background: hsl(var(--primary)); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: pulse 2s infinite;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="18.5" r="3.5"/><circle cx="5.5" cy="18.5" r="3.5"/><path d="M15 18.5h-6"/><path d="M3 18.5h-.5"/><path d="M22 18.5h-.5"/><path d="m14 2-3 6h9l-1 4"/><path d="M5.5 15V7h4l3-5"/></svg>
      </div>`;
      driverMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapRef.current);
    }

    mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
  };

  const handleMapReady = (map: mapboxgl.Map) => {
    mapRef.current = map;

    // Add destination marker from order address
    const snapshot = order?.delivery_address_snapshot as any;
    if (snapshot?.latitude && snapshot?.longitude) {
      destMarkerRef.current = new mapboxgl.Marker({ color: "#D3111A" })
        .setLngLat([snapshot.longitude, snapshot.latitude])
        .addTo(map);

      map.flyTo({ center: [snapshot.longitude, snapshot.latitude], zoom: 14 });
    }

    // If driver location already available, show it
    if (driverLocation?.latitude && driverLocation?.longitude) {
      updateDriverMarker(driverLocation.latitude, driverLocation.longitude);
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    if (order.status === "cancelled") return -1;
    return statusSteps.findIndex((s) => s.key === order.status);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  const currentStep = getCurrentStepIndex();
  const isCancelled = order.status === "cancelled";
  const showMap = order.driver_id && ["confirmed", "preparing", "delivering"].includes(order.status);

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-border/50">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Suivi de commande</h1>
          <p className="text-xs text-muted-foreground">
            {order.created_at ? new Date(order.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : ""}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Map - Driver tracking */}
        {showMap && (
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="relative">
              <MapboxMap
                className="w-full h-64"
                center={
                  driverLocation?.latitude && driverLocation?.longitude
                    ? [driverLocation.longitude, driverLocation.latitude]
                    : (order.delivery_address_snapshot as any)?.longitude
                      ? [(order.delivery_address_snapshot as any).longitude, (order.delivery_address_snapshot as any).latitude]
                      : undefined
                }
                zoom={14}
                interactive={true}
                onMapReady={handleMapReady}
              />
              {driverLocation && (
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-background/95 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Bike className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">Livreur en route</p>
                      <p className="text-xs text-muted-foreground">Position mise à jour toutes les 30s</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Status Timeline */}
        <Card className="p-4">
          <h3 className="font-bold mb-4">Statut de la commande</h3>

          {isCancelled ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10">
              <Badge variant="destructive">Annulée</Badge>
              <p className="text-sm text-muted-foreground">Cette commande a été annulée</p>
            </div>
          ) : (
            <div className="space-y-0">
              {statusSteps.map((step, index) => {
                const isActive = index === currentStep;
                const isDone = index < currentStep;
                const StepIcon = step.icon;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isDone ? "bg-primary text-primary-foreground" :
                        isActive ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        <StepIcon className="h-4 w-4" />
                      </div>
                      {index < statusSteps.length - 1 && (
                        <div className={`w-0.5 h-8 ${isDone ? "bg-primary" : "bg-muted"}`} />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className={`text-sm font-semibold ${isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      {isActive && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Delivery Address */}
        {order.delivery_address_snapshot && (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Adresse de livraison</p>
                <p className="text-xs text-muted-foreground">{(order.delivery_address_snapshot as any)?.full_address}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Order Total */}
        <Card className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Livraison</span>
            <span>{order.delivery_fee === 0 ? "Gratuite" : formatPrice(order.delivery_fee)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total_price)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
