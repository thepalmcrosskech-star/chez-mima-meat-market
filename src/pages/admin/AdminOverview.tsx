import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Package, Users, Truck, TrendingUp, DollarSign } from "lucide-react";

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    revenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [ordersRes, productsRes, usersRes, driversRes, recentRes] = await Promise.all([
      supabase.from("orders").select("id, status, total_price"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
      supabase.from("driver_profiles").select("id, status"),
      supabase.from("orders").select("*, profiles!user_id(name, email)").order("created_at", { ascending: false }).limit(5),
    ]);

    const orders = ordersRes.data || [];
    const drivers = driversRes.data || [];

    setStats({
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      totalProducts: productsRes.count || 0,
      totalUsers: usersRes.count || 0,
      totalDrivers: drivers.length,
      availableDrivers: drivers.filter((d) => d.status === "available").length,
      revenue: orders.reduce((sum, o) => sum + (o.total_price || 0), 0),
    });
    setRecentOrders(recentRes.data || []);
    setLoading(false);
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";

  const statCards = [
    { label: "Commandes", value: stats.totalOrders, icon: ShoppingBag, color: "text-primary" },
    { label: "En attente", value: stats.pendingOrders, icon: TrendingUp, color: "text-warning" },
    { label: "Produits", value: stats.totalProducts, icon: Package, color: "text-success" },
    { label: "Utilisateurs", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Livreurs", value: stats.totalDrivers, icon: Truck, color: "text-primary" },
    { label: "Revenus", value: formatPrice(stats.revenue), icon: DollarSign, color: "text-success" },
  ];

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmée",
    preparing: "En préparation",
    ready: "Prête",
    delivering: "En livraison",
    delivered: "Livrée",
    cancelled: "Annulée",
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="animate-slide-up">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commandes récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune commande</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                  <div>
                    <p className="font-medium">{(order.profiles as any)?.name || "Client"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatPrice(order.total_price)}</p>
                    <p className="text-xs text-muted-foreground">{statusLabels[order.status] || order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
