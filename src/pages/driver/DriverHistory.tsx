import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Star, MapPin, Calendar } from "lucide-react";
import { formatPrice } from "@/lib/format";

interface HistoryItem {
  id: string;
  order_id: string;
  delivered_at: string | null;
  distance_to_shop: number | null;
  created_at: string;
  orders: {
    total_price: number;
    delivery_fee: number;
    delivery_address_snapshot: any;
    profiles: { name: string } | null;
  } | null;
}

const DriverHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: dp } = await supabase.from("driver_profiles").select("id").eq("user_id", user.id).single();
    if (!dp) return;

    const { data } = await supabase
      .from("delivery_assignments")
      .select("id, order_id, delivered_at, distance_to_shop, created_at, orders(total_price, delivery_fee, delivery_address_snapshot, profiles!user_id(name))")
      .eq("driver_id", dp.id)
      .not("delivered_at", "is", null)
      .order("delivered_at", { ascending: false })
      .limit(50);

    if (data) setHistory(data as any);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        Historique des livraisons
      </h1>

      {history.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucune livraison effectuée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{item.orders?.profiles?.name || "Client"}</p>
                  <Badge variant="secondary" className="bg-success/10 text-success border-0">Livrée</Badge>
                </div>
                {item.orders?.delivery_address_snapshot?.full_address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {item.orders.delivery_address_snapshot.full_address}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {item.delivered_at
                      ? new Date(item.delivered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })
                      : "—"}
                  </span>
                  <span className="font-bold text-primary">{formatPrice(item.orders?.total_price || 0)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverHistory;
