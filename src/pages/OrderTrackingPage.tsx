import { CustomerHeader } from "@/components/OriginPromise";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Package, Bike, CheckCircle2, Clock, MapPin, Phone, Star, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import MapboxMap, { getMapboxToken } from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";
import { formatPrice } from "@/lib/format";
import DriverRating from "@/components/tracking/DriverRating";

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
  payment_method: string;
  cash_bill_amount: number | null;
  delivery_mode: string;
  user_id: string;
}

interface DriverInfo {
  id: string;
  vehicle_type: string;
  rating: number | null;
  profiles: { name: string; phone: string | null } | null;
}

const statusSteps = [
  { key: "pending", label: "En attente", icon: Clock, description: "Votre commande est en cours de validation" },
  { key: "confirmed", label: "Confirmée", icon: CheckCircle2, description: "Votre commande a été acceptée" },
  { key: "preparing", label: "En préparation", icon: Package, description: "Nous préparons votre commande" },
  { key: "delivering", label: "En livraison", icon: Bike, description: "Le livreur est en route vers vous" },
  { key: "delivered", label: "Livrée", icon: CheckCircle2, description: "Votre commande a été livrée" },
];

const OrderTrackingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<string | null>(null);
  const [distanceLeft, setDistanceLeft] = useState<string | null>(null);
  const [showDelivered, setShowDelivered] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const prevPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const routeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchOrder();
    return () => {
      if (routeIntervalRef.current) clearInterval(routeIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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

    if (error || !data) { navigate("/orders"); return; }

    setOrder(data as any);
    setLoading(false);

    // Fetch driver info
    if (data.driver_id) {
      const { data: driver } = await supabase
        .from("driver_profiles")
        .select("id, vehicle_type, rating, profiles(name, phone)")
        .eq("id", data.driver_id)
        .single();
      if (driver) setDriverInfo(driver as any);
    }

    // Subscribe to order status changes
    const orderChannel = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, (payload) => {
        const updated = payload.new as any;
        setOrder((prev) => prev ? { ...prev, ...updated } : null);

        if (updated.status === "delivered") {
          setShowDelivered(true);
          setTimeout(() => {
            setShowDelivered(false);
            setShowRating(true);
          }, 3000);
        }

        // If driver_id changed, fetch new driver info
        if (updated.driver_id && updated.driver_id !== data.driver_id) {
          supabase.from("driver_profiles")
            .select("id, vehicle_type, rating, profiles(name, phone)")
            .eq("id", updated.driver_id)
            .single()
            .then(({ data: d }) => { if (d) setDriverInfo(d as any); });
        }
      })
      .subscribe();

    // Subscribe to driver_locations for realtime tracking
    if (data.driver_id) {
      const driverChannel = supabase
        .channel(`driver-tracking-${data.driver_id}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${data.driver_id}`,
        }, (payload) => {
          const { latitude, longitude, heading } = payload.new as any;
          if (latitude && longitude) {
            animateDriverMarker(Number(latitude), Number(longitude));
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(orderChannel);
        supabase.removeChannel(driverChannel);
      };
    }

    return () => { supabase.removeChannel(orderChannel); };
  };

  const animateDriverMarker = useCallback((targetLat: number, targetLng: number) => {
    if (!mapRef.current) return;

    const prev = prevPositionRef.current;
    if (!prev) {
      // First position - just set it
      updateDriverMarkerPosition(targetLat, targetLng);
      prevPositionRef.current = { lat: targetLat, lng: targetLng };
      mapRef.current.flyTo({ center: [targetLng, targetLat], zoom: 15, duration: 1000 });
      return;
    }

    // Smooth interpolation
    const startLat = prev.lat;
    const startLng = prev.lng;
    const duration = 2000; // 2 seconds
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      const lat = startLat + (targetLat - startLat) * ease;
      const lng = startLng + (targetLng - startLng) * ease;

      updateDriverMarkerPosition(lat, lng);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevPositionRef.current = { lat: targetLat, lng: targetLng };
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const updateDriverMarkerPosition = (lat: number, lng: number) => {
    if (!mapRef.current) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background: hsl(var(--primary)); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: pulse 2s infinite;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="18.5" r="3.5"/><circle cx="5.5" cy="18.5" r="3.5"/><path d="M15 18.5h-6"/><path d="m14 2-3 6h9l-1 4"/><path d="M5.5 15V7h4l3-5"/></svg>
      </div>`;
      driverMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapRef.current);
    }
  };

  const updateRoute = useCallback(async (driverLat: number, driverLng: number) => {
    if (!mapRef.current || !order) return;
    const snapshot = order.delivery_address_snapshot as any;
    if (!snapshot?.latitude || !snapshot?.longitude) return;

    try {
      const token = await getMapboxToken();
      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLng},${driverLat};${snapshot.longitude},${snapshot.latitude}?geometries=geojson&access_token=${token}`
      );
      const data = await res.json();
      if (!data.routes?.[0]) return;

      const route = data.routes[0];
      setEta(`~${Math.ceil(route.duration / 60)} min`);
      setDistanceLeft(`${(route.distance / 1000).toFixed(1)} km`);

      const map = mapRef.current;
      if (map.getSource("route")) {
        (map.getSource("route") as mapboxgl.GeoJSONSource).setData({
          type: "Feature", properties: {}, geometry: route.geometry,
        });
      } else {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.geometry },
        });
        map.addLayer({
          id: "route", type: "line", source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#D3111A", "line-width": 4, "line-opacity": 0.7 },
        });
      }
    } catch {}
  }, [order]);

  const handleMapReady = async (map: mapboxgl.Map) => {
    mapRef.current = map;

    const snapshot = order?.delivery_address_snapshot as any;
    if (snapshot?.latitude && snapshot?.longitude) {
      destMarkerRef.current = new mapboxgl.Marker({ color: "#D3111A" })
        .setLngLat([snapshot.longitude, snapshot.latitude])
        .addTo(map);
      map.flyTo({ center: [snapshot.longitude, snapshot.latitude], zoom: 14 });
    }

    // Get initial driver location
    if (order?.driver_id) {
      const { data: loc } = await supabase
        .from("driver_locations")
        .select("latitude, longitude")
        .eq("driver_id", order.driver_id)
        .single();

      if (loc?.latitude && loc?.longitude) {
        const lat = Number(loc.latitude);
        const lng = Number(loc.longitude);
        updateDriverMarkerPosition(lat, lng);
        prevPositionRef.current = { lat, lng };
        updateRoute(lat, lng);

        // Start route update interval
        routeIntervalRef.current = setInterval(async () => {
          const { data: newLoc } = await supabase
            .from("driver_locations")
            .select("latitude, longitude")
            .eq("driver_id", order.driver_id!)
            .single();
          if (newLoc?.latitude && newLoc?.longitude) {
            updateRoute(Number(newLoc.latitude), Number(newLoc.longitude));
          }
        }, 30000);

        // Fit bounds
        if (snapshot?.latitude && snapshot?.longitude) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([lng, lat]);
          bounds.extend([snapshot.longitude, snapshot.latitude]);
          map.fitBounds(bounds, { padding: 60 });
        }
      }
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

  // Delivered overlay
  if (showDelivered) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 animate-in fade-in">
        <div className="text-center space-y-4">
          <div className="text-7xl">🎉</div>
          <h1 className="text-3xl font-bold">Commande livrée !</h1>
          <p className="text-muted-foreground">Bon appétit ! 🥩</p>
        </div>
      </div>
    );
  }

  // Rating overlay
  if (showRating && order.driver_id) {
    return (
      <DriverRating
        orderId={order.id}
        driverId={order.driver_id}
        onComplete={() => { setShowRating(false); navigate("/orders"); }}
      />
    );
  }

  return (
    <div className="detail-page min-h-screen bg-background pb-8">
      {/* Header */}
      <CustomerHeader>
      <div className="brand-header sticky top-0 z-40 px-4 py-3 flex items-center gap-3 border-b-4 border-primary">
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
      </CustomerHeader>

      <div className="px-4 py-4 space-y-4">
        {/* Map */}
        {showMap && (
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="relative">
              <MapboxMap
                className="w-full h-64"
                center={
                  (order.delivery_address_snapshot as any)?.longitude
                    ? [(order.delivery_address_snapshot as any).longitude, (order.delivery_address_snapshot as any).latitude]
                    : undefined
                }
                zoom={14}
                interactive={true}
                onMapReady={handleMapReady}
              />
              {/* ETA + Driver info overlay */}
              <div className="absolute bottom-3 left-3 right-3">
                <div className="bg-background/95 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Bike className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{driverInfo?.profiles?.name || "Livreur en route"}</p>
                    <p className="text-xs text-muted-foreground">
                      {eta && distanceLeft ? `${eta} • ${distanceLeft}` : "Position mise à jour en temps réel"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {driverInfo?.rating && (
                      <div className="flex items-center gap-0.5 text-xs">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {driverInfo.rating.toFixed(1)}
                      </div>
                    )}
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse ml-1" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Driver card with call button */}
        {driverInfo && ["delivering"].includes(order.status) && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bike className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{driverInfo.profiles?.name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {driverInfo.rating?.toFixed(1) || "4.5"} • {driverInfo.vehicle_type}
                  </div>
                </div>
              </div>
              {driverInfo.profiles?.phone && (
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Appeler le livreur"
                  onClick={() => { window.location.href = `tel:${driverInfo.profiles.phone}`; }}
                >
                  <Phone className="h-4 w-4" />
                </Button>
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
            <span className="text-muted-foreground">{order.delivery_mode === "pickup" ? "Retrait" : "Livraison"}</span>
            <span>{order.delivery_fee === 0 ? "Gratuit" : formatPrice(order.delivery_fee)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total_price)}</span>
          </div>
        </Card>

        {/* Payment Info */}
        <Card className="p-4 space-y-2">
          <h3 className="font-bold mb-1">💳 Paiement</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Mode</span>
            <span>
              {order.payment_method === "cash" ? "Espèces" : order.payment_method === "on_site" ? "Sur place" : "Carte bancaire"}
            </span>
          </div>
          {order.payment_method === "cash" && order.cash_bill_amount && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant remis</span>
                <span>{formatPrice(order.cash_bill_amount)}</span>
              </div>
              {order.cash_bill_amount > order.total_price && (
                <div className="flex justify-between text-sm font-semibold text-warning">
                  <span>💰 Monnaie à rendre</span>
                  <span>{formatPrice(order.cash_bill_amount - order.total_price)}</span>
                </div>
              )}
              {order.cash_bill_amount === order.total_price && (
                <p className="text-xs text-success font-medium">✅ Appoint exact</p>
              )}
            </>
          )}
          {order.payment_method === "cash" && !order.cash_bill_amount && (
            <p className="text-xs text-success font-medium">✅ Le client paiera l'appoint</p>
           )}
        </Card>

        {/* Cancel Button - only for pending/confirmed */}
        {["pending", "confirmed"].includes(order.status) && (
          <>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setCancelDialogOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Annuler la commande
            </Button>

            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Votre commande sera définitivement annulée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Non, garder</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={cancelling}
                    onClick={async () => {
                      setCancelling(true);
                      const { error } = await supabase
                        .from("orders")
                        .update({ status: "cancelled" })
                        .eq("id", order.id);
                      setCancelling(false);
                      if (error) {
                        toast({ title: "Erreur", description: error.message, variant: "destructive" });
                      } else {
                        setOrder((prev) => prev ? { ...prev, status: "cancelled" } : null);
                        toast({ title: "Commande annulée" });
                      }
                    }}
                  >
                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Oui, annuler
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPage;
