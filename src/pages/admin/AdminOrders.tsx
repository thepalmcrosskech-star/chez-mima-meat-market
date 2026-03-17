import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Eye, Search, Bike, ShieldBan, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice, statusOptions, getStatusInfo } from "@/lib/format";

interface DriverProfile {
  id: string;
  user_id: string;
  profiles: { name: string } | null;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total_price: number;
  notes: string | null;
  created_at: string | null;
  driver_id: string | null;
  payment_method: string;
  cash_bill_amount: number | null;
  delivery_mode: string;
  scheduled_for: string | null;
  profiles?: { name: string; email: string; phone: string | null };
  delivery_address_snapshot?: any;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: string;
  unit_price: number;
  line_total: number;
}


const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [ordersRes, driversRes] = await Promise.all([
      supabase.from("orders").select("*, profiles(name, email, phone)").order("created_at", { ascending: false }),
      supabase.from("driver_profiles").select("id, user_id, profiles(name)"),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data as Order[]);
    if (driversRes.data) setDrivers(driversRes.data as unknown as DriverProfile[]);
    setLoading(false);
  };

  const openDetail = async (order: Order) => {
    setSelectedOrder(order);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", order.id);
    setOrderItems((data || []) as OrderItem[]);
    setDetailOpen(true);
  };

  const updateStatus = async (orderId: string, status: string) => {
    const order = orders.find(o => o.id === orderId);
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }

    // Send in-app notification to the client
    if (order) {
      const statusLabel = (await import("@/lib/format")).getStatusInfo(status).label;
      const notifMessages: Record<string, { title: string; message: string }> = {
        confirmed: { title: "Commande confirmée ✅", message: "Votre commande a été confirmée et sera bientôt préparée." },
        preparing: { title: "En préparation 🍖", message: "Votre commande est en cours de préparation." },
        ready: { title: "Commande prête ! 🎉", message: "Votre commande est prête. Vous pouvez venir la récupérer en boucherie." },
        delivering: { title: "En livraison 🚚", message: "Votre commande est en route !" },
        delivered: { title: "Commande livrée ✅", message: "Votre commande a été livrée. Bon appétit !" },
        cancelled: { title: "Commande annulée ❌", message: "Votre commande a été annulée." },
      };
      const notif = notifMessages[status];
      if (notif) {
        // In-app notification
        await (supabase as any).from("notifications").insert({
          user_id: order.user_id,
          order_id: orderId,
          title: notif.title,
          message: notif.message,
        });

        // External push notification for key statuses
        const pushStatuses = ['confirmed', 'delivering', 'delivered', 'ready'];
        if (pushStatuses.includes(status)) {
          supabase.functions.invoke('send-push-notification', {
            body: {
              user_id: order.user_id,
              title: notif.title,
              body: notif.message,
              data: { order_id: orderId },
            },
          }).catch(err => console.error('Push notification failed:', err));
        }
      }
    }

    toast({ title: "Statut mis à jour" });
    fetchData();
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase.from("orders").update({ driver_id: driverId === "none" ? null : driverId }).eq("id", orderId);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Livreur assigné" }); fetchData(); }
  };


  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const matchSearch = !search || (o.profiles?.name || "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Commandes</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par client..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Livreur</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const info = getStatusInfo(o.status);
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{o.profiles?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{o.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                        {o.scheduled_for && (
                          <Badge variant="outline" className="w-fit text-[10px] gap-1 border-amber-500/50 text-amber-500">
                            <Clock className="h-3 w-3" />
                            Programmée {new Date(o.scheduled_for).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">{formatPrice(o.total_price)}</TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                        <SelectTrigger className={`w-[150px] text-xs font-medium ${info.color} border-0`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={o.driver_id || "none"} onValueChange={(v) => assignDriver(o.id, v)}>
                        <SelectTrigger className="w-[140px] text-xs">
                          <SelectValue placeholder="Aucun" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {drivers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              <span className="flex items-center gap-1"><Bike className="h-3 w-3" /> {d.profiles?.name || "Livreur"}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(o)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune commande</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Détail de la commande</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Client</p><p className="font-medium">{selectedOrder.profiles?.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Téléphone</p><p className="font-medium">{selectedOrder.profiles?.phone || "—"}</p></div>
              </div>
              {selectedOrder.notes && <div><p className="text-xs text-muted-foreground">Notes</p><p className="text-sm">{selectedOrder.notes}</p></div>}

              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatPrice(item.line_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{selectedOrder.delivery_mode === "pickup" ? "🏪 Click & Collect" : "🚚 Livraison"}</span></div>
                {selectedOrder.scheduled_for && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Programmée pour</span>
                    <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-500">
                      <Clock className="h-3 w-3" />
                      {new Date(selectedOrder.scheduled_for).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })}
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span>{formatPrice(selectedOrder.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Livraison</span><span>{selectedOrder.delivery_fee === 0 ? "Gratuit" : formatPrice(selectedOrder.delivery_fee)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t border-border pt-2"><span>Total</span><span className="text-primary">{formatPrice(selectedOrder.total_price)}</span></div>
              </div>

              {/* Cash payment info for driver */}
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">💳 Paiement</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Méthode</span>
                  <Badge variant={selectedOrder.payment_method === "cash" ? "secondary" : selectedOrder.payment_method === "on_site" ? "outline" : "default"}>
                    {selectedOrder.payment_method === "cash" ? "Espèces" : selectedOrder.payment_method === "on_site" ? "Sur place" : "CB (CMI)"}
                  </Badge>
                </div>
                {selectedOrder.payment_method === "cash" && (
                  <>
                    {selectedOrder.cash_bill_amount ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Montant remis</span>
                          <span className="font-semibold">{formatPrice(selectedOrder.cash_bill_amount)}</span>
                        </div>
                        {selectedOrder.cash_bill_amount > selectedOrder.total_price && (
                          <div className="flex justify-between text-sm font-bold text-amber-500">
                            <span>💰 Monnaie à rendre</span>
                            <span>{formatPrice(selectedOrder.cash_bill_amount - selectedOrder.total_price)}</span>
                          </div>
                        )}
                        {selectedOrder.cash_bill_amount === selectedOrder.total_price && (
                          <p className="text-xs text-green-500 font-medium">✅ Montant exact</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-green-500 font-medium">✅ Le client paiera l'appoint</p>
                    )}
                  </>
                )}
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-4"
                onClick={() => setBanDialogOpen(true)}
              >
                <ShieldBan className="h-4 w-4 mr-2" />
                Bannir l'IP du client
              </Button>

              <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bannir les IP de {selectedOrder.profiles?.name || 'ce client'} ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action bloquera l'accès depuis tous les appareils utilisés par ce compte. Cette action est irréversible depuis cette interface.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.functions.invoke('ip-manager', {
                            body: { action: 'ban', user_id: selectedOrder.user_id, reason: 'Fausse commande' },
                          });
                          if (error) throw error;
                          if (data?.banned > 0) {
                            toast({ title: "IP bannies", description: `${data.banned} adresse(s) IP bannie(s) pour ce client.` });
                          } else {
                            toast({ title: "Aucune IP trouvée", description: "Aucune adresse IP n'est associée à ce compte.", variant: "destructive" });
                          }
                        } catch (err: any) {
                          toast({ title: "Erreur", description: err.message, variant: "destructive" });
                        }
                      }}
                    >
                      Confirmer le bannissement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
