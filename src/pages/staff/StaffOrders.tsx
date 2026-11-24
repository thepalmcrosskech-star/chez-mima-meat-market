import { useCallback, useEffect, useRef, useState } from "react";
import {
  Banknote,
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
import { canAdjustItems, canCancelAtCounter, nextStaffOrderAction, staffOrderSteps, unavailablePolicyLabel } from "@/lib/staff-order-workflow";
import { getWeightOptions, isWeightUnit } from "@/lib/product-units";
import { formatCartQuantity } from "@/lib/cart-display";
import { toast } from "@/hooks/use-toast";
import { canReplaceArticle } from "@/lib/item-unavailable-policy";
import OrderDeliveryAddress from "@/components/OrderDeliveryAddress";

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
  unavailable_policy: string;
  availability_checked_at: string | null;
  payment_confirmed_at: string | null;
  profiles?: { name: string; email: string; phone: string | null } | null;
};

type StaffOrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: string;
  quantity_value: number;
  unit_price: number;
  line_total: number;
  item_status: string;
  original_product_name: string | null;
  ordered_quantity_value: number | null;
  unavailable_policy: string | null;
};

type CatalogueProduct = { id: string; name: string; price: number; unit_type: string; category_id: string | null };

const filters = [
  { value: "pending", label: "Nouvelles commandes" },
  { value: "active", label: "Commandes en cours" },
  { value: "finished", label: "Récupérées" },
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
  const [filter, setFilter] = useState("pending");
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
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [replacing, setReplacing] = useState<StaffOrderItem | null>(null);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceProduct, setReplaceProduct] = useState<CatalogueProduct | null>(null);
  const [replaceQuantity, setReplaceQuantity] = useState(1);
  const [clientAgreed, setClientAgreed] = useState(false);
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
          toast({ title: "Nouvelle commande !", description: "Ouvrez les nouvelles commandes pour l’accepter." });
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

  const loadItems = async (orderId: string) => {
    const { data } = await supabase
      .from("order_items")
      .select("id, product_id, product_name, quantity, quantity_value, unit_price, line_total, item_status, original_product_name, ordered_quantity_value, unavailable_policy")
      .eq("order_id", orderId)
      .order("created_at");
    setItems((data ?? []) as StaffOrderItem[]);
  };

  const openDetail = async (order: StaffOrder) => {
    setSelectedOrder(order);
    setItems([]);
    setDetailOpen(true);
    setDetailLoading(true);
    await Promise.all([loadItems(order.id), loadReceipt(order.receipt_photo_path)]);
    setDetailLoading(false);
  };

  const removeItem = async (item: StaffOrderItem) => {
    if (!selectedOrder || !window.confirm(`Retirer « ${item.product_name} » de la commande ? Le client sera prévenu.`)) return;
    setSaving(true);
    const { error } = await supabase.rpc("staff_remove_order_item", { _item_id: item.id });
    setSaving(false);
    if (error) {
      toast({ title: "Article non retiré", description: error.message, variant: "destructive" });
      return;
    }
    pushLatestNotification(selectedOrder);
    toast({ title: "Article retiré", description: "Le total a été recalculé et le client prévenu." });
    await Promise.all([fetchOrders(), loadItems(selectedOrder.id)]);
  };

  const openReplace = async (item: StaffOrderItem) => {
    setReplacing(item);
    setReplaceSearch("");
    setReplaceProduct(null);
    setClientAgreed(false);
    if (catalogue.length === 0) {
      const { data } = await supabase.from("products").select("id, name, price, unit_type, category_id").eq("is_active", true).order("name");
      setCatalogue((data ?? []) as CatalogueProduct[]);
    }
  };

  const chooseReplacement = (product: CatalogueProduct) => {
    setReplaceProduct(product);
    setClientAgreed(false);
    if (!replacing) return;
    if (isWeightUnit(product.unit_type)) {
      const options = getWeightOptions(product.category_id).map(option => option.value);
      const same = options.find(value => value === Number(replacing.quantity_value));
      setReplaceQuantity(same ?? options[0]);
    } else {
      setReplaceQuantity(Math.max(1, Math.round(Number(replacing.quantity_value))));
    }
  };

  const confirmReplace = async () => {
    if (!replacing || !replaceProduct || !selectedOrder) return;
    setSaving(true);
    const { error } = await supabase.rpc("staff_replace_order_item", {
      _item_id: replacing.id,
      _product_id: replaceProduct.id,
      _quantity_value: replaceQuantity,
      _client_agreed: clientAgreed,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Remplacement refusé", description: error.message, variant: "destructive" });
      return;
    }
    pushLatestNotification(selectedOrder);
    toast({ title: "Article remplacé", description: "Le client a été prévenu." });
    setReplacing(null);
    await Promise.all([fetchOrders(), loadItems(selectedOrder.id)]);
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
    if (!window.confirm(`Confirmer : ${action.label} ?`)) return;
    setSaving(true);
    try {
      if (action.kind === "availability") {
        const { error } = await supabase.rpc("staff_confirm_availability", { _order_id: selectedOrder.id });
        if (error) throw error;
        toast({ title: "Articles validés", description: "Saisissez la vente dans Chez Mima Gestion puis photographiez le ticket." });
      } else if (action.kind === "payment") {
        const { error } = await supabase.rpc("staff_confirm_payment", { _order_id: selectedOrder.id });
        if (error) throw error;
        toast({ title: "Règlement enregistré" });
      } else if (action.kind === "courier") {
        const { error } = await supabase.rpc("mark_order_courier_called", { _order_id: selectedOrder.id });
        if (error) throw error;
        toast({ title: "Appel enregistré", description: "À son arrivée, remettez la commande et le ticket papier au livreur." });
      } else {
        const { error } = await supabase.rpc("update_staff_order_status", {
          _order_id: selectedOrder.id,
          _new_status: action.status,
        });
        if (error) throw error;
        if (["confirmed", "preparing", "ready", "delivering", "delivered"].includes(action.status)) {
          void supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: selectedOrder.user_id,
              title: "Mise à jour de commande",
              body: "Votre commande a été mise à jour.",
              data: { order_id: selectedOrder.id },
            },
          }).catch(() => undefined);
        }
        if (action.status === "delivered") setDetailOpen(false);
        toast({ title: action.status === "delivering" ? "Commande remise au livreur" : "Statut mis à jour" });
      }
      await Promise.all([fetchOrders(), loadItems(selectedOrder.id)]);
    } catch (error) {
      toast({ title: "Action refusée", description: error instanceof Error ? error.message : "Réessayez", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const pushLatestNotification = (order: { id: string; user_id: string }) => {
    void supabase.functions.invoke("send-push-notification", {
      body: { user_id: order.user_id, title: "", body: "", data: { order_id: order.id, latest_notification: true } },
    }).catch(() => undefined);
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
    void supabase.functions.invoke("send-push-notification", {
      body: { user_id: selectedOrder.user_id, title: "", body: "", data: { order_id: selectedOrder.id } },
    }).catch(() => undefined);
    setDetailOpen(false);
    toast({ title: "Commande annulée", description: "Elle est rangée dans « Récupérées »." });
    await fetchOrders();
  };

  const filtered = orders.filter(order => {
    const matchesFilter = (filter === "active" && !["pending", "delivered", "cancelled"].includes(order.status))
      || (filter === "finished" && ["delivered", "cancelled"].includes(order.status))
      || (filter === "preparation" && ["confirmed", "preparing"].includes(order.status))
      || order.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term
      || order.id.toLowerCase().includes(term)
      || (order.profiles?.name ?? "").toLowerCase().includes(term)
      || (order.profiles?.phone ?? "").includes(term);
    return matchesFilter && matchesSearch;
  });

  const nextAction = selectedOrder ? nextStaffOrderAction(selectedOrder) : null;
  const adjustable = selectedOrder ? canAdjustItems(selectedOrder) : false;
  const replacementPrice = replaceProduct ? Math.round(replaceProduct.price * replaceQuantity * 100) / 100 : null;
  const priceChanges = replacing && replacementPrice !== null && replacementPrice !== Math.round(Number(replacing.line_total) * 100) / 100;
  const replaceMatches = catalogue
    .filter(product => product.id !== replacing?.product_id && !items.some(item => item.product_id === product.id && item.item_status !== "removed"))
    .filter(product => !replaceSearch.trim() || product.name.toLowerCase().includes(replaceSearch.trim().toLowerCase()))
    .slice(0, 30);
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

            {selectedOrder.status !== "cancelled" && (
              <ol className="flex flex-wrap gap-2" aria-label="Étapes de la commande">
                {staffOrderSteps(selectedOrder).map(step => (
                  <li key={step.label} className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${step.done ? "border-success/40 bg-success/10 text-success" : "text-muted-foreground"}`}>
                    {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}{step.label}
                  </li>
                ))}
              </ol>
            )}

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              {items.some(item => item.unavailable_policy === null) && <p><strong>Consigne des anciens articles :</strong> {unavailablePolicyLabel(selectedOrder.unavailable_policy)}</p>}
              <p className="mt-1 text-muted-foreground">Si le remplacement n’a pas le même prix, appelez toujours le client avant de modifier.</p>
            </div>

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
                {selectedOrder.delivery_mode !== "pickup" && (
                  <p className="mt-1 text-sm font-semibold text-success">Aucun règlement du coursier à la boutique. Glovo encaisse le client et vous règle par virement deux fois par mois, en espèces comme par carte.</p>
                )}
                {selectedOrder.delivery_mode === "pickup" && selectedOrder.payment_method === "card" && <p className="mt-1 text-sm text-muted-foreground">Paiement reçu ultérieurement selon le flux de règlement.</p>}
              </div>
            </div>

            {selectedOrder.delivery_mode !== "pickup" && selectedOrder.delivery_address_snapshot && (
              <OrderDeliveryAddress snapshot={selectedOrder.delivery_address_snapshot} />
            )}
            {selectedOrder.notes && <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"><strong>Note du client :</strong> {selectedOrder.notes}</div>}

            <div className="overflow-hidden rounded-lg border">
              {detailLoading ? <div className="grid h-24 place-items-center"><Loader2 className="animate-spin" /></div> : items.map(item => {
                const removed = item.item_status === "removed";
                return (
                  <div key={item.id} className={`space-y-2 border-b p-3 text-sm last:border-0 ${removed ? "bg-muted/60" : ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`font-semibold ${removed ? "line-through text-muted-foreground" : ""}`}>{item.product_name}</p>
                        <p className="text-muted-foreground">{formatCartQuantity(Number(item.quantity_value), item.quantity.endsWith("kg") ? "weight" : "piece")} × {formatPrice(item.unit_price)}</p>
                        {item.item_status === "replaced" && <p className="text-xs font-semibold text-warning">Remplace : {item.original_product_name}</p>}
                        {removed && <p className="text-xs font-semibold text-destructive">Retiré (indisponible)</p>}
                        <p className="mt-1 text-xs font-semibold">Si indisponible : {unavailablePolicyLabel(item.unavailable_policy ?? selectedOrder.unavailable_policy)}</p>
                      </div>
                      <span className={`shrink-0 font-bold ${removed ? "line-through text-muted-foreground" : ""}`}>{formatPrice(item.line_total)}</span>
                    </div>
                    {adjustable && !removed && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" disabled={saving || !canReplaceArticle(item.unavailable_policy)} onClick={() => openReplace(item)}>Remplacer</Button>
                        <Button variant="outline" size="sm" className="text-destructive" disabled={saving} onClick={() => removeItem(item)}>Retirer</Button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-between bg-muted/40 p-3 font-bold"><span>{selectedOrder.delivery_mode === "pickup" ? "Total à encaisser" : "Total de la commande"}</span><span className="text-primary">{formatPrice(selectedOrder.total_price)}</span></div>
            </div>

            {adjustable && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-semibold text-warning">
                Préparez les articles. En cas de rupture, suivez la consigne du client, puis validez les articles avant de passer en caisse.
              </div>
            )}

            {selectedOrder.availability_checked_at && selectedOrder.status !== "cancelled" && (
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
                {["preparing", "ready"].includes(selectedOrder.status) && (
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
                  : <p className="mt-1 font-semibold text-success">Remettez-lui la commande et le ticket papier sans encaisser le coursier, puis confirmez le départ.</p>}
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              {nextAction && (
                <Button size="lg" className="h-14 w-full text-base" disabled={saving || nextAction.kind === "blocked"} onClick={performAction}>
                  {saving ? <Loader2 className="animate-spin" /> : nextAction.kind === "courier" ? <Phone /> : nextAction.kind === "blocked" ? <Camera /> : nextAction.kind === "payment" ? <Banknote /> : <Check />}
                  {nextAction.label}
                </Button>
              )}
              {canCancelAtCounter(selectedOrder.status) && <Button variant="ghost" className="w-full text-destructive" disabled={saving} onClick={cancelOrder}>Annuler la commande</Button>}
              {!nextAction && <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Aucune action restante</p>}
            </div>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(replacing)} onOpenChange={open => { if (!open) setReplacing(null); }}>
        <DialogContent className="max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl">Remplacer « {replacing?.product_name} »</DialogTitle>
            <DialogDescription>Choisissez un article similaire disponible.</DialogDescription>
          </DialogHeader>
          {(replacing?.unavailable_policy ?? selectedOrder?.unavailable_policy) !== "replace" && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-semibold text-warning">Le client a demandé : {unavailablePolicyLabel(replacing?.unavailable_policy ?? selectedOrder?.unavailable_policy ?? "call")}. Appelez-le avant de remplacer.</p>
          )}
          <Input value={replaceSearch} onChange={event => setReplaceSearch(event.target.value)} placeholder="Rechercher un produit…" className="h-12" />
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
            {replaceMatches.map(product => (
              <Button key={product.id} variant={replaceProduct?.id === product.id ? "default" : "ghost"} className="h-auto w-full justify-between whitespace-normal py-2 text-left" onClick={() => chooseReplacement(product)}>
                <span>{product.name}</span>
                <span className="shrink-0 text-xs">{formatPrice(product.price)}/{isWeightUnit(product.unit_type) ? "kg" : "pièce"}</span>
              </Button>
            ))}
            {replaceMatches.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Aucun produit trouvé</p>}
          </div>
          {replaceProduct && (
            <div className="space-y-3">
              {isWeightUnit(replaceProduct.unit_type) ? (
                <div className="grid grid-cols-4 gap-2">
                  {getWeightOptions(replaceProduct.category_id).map(option => (
                    <Button key={option.value} variant={replaceQuantity === option.value ? "default" : "secondary"} onClick={() => { setReplaceQuantity(option.value); setClientAgreed(false); }}>{option.label}</Button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <Button variant="secondary" disabled={replaceQuantity <= 1} onClick={() => { setReplaceQuantity(q => Math.max(1, q - 1)); setClientAgreed(false); }}>−</Button>
                  <span className="min-w-12 text-center text-lg font-bold">{replaceQuantity}</span>
                  <Button variant="secondary" onClick={() => { setReplaceQuantity(q => q + 1); setClientAgreed(false); }}>+</Button>
                </div>
              )}
              <p className="text-sm">Ancien prix : <strong>{formatPrice(Number(replacing?.line_total ?? 0))}</strong> · Nouveau prix : <strong className="text-primary">{formatPrice(replacementPrice ?? 0)}</strong></p>
              {priceChanges && (
                <label className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-semibold">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={clientAgreed} onChange={event => setClientAgreed(event.target.checked)} />
                  Le prix change : j’ai appelé le client et il accepte ce remplacement.
                </label>
              )}
            </div>
          )}
          <Button size="lg" className="h-14 w-full" disabled={!replaceProduct || saving || (priceChanges && !clientAgreed)} onClick={confirmReplace}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}Confirmer le remplacement
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
