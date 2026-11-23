import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bike,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  Search,
  Store,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatPrice, getStatusInfo } from "@/lib/format";
import { canCancelAtCounter, nextStaffOrderAction } from "@/lib/staff-order-workflow";
import { toast } from "@/hooks/use-toast";

type StaffOrder = {
  id: string;
  user_id: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total_price: number;
  notes: string | null;
  created_at: string | null;
  delivery_mode: string;
  payment_method: string;
  cash_bill_amount: number | null;
  scheduled_for: string | null;
  delivery_address_snapshot: Record<string, unknown> | null;
  receipt_photo_path: string | null;
  receipt_uploaded_at: string | null;
  courier_called_at: string | null;
  profiles?: { name: string; email: string; phone: string | null } | null;
};

type StaffOrderItem = {
  id: string;
  product_name: string;
  quantity: string;
  unit_price: number;
  line_total: number;
};

const filters = [
  { value: "active", label: "En cours" },
  { value: "pending", label: "Nouvelles" },
  { value: "ready", label: "Prêtes" },
  { value: "finished", label: "Terminées" },
  { value: "all", label: "Toutes" },
];

const formatDate = (date: string | null) => date
  ? new Date(date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Casablanca",
    })
  : "—";

export default function StaffOrders() {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [items, setItems] = useState<StaffOrderItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [live, setLive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, profiles!user_id(name, email, phone)")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Commandes indisponibles", description: error.message, variant: "destructive" });
    } else {
      const nextOrders = (data ?? []) as unknown as StaffOrder[];
      setOrders(nextOrders);
      setSelectedOrder(current => current ? nextOrders.find(order => order.id === current.id) ?? null : null);
    }
    setLoading(false);
  }, []);

  const playAlert = useCallback(() => {
    const context = audioContextRef.current;
    if (!context || !soundEnabledRef.current) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.56);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel(`staff-orders-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, payload => {
        if (payload.eventType === "INSERT" && (payload.new as { status?: string }).status === "pending") {
          toast({ title: "Nouvelle commande !", description: "Ouvrez les nouvelles commandes pour la confirmer." });
          playAlert();
        }
        fetchOrders();
      })
      .subscribe(status => setLive(status === "SUBSCRIBED"));
    const polling = window.setInterval(fetchOrders, 30_000);
    return () => {
      window.clearInterval(polling);
      supabase.removeChannel(channel);
      audioContextRef.current?.close();
    };
  }, [fetchOrders, playAlert]);

  const enableSound = async () => {
    if (soundEnabled) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      return;
    }
    try {
      audioContextRef.current ??= new AudioContext();
      await audioContextRef.current.resume();
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      playAlert();
      toast({ title: "Alerte sonore activée", description: "Laissez cette page ouverte sur la tablette." });
    } catch {
      toast({ title: "Le son n’a pas pu être activé", variant: "destructive" });
    }
  };

  const loadReceipt = async (path: string | null) => {
    setReceiptUrl(null);
    if (!path) return;
    const { data, error } = await supabase.storage.from("order-receipts").createSignedUrl(path, 3600);
    if (!error) setReceiptUrl(data.signedUrl);
  };

  const openDetail = async (order: StaffOrder) => {
    setSelectedOrder(order);
    setItems([]);
    setDetailOpen(true);
    setDetailLoading(true);
    const [{ data },] = await Promise.all([
      supabase.from("order_items").select("id, product_name, quantity, unit_price, line_total").eq("order_id", order.id),
      loadReceipt(order.receipt_photo_path),
    ]);
    setItems((data ?? []) as StaffOrderItem[]);
    setDetailLoading(false);
  };

  const uploadReceipt = async (file: File | undefined) => {
    if (!file || !selectedOrder) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      toast({ title: "Choisissez une photo de moins de 8 Mo", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${selectedOrder.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("order-receipts").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { error: attachError } = await supabase.rpc("attach_order_receipt", {
        _order_id: selectedOrder.id,
        _photo_path: path,
      });
      if (attachError) throw attachError;
      toast({ title: "Ticket enregistré", description: "Vous pouvez maintenant déclarer la commande prête." });
      await fetchOrders();
      await loadReceipt(path);
    } catch (error) {
      toast({ title: "Photo non enregistrée", description: error instanceof Error ? error.message : "Réessayez", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const performAction = async () => {
    if (!selectedOrder) return;
    const action = nextStaffOrderAction(selectedOrder);
    if (!action || action.kind === "blocked") return;
    setSaving(true);
    try {
      if (action.kind === "courier") {
        const { error } = await supabase.rpc("mark_order_courier_called", { _order_id: selectedOrder.id });
        if (error) throw error;
        toast({ title: "Appel enregistré", description: "À son arrivée, remettez la commande et le ticket papier au livreur." });
      } else {
        const { error } = await supabase.rpc("update_staff_order_status", {
          _order_id: selectedOrder.id,
          _new_status: action.status,
        });
        if (error) throw error;
        if (["confirmed", "ready", "delivering", "delivered"].includes(action.status)) {
          void supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: selectedOrder.user_id,
              title: "Mise à jour de commande",
              body: "Votre commande a été mise à jour.",
              data: { order_id: selectedOrder.id },
            },
          }).catch(() => undefined);
        }
        toast({ title: action.status === "delivering" ? "Commande remise au livreur" : "Statut mis à jour" });
      }
      await fetchOrders();
    } catch (error) {
      toast({ title: "Action refusée", description: error instanceof Error ? error.message : "Réessayez", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder || !window.confirm("Confirmer l’annulation de cette commande ?")) return;
    setSaving(true);
    const { error } = await supabase.rpc("update_staff_order_status", {
      _order_id: selectedOrder.id,
      _new_status: "cancelled",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Annulation refusée", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Commande annulée" });
    await fetchOrders();
  };

  const filtered = orders.filter(order => {
    const matchesFilter = filter === "all"
      || (filter === "active" && !["delivered", "cancelled"].includes(order.status))
      || (filter === "finished" && ["delivered", "cancelled"].includes(order.status))
      || order.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term
      || order.id.toLowerCase().includes(term)
      || (order.profiles?.name ?? "").toLowerCase().includes(term)
      || (order.profiles?.phone ?? "").includes(term);
    return matchesFilter && matchesSearch;
  });

  const nextAction = selectedOrder ? nextStaffOrderAction(selectedOrder) : null;
  const pendingCount = orders.filter(order => order.status === "pending").length;
  const activeCount = orders.filter(order => !["delivered", "cancelled"].includes(order.status)).length;

  if (loading) {
    return <div className="h-64 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl">Commandes application</h1>
            {pendingCount > 0 && <Badge className="h-7 px-3 text-sm">{pendingCount} nouvelle{pendingCount > 1 ? "s" : ""}</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-success" : "bg-warning"}`} />
            {live ? "Réception en direct" : "Actualisation automatique"} · {activeCount} en cours
          </p>
        </div>
        <Button variant={soundEnabled ? "secondary" : "default"} size="lg" onClick={enableSound}>
          {soundEnabled ? <Volume2 /> : <VolumeX />}
          {soundEnabled ? "Alerte activée" : "Activer l’alerte"}
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Client, téléphone ou numéro…" className="h-12 pl-10" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(item => (
            <Button key={item.value} variant={filter === item.value ? "default" : "outline"} className="shrink-0" onClick={() => setFilter(item.value)}>
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="grid min-h-56 place-items-center p-8 text-center">
          <div><PackageCheck className="mx-auto mb-3 h-12 w-12 text-muted-foreground" /><p className="font-semibold">Aucune commande dans cette rubrique</p><p className="text-sm text-muted-foreground">Les nouvelles commandes apparaîtront automatiquement ici.</p></div>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(order => {
            const status = getStatusInfo(order.status);
            return (
              <Card key={order.id} className={`app-card overflow-hidden ${order.status === "pending" ? "border-primary" : ""}`}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <h2 className="mt-1 font-sans text-xl font-bold">{order.profiles?.name || "Client"}</h2>
                    </div>
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />{formatDate(order.created_at)}</span>
                    <span className="text-lg font-bold text-primary">{formatPrice(order.total_price)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{order.delivery_mode === "pickup" ? <Store className="mr-1 h-3 w-3" /> : <Bike className="mr-1 h-3 w-3" />}{order.delivery_mode === "pickup" ? "Retrait" : "Livraison"}</Badge>
                    {order.receipt_photo_path && <Badge variant="outline" className="border-success/40 text-success"><ReceiptText className="mr-1 h-3 w-3" />Ticket photographié</Badge>}
                    {order.courier_called_at && <Badge variant="outline"><Phone className="mr-1 h-3 w-3" />Livreur appelé</Badge>}
                  </div>
                  <Button className="w-full" variant={order.status === "pending" ? "default" : "outline"} onClick={() => openDetail(order)}>
                    Ouvrir la commande
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl p-4 sm:p-6">
          {selectedOrder && <>
            <DialogHeader className="pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="font-sans text-xl">Commande #{selectedOrder.id.slice(0, 8).toUpperCase()}</DialogTitle>
                <Badge className={getStatusInfo(selectedOrder.status).color}>{getStatusInfo(selectedOrder.status).label}</Badge>
              </div>
              <DialogDescription>{formatDate(selectedOrder.created_at)} · {selectedOrder.delivery_mode === "pickup" ? "Retrait en boutique" : "Livraison par coursier"}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Client</p>
                <p className="mt-1 font-bold">{selectedOrder.profiles?.name}</p>
                {selectedOrder.profiles?.phone && <button type="button" className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary" onClick={() => { window.location.href = `tel:${selectedOrder.profiles?.phone}`; }}><Phone className="h-4 w-4" />{selectedOrder.profiles.phone}</button>}
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Paiement</p>
                <p className="mt-1 font-bold">{selectedOrder.payment_method === "cash" ? "Espèces" : selectedOrder.payment_method === "on_site" ? "Sur place" : "Carte bancaire"}</p>
                <p className="text-sm text-muted-foreground">Total : <span className="font-bold text-primary">{formatPrice(selectedOrder.total_price)}</span></p>
                {selectedOrder.payment_method === "cash" && selectedOrder.delivery_mode !== "pickup" && (
                  <p className="mt-1 text-sm font-semibold text-success">Le coursier règle à la boutique, puis se fait payer par le client.</p>
                )}
                {selectedOrder.payment_method === "card" && <p className="mt-1 text-sm text-muted-foreground">Paiement reçu ultérieurement selon le flux de règlement.</p>}
              </div>
            </div>

            {selectedOrder.delivery_mode !== "pickup" && selectedOrder.delivery_address_snapshot && (
              <div className="flex gap-2 rounded-lg bg-muted p-3 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{String(selectedOrder.delivery_address_snapshot.full_address ?? selectedOrder.delivery_address_snapshot.address ?? "Adresse enregistrée")}</span></div>
            )}
            {selectedOrder.notes && <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"><strong>Note du client :</strong> {selectedOrder.notes}</div>}

            <div className="overflow-hidden rounded-lg border">
              {detailLoading ? <div className="grid h-24 place-items-center"><Loader2 className="animate-spin" /></div> : items.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b p-3 text-sm last:border-0">
                  <div className="min-w-0"><p className="font-semibold">{item.product_name}</p><p className="text-muted-foreground">{item.quantity} × {formatPrice(item.unit_price)}</p></div>
                  <span className="shrink-0 font-bold">{formatPrice(item.line_total)}</span>
                </div>
              ))}
            </div>

            {selectedOrder.status !== "pending" && selectedOrder.status !== "cancelled" && (
              <section className="space-y-3 rounded-xl border-2 border-primary/30 bg-card p-4">
                <div className="flex items-start gap-3">
                  <ReceiptText className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <div><h3 className="font-sans text-lg font-bold">Ticket de caisse</h3><p className="text-sm text-muted-foreground">Saisissez la vente dans Chez Mima Gestion, imprimez le ticket puis photographiez-le ici.</p></div>
                </div>
                {receiptUrl ? (
                  <div className="space-y-2">
                    <button type="button" onClick={() => window.open(receiptUrl, "_blank", "noopener,noreferrer")} className="block w-full overflow-hidden rounded-lg border bg-muted">
                      <img src={receiptUrl} alt="Ticket de caisse photographié" className="mx-auto max-h-72 object-contain" />
                    </button>
                    <div className="flex items-center justify-between gap-2 text-sm text-success"><span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Photo enregistrée</span><button type="button" onClick={() => window.open(receiptUrl, "_blank", "noopener,noreferrer")} className="flex items-center gap-1 text-primary">Agrandir<ExternalLink className="h-3 w-3" /></button></div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-warning/10 p-3 text-sm font-semibold text-warning">La photo est obligatoire avant « Commande prête ».</div>
                )}
                {["confirmed", "preparing", "ready"].includes(selectedOrder.status) && (
                  <>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => uploadReceipt(event.target.files?.[0])} />
                    <Button type="button" variant="outline" className="w-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                      {uploading ? <Loader2 className="animate-spin" /> : <Camera />}{uploading ? "Enregistrement…" : receiptUrl ? "Reprendre la photo" : "Prendre la photo du ticket"}
                    </Button>
                  </>
                )}
              </section>
            )}

            {selectedOrder.status === "ready" && selectedOrder.delivery_mode !== "pickup" && (
              <div className="rounded-xl border bg-muted p-4 text-sm">
                <p className="flex items-center gap-2 font-bold"><Bike className="h-5 w-5 text-primary" />Livraison par votre coursier</p>
                {!selectedOrder.courier_called_at
                  ? <p className="mt-1 text-muted-foreground">Appelez votre coursier habituel, puis confirmez l’appel ci-dessous.</p>
                  : <p className="mt-1 font-semibold text-success">Livreur appelé. Remettez-lui la commande et le ticket papier, puis confirmez le départ.</p>}
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              {nextAction && (
                <Button size="lg" className="h-14 w-full text-base" disabled={saving || nextAction.kind === "blocked"} onClick={performAction}>
                  {saving ? <Loader2 className="animate-spin" /> : nextAction.kind === "courier" ? <Phone /> : nextAction.kind === "blocked" ? <Camera /> : <Check />}
                  {nextAction.label}
                </Button>
              )}
              {canCancelAtCounter(selectedOrder.status) && <Button variant="ghost" className="w-full text-destructive" disabled={saving} onClick={cancelOrder}>Annuler la commande</Button>}
              {!nextAction && <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Aucune action restante</p>}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
