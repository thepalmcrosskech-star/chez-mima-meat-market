import { formatPrice } from "@/lib/format";
import { CustomerHeader } from "@/components/OriginPromise";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { buildReorderLines } from "@/lib/reorder";
import type { ItemUnavailablePolicy } from "@/lib/item-unavailable-policy";

interface Order {
  delivery_mode?: string | null;
  id: string;
  status: string;
  total_price: number;
  created_at: string | null;
  delivery_fee: number;
  subtotal: number;
  discount_amount?: number | null;
  promo_code?: string | null;
  loyalty_discount?: number | null;
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


const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [reordering, setReordering] = useState<string | null>(null);
  const { addItem } = useCart();

  const reorder = async (orderId: string) => {
    setReordering(orderId);
    const { data, error } = await supabase
      .from("order_items")
      .select("product_id, quantity_value, ordered_quantity_value, item_status, unavailable_policy, product:products(id, name, price, unit_type, image_url, category_id, is_active, stock_quantity)")
      .eq("order_id", orderId);
    setReordering(null);
    if (error || !data) { toast.error("Impossible de reprendre cette commande"); return; }
    const { lines, skipped } = buildReorderLines(data as never);
    if (lines.length === 0) { toast.error("Ces articles ne sont plus disponibles"); return; }
    for (const l of lines) {
      const policy = l.policy === "replace" || l.policy === "remove_item" ? (l.policy as ItemUnavailablePolicy) : undefined;
      addItem({ id: l.product.id, name: l.product.name, price: Number(l.product.price), unit_type: l.product.unit_type, image_url: l.product.image_url, category_id: l.product.category_id, unavailable_policy: policy }, l.quantity);
    }
    toast.success(skipped ? `Articles ajoutés au panier (${skipped} plus disponible${skipped > 1 ? "s" : ""})` : "Articles ajoutés au panier, aux prix du jour");
    navigate("/cart");
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSignedOut(true);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  };

  return (
    <div className="client-page min-h-screen bg-background">
      <CustomerHeader>
      <div className="brand-header sticky top-0 z-40 px-4 py-4 border-b-4 border-primary">
        <h1 className="text-xl font-bold">Mes Commandes</h1>
      </div>
      </CustomerHeader>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : signedOut ? (
          <div className="text-center py-20">
            <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">Connectez-vous pour voir vos commandes</h2>
            <p className="text-muted-foreground text-sm mb-6">Retrouvez ici le suivi de toutes vos commandes.</p>
            <Button onClick={() => navigate("/login?next=%2Forders")}>Se connecter</Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">Aucune commande</h2>
            <p className="text-muted-foreground text-sm">Vos commandes apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const baseInfo = statusLabels[order.status] || { label: order.status, variant: "secondary" as const };
              const info = order.delivery_mode === "pickup" && order.status === "delivered" ? { ...baseInfo, label: "Récupérée" } : order.delivery_mode === "pickup" && order.status === "ready" ? { ...baseInfo, label: "Prête à retirer" } : baseInfo;
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
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Sous-total: {formatPrice(order.subtotal)} · Livraison: {formatPrice(order.delivery_fee)}{order.discount_amount ? ` · Code ${order.promo_code} : -${formatPrice(order.discount_amount)}` : ""}{order.loyalty_discount ? ` · Points : -${formatPrice(order.loyalty_discount)}` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-primary">{formatPrice(order.total_price)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {(order.status === "delivered" || order.status === "cancelled") && (
                    <Button variant="outline" size="sm" className="mt-3 w-full" disabled={reordering === order.id}
                      onClick={(e) => { e.stopPropagation(); reorder(order.id); }}>
                      {reordering === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Recommander
                    </Button>
                  )}
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
