import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package, Clock, Navigation } from "lucide-react";
import { formatPrice } from "@/lib/format";
import MapboxMap from "@/components/MapboxMap";
import mapboxgl from "mapbox-gl";

interface DeliveryRequestProps {
  assignment: {
    id: string;
    order_id: string;
    expires_at: string;
    distance_to_shop: number | null;
    estimated_duration: number | null;
  };
  order: {
    id: string;
    total_price: number;
    delivery_fee: number;
    delivery_address_snapshot: any;
    profiles?: { name: string; phone: string | null };
  };
  onAccept: () => void;
  onReject: () => void;
  onExpire: () => void;
}

const SHOP_LAT = 31.6295;
const SHOP_LNG = -8.0083;

const DeliveryRequest = ({ assignment, order, onAccept, onReject, onExpire }: DeliveryRequestProps) => {
  const [timeLeft, setTimeLeft] = useState(60);
  const [accepting, setAccepting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const svgRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const expiresAt = new Date(assignment.expires_at).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [assignment.expires_at]);

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept();
  };

  const circumference = 2 * Math.PI * 54;
  const progress = (timeLeft / 60) * circumference;
  const snapshot = order.delivery_address_snapshot;
  const destLat = snapshot?.latitude;
  const destLng = snapshot?.longitude;

  const handleMapReady = (map: mapboxgl.Map) => {
    // Shop marker
    new mapboxgl.Marker({ color: "#D3111A" })
      .setLngLat([SHOP_LNG, SHOP_LAT])
      .setPopup(new mapboxgl.Popup().setText("CHEZ MIMA"))
      .addTo(map);

    // Destination marker
    if (destLat && destLng) {
      new mapboxgl.Marker({ color: "#3B82F6" })
        .setLngLat([destLng, destLat])
        .setPopup(new mapboxgl.Popup().setText(snapshot?.full_address || "Destination"))
        .addTo(map);

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([SHOP_LNG, SHOP_LAT]);
      bounds.extend([destLng, destLat]);
      map.fitBounds(bounds, { padding: 60 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/98 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 text-center">
        <div className="text-4xl mb-2 animate-bounce">🔔</div>
        <h1 className="text-2xl font-bold">Nouvelle livraison !</h1>
        <p className="text-sm text-muted-foreground mt-1">Acceptez dans les 60 secondes</p>
      </div>

      {/* Countdown */}
      <div className="flex justify-center py-2">
        <div className="relative w-28 h-28">
          <svg className="transform -rotate-90 w-28 h-28">
            <circle cx="56" cy="56" r="54" stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
            <circle
              ref={svgRef}
              cx="56" cy="56" r="54"
              stroke={timeLeft > 20 ? "#A855F7" : timeLeft > 10 ? "#F59E0B" : "#EF4444"}
              strokeWidth="6"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl font-bold ${timeLeft <= 10 ? "text-red-500" : "text-foreground"}`}>
              {timeLeft}
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="px-4">
        <MapboxMap
          className="w-full h-40 rounded-xl"
          center={[SHOP_LNG, SHOP_LAT]}
          zoom={12}
          interactive={false}
          onMapReady={handleMapReady}
        />
      </div>

      {/* Info */}
      <div className="px-4 py-3 space-y-2 flex-1 overflow-y-auto">
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Package className="h-4 w-4" /> Commande
            </span>
            <span className="font-bold text-purple-500">{formatPrice(order.total_price)}</span>
          </div>
          {assignment.distance_to_shop && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Navigation className="h-4 w-4" /> Distance boutique
              </span>
              <span className="font-medium">{assignment.distance_to_shop.toFixed(1)} km</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" /> Destination
            </span>
            <span className="text-xs text-right max-w-[60%] truncate">{snapshot?.full_address || "—"}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">💰 Frais livraison</span>
              <Badge variant="secondary">{formatPrice(order.delivery_fee)}</Badge>
            </div>
          )}
        </Card>
      </div>

      {/* Buttons */}
      <div className="px-4 pb-8 space-y-2">
        <Button
          className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? "Acceptation..." : "✅ Accepter la livraison"}
        </Button>
        <Button
          variant="outline"
          className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
          onClick={onReject}
        >
          Refuser
        </Button>
      </div>
    </div>
  );
};

export default DeliveryRequest;
