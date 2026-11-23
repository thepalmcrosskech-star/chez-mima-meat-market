import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Phone, Navigation, MapPin, Package, Banknote, CreditCard, Loader2, Clock } from "lucide-react";
import { formatPrice, getStatusInfo } from "@/lib/format";
import MapboxMap, { getMapboxToken } from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";

interface OrderData {
  id: string;
  status: string;
  total_price: number;
  delivery_fee: number;
  payment_method: string;
  cash_bill_amount: number | null;
  notes: string | null;
  delivery_address_snapshot: any;
  profiles?: { name: string; phone: string | null };
}

interface AssignmentData {
  id: string;
  picked_up_at: string | null;
  delivered_at: string | null;
}

const DriverActiveDelivery = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeUpdateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (routeUpdateRef.current) clearInterval(routeUpdateRef.current);
    };
  }, [orderId]);

  const fetchData = async () => {
    if (!orderId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: dp } = await supabase.from("driver_profiles").select("*").eq("user_id", user.id).single();
    if (!dp) { navigate("/driver"); return; }
    setDriverProfile(dp);

    const [orderRes, itemsRes, assignRes] = await Promise.all([
      supabase.from("orders").select("*, profiles!user_id(name, phone)").eq("id", orderId).single(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
      supabase.from("delivery_assignments").select("id, picked_up_at, delivered_at")
        .eq("order_id", orderId).eq("driver_id", dp.id).eq("status", "accepted").limit(1),
    ]);

    if (orderRes.data) setOrder(orderRes.data as any);
    if (itemsRes.data) setOrderItems(itemsRes.data);
    if (assignRes.data?.[0]) setAssignment(assignRes.data[0] as any);
    setLoading(false);
  };

  const updateRoute = useCallback(async (driverLat: number, driverLng: number) => {
    if (!mapRef.current || !order) return;
    const snapshot = order.delivery_address_snapshot;
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
      setDistance(`${(route.distance / 1000).toFixed(1)} km`);

      const map = mapRef.current;
      if (map.getSource("route")) {
        (map.getSource("route") as mapboxgl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: route.geometry,
        });
      } else {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.geometry },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#A855F7", "line-width": 4, "line-opacity": 0.8 },
        });
      }
    } catch (err) {
      console.error("Route update error:", err);
    }
  }, [order]);

  const handleMapReady = (map: mapboxgl.Map) => {
    mapRef.current = map;
    const snapshot = order?.delivery_address_snapshot;
    if (snapshot?.latitude && snapshot?.longitude) {
      new mapboxgl.Marker({ color: "#D3111A" })
        .setLngLat([snapshot.longitude, snapshot.latitude])
        .addTo(map);
    }

    // Start route updates
    if (driverProfile?.latitude && driverProfile?.longitude) {
      updateDriverPosition(driverProfile.latitude, driverProfile.longitude);
      updateRoute(driverProfile.latitude, driverProfile.longitude);
    }

    routeUpdateRef.current = setInterval(async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
        );
        updateDriverPosition(pos.coords.latitude, pos.coords.longitude);
        updateRoute(pos.coords.latitude, pos.coords.longitude);
      } catch {}
    }, 30000);
  };

  const updateDriverPosition = (lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:#A855F7;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="18.5" cy="18.5" r="3.5"/><circle cx="5.5" cy="18.5" r="3.5"/><path d="M15 18.5h-6"/><path d="m14 2-3 6h9l-1 4"/><path d="M5.5 15V7h4l3-5"/></svg>
      </div>`;
      driverMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(mapRef.current);
    }
  };

  const handlePickup = async () => {
    if (!assignment) return;
    const { error } = await supabase.rpc("mark_driver_order_picked_up", { _order_id: orderId });
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    setAssignment({ ...assignment, picked_up_at: new Date().toISOString() });
    toast({ title: "📦 Commande récupérée !", description: "Rendez-vous chez le client" });
  };

  const handleDeliver = async () => {
    if (!assignment || !order || !driverProfile) return;

    const { error } = await supabase.rpc("complete_driver_delivery", { _order_id: order.id });
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }

    toast({ title: "✅ Commande livrée !", description: "Bon travail !" });
    navigate("/driver");
  };

  const openNavigation = () => {
    const snapshot = order?.delivery_address_snapshot;
    if (snapshot?.latitude && snapshot?.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${snapshot.latitude},${snapshot.longitude}`, "_blank");
    }
  };

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const snapshot = order.delivery_address_snapshot;

  return (
    <div className="space-y-0">
      {/* Map */}
      <div className="relative">
        <MapboxMap
          className="w-full h-64"
          center={snapshot?.longitude && snapshot?.latitude ? [snapshot.longitude, snapshot.latitude] : undefined}
          zoom={14}
          interactive={true}
          onMapReady={handleMapReady}
        />
        {/* ETA Overlay */}
        {(eta || distance) && (
          <div className="absolute top-3 left-3 right-3">
            <div className="bg-background/90 backdrop-blur-md rounded-xl px-4 py-2 flex items-center justify-between shadow-lg">
              {eta && <div className="flex items-center gap-1 text-sm font-bold"><Clock className="h-4 w-4 text-primary" />{eta}</div>}
              {distance && <div className="text-sm text-muted-foreground">{distance}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        {/* Client Info */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">{order.profiles?.name || "Client"}</p>
              <Badge className={`${getStatusInfo(order.status).color} border-0 mt-1`}>
                {getStatusInfo(order.status).label}
              </Badge>
            </div>
            <div className="flex gap-2">
              {order.profiles?.phone && (
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Appeler le client"
                  onClick={() => { window.location.href = `tel:${order.profiles.phone}`; }}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="icon" className="rounded-full" onClick={openNavigation}>
                <Navigation className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Address */}
          {snapshot?.full_address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p>{snapshot.full_address}</p>
                {snapshot.apartment && <p className="text-xs text-muted-foreground">Apt: {snapshot.apartment}</p>}
                {snapshot.instructions && <p className="text-xs text-muted-foreground">📝 {snapshot.instructions}</p>}
              </div>
            </div>
          )}
        </Card>

        {/* Order Items */}
        <Card className="p-4">
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Articles ({orderItems.length})
          </h3>
          <div className="space-y-1">
            {orderItems.filter((item) => item.item_status !== "removed").map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.product_name} × {item.quantity}</span>
                <span className="font-medium">{formatPrice(item.line_total)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Payment */}
        <Card className="p-4 space-y-2">
          <h3 className="font-bold flex items-center gap-2">
            {order.payment_method === "cash" ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            Paiement
          </h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Mode</span>
            <Badge variant="secondary">
              {order.payment_method === "cash" ? "Espèces" : order.payment_method === "on_site" ? "Sur place" : "CB"}
            </Badge>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total_price)}</span>
          </div>
          {order.payment_method === "cash" && order.cash_bill_amount && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant remis</span>
                <span>{formatPrice(order.cash_bill_amount)}</span>
              </div>
              {order.cash_bill_amount > order.total_price && (
                <div className="flex justify-between text-sm font-bold text-warning bg-warning/10 rounded-md px-2 py-1.5">
                  <span>💰 Monnaie à rendre</span>
                  <span>{formatPrice(order.cash_bill_amount - order.total_price)}</span>
                </div>
              )}
            </>
          )}
        </Card>

        {order.notes && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground italic">📝 {order.notes}</p>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="pb-4">
          {!assignment?.picked_up_at ? (
            <Button
              className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary text-primary-foreground"
              onClick={handlePickup}
            >
              📦 J'ai récupéré la commande
            </Button>
          ) : !assignment?.delivered_at ? (
            <Button
              className="w-full h-14 text-lg font-bold bg-success hover:bg-success text-primary-foreground"
              onClick={handleDeliver}
            >
              ✅ Commande livrée
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DriverActiveDelivery;
