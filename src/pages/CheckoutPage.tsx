import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Loader2, Plus, Check } from "lucide-react";
import AddressPicker from "@/components/AddressPicker";

interface SavedAddress {
  id: string;
  label: string | null;
  full_address: string;
  latitude: number;
  longitude: number;
  delivery_zone_id: string | null;
  is_default: boolean | null;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  free_delivery_threshold: number | null;
  polygon: any;
  is_active: boolean | null;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";

function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();

  const [userId, setUserId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<{ full_address: string; latitude: number; longitude: number } | null>(null);
  const [addressLabel, setAddressLabel] = useState("Maison");
  const [apartment, setApartment] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (items.length === 0) { navigate("/cart"); return; }
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUserId(user.id);

    const [addrRes, zonesRes] = await Promise.all([
      supabase.from("user_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
      supabase.from("delivery_zones").select("*").eq("is_active", true),
    ]);

    if (addrRes.data) {
      setSavedAddresses(addrRes.data);
      const defaultAddr = addrRes.data.find((a) => a.is_default);
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
    }
    if (zonesRes.data) setZones(zonesRes.data);
    setLoading(false);
  };

  const findZone = (lat: number, lng: number): DeliveryZone | null => {
    for (const zone of zones) {
      const poly = Array.isArray(zone.polygon) ? zone.polygon : [];
      if (poly.length > 0 && pointInPolygon(lat, lng, poly as number[][])) return zone;
    }
    return null;
  };

  const getSelectedAddress = (): SavedAddress | null => {
    if (selectedAddressId) return savedAddresses.find((a) => a.id === selectedAddressId) || null;
    return null;
  };

  const getDeliveryInfo = () => {
    const addr = getSelectedAddress();
    if (addr) {
      const zone = findZone(addr.latitude, addr.longitude);
      return { zone, fee: zone ? (zone.free_delivery_threshold && subtotal >= zone.free_delivery_threshold ? 0 : zone.delivery_fee) : null };
    }
    if (newAddress) {
      const zone = findZone(newAddress.latitude, newAddress.longitude);
      return { zone, fee: zone ? (zone.free_delivery_threshold && subtotal >= zone.free_delivery_threshold ? 0 : zone.delivery_fee) : null };
    }
    return { zone: null, fee: null };
  };

  const { zone: deliveryZone, fee: deliveryFee } = getDeliveryInfo();
  const total = deliveryFee !== null ? subtotal + deliveryFee : subtotal;
  const hasAddress = selectedAddressId || newAddress;
  const canOrder = hasAddress && deliveryZone && deliveryFee !== null && subtotal >= deliveryZone.minimum_order;

  const handleSubmit = async () => {
    if (!userId || !canOrder) return;
    setSubmitting(true);

    try {
      let addressId = selectedAddressId;
      let addressSnapshot: any = null;

      // Save new address if needed
      if (!selectedAddressId && newAddress) {
        const { data: savedAddr, error: addrErr } = await supabase.from("user_addresses").insert({
          user_id: userId,
          full_address: newAddress.full_address,
          latitude: newAddress.latitude,
          longitude: newAddress.longitude,
          label: addressLabel,
          apartment: apartment || null,
          instructions: instructions || null,
          delivery_zone_id: deliveryZone!.id,
          is_default: savedAddresses.length === 0,
        }).select().single();

        if (addrErr) throw addrErr;
        addressId = savedAddr.id;
        addressSnapshot = { full_address: newAddress.full_address, latitude: newAddress.latitude, longitude: newAddress.longitude, label: addressLabel };
      } else {
        const addr = getSelectedAddress();
        if (addr) addressSnapshot = { full_address: addr.full_address, latitude: addr.latitude, longitude: addr.longitude, label: addr.label };
      }

      // Create order
      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        user_id: userId,
        subtotal,
        delivery_fee: deliveryFee!,
        total_price: total,
        delivery_address_id: addressId,
        delivery_address_snapshot: addressSnapshot,
        delivery_zone_id: deliveryZone!.id,
        notes: notes || null,
        status: "pending",
      }).select().single();

      if (orderErr) throw orderErr;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: `${item.quantity} ${item.unit_type === "kg" ? "kg" : "x"}`,
        quantity_value: item.quantity,
        unit_price: item.price,
        line_total: item.price * item.quantity,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      clearCart();
      toast({ title: "Commande passée !", description: "Votre commande a été envoyée avec succès" });
      navigate(`/order-tracking/${order.id}`);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message || "Impossible de passer la commande", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-border/50">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Finaliser la commande</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Saved Addresses */}
        <div>
          <h3 className="font-bold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Adresse de livraison</h3>

          {savedAddresses.length > 0 && !showNewAddress && (
            <div className="space-y-2 mb-3">
              {savedAddresses.map((addr) => (
                <Card
                  key={addr.id}
                  className={`p-3 cursor-pointer transition-all ${selectedAddressId === addr.id ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
                  onClick={() => { setSelectedAddressId(addr.id); setNewAddress(null); }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedAddressId === addr.id ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                      {selectedAddressId === addr.id && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{addr.label || "Adresse"}</p>
                      <p className="text-xs text-muted-foreground truncate">{addr.full_address}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!showNewAddress ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowNewAddress(true); setSelectedAddressId(null); }}>
              <Plus className="h-4 w-4" /> Nouvelle adresse
            </Button>
          ) : (
            <Card className="p-4 space-y-3 border-primary/30">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Nouvelle adresse</p>
                {savedAddresses.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => { setShowNewAddress(false); if (savedAddresses.length > 0) setSelectedAddressId(savedAddresses[0].id); }}>
                    Annuler
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs">Nom de l'adresse</Label>
                <Input value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)} placeholder="Maison, Bureau..." className="mt-1" />
              </div>
              <AddressPicker onSelect={(a) => setNewAddress(a)} />
              <div>
                <Label className="text-xs">Appartement / Étage (optionnel)</Label>
                <Input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="Appt 3, 2ème étage" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Instructions pour le livreur (optionnel)</Label>
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Code porte, sonnette..." rows={2} className="mt-1" />
              </div>
            </Card>
          )}
        </div>

        {/* Zone info */}
        {hasAddress && !deliveryZone && (
          <Card className="p-3 border-destructive/50 bg-destructive/10">
            <p className="text-sm text-destructive font-medium">⚠️ Cette adresse n'est pas dans nos zones de livraison.</p>
          </Card>
        )}

        {deliveryZone && deliveryFee !== null && subtotal < deliveryZone.minimum_order && (
          <Card className="p-3 border-amber-500/50 bg-amber-500/10">
            <p className="text-sm text-amber-700 font-medium">
              ⚠️ Commande minimum de {formatPrice(deliveryZone.minimum_order)} pour la zone {deliveryZone.name}.
            </p>
          </Card>
        )}

        <Separator />

        {/* Order Notes */}
        <div>
          <Label className="text-sm font-semibold">Notes pour la commande (optionnel)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Remarques spéciales..." rows={2} className="mt-1" />
        </div>

        <Separator />

        {/* Order Summary */}
        <Card className="p-4 space-y-2">
          <h3 className="font-bold mb-2">Résumé</h3>
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.quantity}{item.unit_type === "kg" ? "kg" : "×"} {item.name}</span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Livraison</span>
            <span>{deliveryFee !== null ? (deliveryFee === 0 ? "Gratuite" : formatPrice(deliveryFee)) : "—"}</span>
          </div>
          {deliveryZone?.free_delivery_threshold && deliveryFee === 0 && (
            <p className="text-xs text-green-600">🎉 Livraison gratuite à partir de {formatPrice(deliveryZone.free_delivery_threshold)}</p>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
            <span>Total</span>
            <span className="text-primary">{formatPrice(total)}</span>
          </div>
        </Card>

        {/* Submit */}
        <Button className="w-full py-6 text-base font-bold" disabled={!canOrder || submitting} onClick={handleSubmit}>
          {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
          {submitting ? "Envoi en cours..." : "Confirmer la commande"}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutPage;
