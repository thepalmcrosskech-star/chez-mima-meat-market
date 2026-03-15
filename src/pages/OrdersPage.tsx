import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface Order {
  id: string;
  status: string;
  total_price: number;
  created_at: string | null;
  delivery_fee: number;
  subtotal: number;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "En attente", variant: "secondary" },
  confirmed: { label: "Confirmée", variant: "default" },
  preparing: { label: "En préparation", variant: "default" },
  ready: { label: "Prête", variant: "default" },
  delivering: { label: "En livraison", variant: "default" },
  delivered: { label: "Livrée", variant: "default" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

const formatPrice = (n: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-4 border-b border-border/50">
        <h1 className="text-xl font-bold">Mes Commandes</h1>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">Aucune commande</h2>
            <p className="text-muted-foreground text-sm">Vos commandes apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const info = statusLabels[order.status] || { label: order.status, variant: "secondary" as const };
              return (
                <Card key={order.id} className="p-4 cursor-pointer hover:border-primary/50 transition-all" onClick={() => navigate(`/order-tracking/${order.id}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </p>
                    <Badge variant={info.variant}>{info.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Sous-total: {formatPrice(order.subtotal)} · Livraison: {formatPrice(order.delivery_fee)}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-primary">{formatPrice(order.total_price)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default OrdersPage;
