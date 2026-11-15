import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isWeightUnit } from "@/lib/product-units";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Loader2, Plus, Check, Phone, Store, Truck, Clock, CalendarClock, Navigation } from "lucide-react";
import AddressPicker from "@/components/AddressPicker";
import PaymentMethodSelector from "@/components/checkout/PaymentMethodSelector";

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
  radius_km: number | null;
  min_radius_km: number | null;
  is_active: boolean | null;
}

import { formatPrice } from "@/lib/format";
import { haversineDistance } from "@/lib/geo";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();

  const [userId, setUserId] = useState<string | null>(null);
  const [storeLocation, setStoreLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<{ full_address: string; latitude: number; longitude: number } | null>(null);
  const [addressLabel, setAddressLabel] = useState("Maison");
  const [apartment, setApartment] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [cashBillAmount, setCashBillAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storeAddress, setStoreAddress] = useState("");
  const [openingHour, setOpeningHour] = useState("08:00");
  const [closingHour, setClosingHour] = useState("20:00");
  const [isScheduled, setIsScheduled] = useState(false);

  useEffect(() => {
    if (items.length === 0) { navigate("/cart"); return; }
    init();
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setUserId(user.id);

    const [addrRes, zonesRes, latRes, lngRes, profileRes, openRes, closeRes] = await Promise.all([
      supabase.from("user_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
      supabase.from("delivery_zones").select("*").eq("is_active", true),
      supabase.from("app_settings").select("value").eq("key", "store_latitude").single(),
      supabase.from("app_settings").select("value").eq("key", "store_longitude").single(),
      supabase.from("profiles").select("phone").eq("id", user.id).single(),
      supabase.from("app_settings").select("value").eq("key", "store_opening_hour").single(),
      supabase.from("app_settings").select("value").eq("key", "store_closing_hour").single(),
    ]);

    if (addrRes.data) {
      setSavedAddresses(addrRes.data);
      const defaultAddr = addrRes.data.find((a) => a.is_default);
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
      if (addrRes.data.length === 0) setShowNewAddress(true);
    }
    if (zonesRes.data) setZones(zonesRes.data);

    const storeLat = latRes.data ? parseFloat(String(latRes.data.value)) : 31.589;
    const storeLng = lngRes.data ? parseFloat(String(lngRes.data.value)) : -8.019;
    setStoreLocation({ lat: storeLat, lng: storeLng });

    if (profileRes.data?.phone) setWhatsappPhone(profileRes.data.phone);

    if (openRes.data?.value) setOpeningHour(String(openRes.data.value).replace(/"/g, ""));
    if (closeRes.data?.value) setClosingHour(String(closeRes.data.value).replace(/"/g, ""));

    const { data: storeAddrData } = await supabase.from("app_settings").select("value").eq("key", "store_address").single();
    if (storeAddrData?.value) setStoreAddress(String(storeAddrData.value));

    setLoading(false);
  };

  const findZone = (lat: number, lng: number): DeliveryZone | null => {
    if (!storeLocation) return null;
    const dist = haversineDistance(storeLocation.lat, storeLocation.lng, lat, lng);
    // Find the matching zone where dist is between min_radius_km and radius_km
    // Sort by radius_km ascending to find the tightest match
    const sorted = [...zones]
      .filter((z) => z.radius_km !== null)
      .sort((a, b) => (a.radius_km || 0) - (b.radius_km || 0));
    for (const zone of sorted) {
      const minR = zone.min_radius_km || 0;
      const maxR = zone.radius_km || 0;
      if (dist >= minR && dist <= maxR) return zone;
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

  // Store open/close logic
  const isStoreOpen = (() => {
    const now = new Date();
    const [oh, om] = openingHour.split(":").map(Number);
    const [ch, cm] = closingHour.split(":").map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= (oh * 60 + om) && mins < (ch * 60 + cm);
  })();

  const getNextOpeningDate = () => {
    const now = new Date();
    const [oh, om] = openingHour.split(":").map(Number);
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(oh, om, 0, 0);
    return next;
  };

  // Auto-enable scheduling when store is closed
  useEffect(() => {
    if (!isStoreOpen) setIsScheduled(true);
  }, [isStoreOpen]);

  const isPickup = deliveryMode === "pickup";
  const { zone: deliveryZone, fee: deliveryFee } = isPickup ? { zone: null, fee: 0 } : getDeliveryInfo();
  const total = isPickup ? subtotal : (deliveryFee !== null ? subtotal + deliveryFee : subtotal);
  const hasAddress = selectedAddressId || newAddress;
  const isValidPhone = whatsappPhone.replace(/\s/g, "").length >= 9;
  const canOrder = isPickup ? isValidPhone : (paymentMethod === "card" ? false : (hasAddress && deliveryZone && deliveryFee !== null && isValidPhone));

  const handleSubmit = async () => {
    if (!userId) return;
    if (isPickup && !isValidPhone) {
      toast({ title: "Numéro requis", description: "Veuillez renseigner votre numéro WhatsApp", variant: "destructive" });
      return;
    }
    if (!isPickup && !canOrder) return;
    setSubmitting(true);

    try {
      // Save WhatsApp phone to profile
      await supabase.from("profiles").update({ phone: whatsappPhone.trim() }).eq("id", userId);
      let addressId = selectedAddressId;
      let addressSnapshot: any = null;

      if (!isPickup) {
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
      }

      const { data: orderId, error: orderErr } = await supabase.rpc("create_customer_order", {
        _items: items.map((item) => ({ product_id: item.id, quantity_value: item.quantity })),
        _delivery_mode: deliveryMode,
        _delivery_address_id: isPickup ? null : addressId,
        _delivery_zone_id: isPickup ? null : deliveryZone?.id ?? null,
        _notes: notes || null,
        _scheduled_for: isScheduled ? getNextOpeningDate().toISOString() : null,
        _payment_method: isPickup ? "on_site" : paymentMethod,
        _cash_bill_amount: !isPickup && paymentMethod === "cash" ? cashBillAmount : null,
      });

      if (orderErr) throw orderErr;
      if (!orderId) throw new Error("La commande n’a pas pu être créée");

      // Send confirmation email (fire-and-forget)
      const { data: userProfile } = await supabase.from("profiles").select("email, name").eq("id", userId).single();
      if (userProfile?.email) {
        supabase.functions.invoke("send-email", {
          body: { order_id: orderId },
        }).catch(() => {}); // Don't block checkout on email failure
      }

      clearCart();
      toast({ title: "Commande passée !", description: "Votre commande a été envoyée avec succès" });
      navigate(`/order-tracking/${orderId}`);
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
        {/* Delivery Mode Selector */}
        <div>
          <h3 className="font-bold mb-3">Mode de récupération</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className={`p-4 cursor-pointer transition-all text-center ${deliveryMode === "delivery" ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
              onClick={() => setDeliveryMode("delivery")}
            >
              <Truck className={`h-6 w-6 mx-auto mb-2 ${deliveryMode === "delivery" ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-sm font-semibold">Livraison</p>
              <p className="text-xs text-muted-foreground">À domicile</p>
            </Card>
            <Card
              className={`p-4 cursor-pointer transition-all text-center ${deliveryMode === "pickup" ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
              onClick={() => setDeliveryMode("pickup")}
            >
              <Store className={`h-6 w-6 mx-auto mb-2 ${deliveryMode === "pickup" ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-sm font-semibold">Click & Collect</p>
              <p className="text-xs text-muted-foreground">En boucherie</p>
            </Card>
          </div>
        </div>

        <Separator />

        {/* Scheduled delivery banner */}
        {!isStoreOpen && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/10">
            <div className="flex items-start gap-3">
              <CalendarClock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-amber-700">🌙 La boucherie est fermée</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Votre commande sera programmée pour demain à l'ouverture ({openingHour}).
                  Elle sera préparée dès notre ouverture !
                </p>
              </div>
            </div>
          </Card>
        )}

        {isStoreOpen && (
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setIsScheduled(!isScheduled)}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isScheduled ? "border-primary bg-primary" : "border-muted-foreground"}`}>
              {isScheduled && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Programmer pour demain ({openingHour})
              </p>
              <p className="text-xs text-muted-foreground">Réservez maintenant, on prépare demain à l'ouverture</p>
            </div>
          </div>
        )}

        {/* Pickup Info */}
        {isPickup && (
          <Card className="p-4 border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-start gap-3">
              <Store className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Retrait en boucherie</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vous recevrez une notification dès que votre commande sera prête à retirer.
                </p>
              </div>
            </div>
            {(storeAddress || storeLocation) && (
              <div className="border-t border-primary/20 pt-3 space-y-2">
                {storeAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{storeAddress}</p>
                  </div>
                )}
                {storeLocation && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${storeLocation.lat},${storeLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Navigation className="h-4 w-4" />
                    Itinéraire GPS vers la boucherie
                  </a>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Saved Addresses - only for delivery */}
        {!isPickup && (
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
        )}

        {/* WhatsApp Phone */}
        <div>
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> Numéro WhatsApp *
          </h3>
          <Input
            type="tel"
            value={whatsappPhone}
            onChange={(e) => setWhatsappPhone(e.target.value)}
            placeholder="+212 6XX XXX XXX"
            className={!isValidPhone && whatsappPhone.length > 0 ? "border-destructive" : ""}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {isPickup ? "Pour vous prévenir quand la commande est prête" : "Pour que le livreur puisse vous contacter"}
          </p>
          {!isValidPhone && whatsappPhone.length > 0 && (
            <p className="text-xs text-destructive mt-1">Numéro trop court (minimum 9 chiffres)</p>
          )}
        </div>

        <Separator />
        {!isPickup && hasAddress && !deliveryZone && (
          <Card className="p-3 border-destructive/50 bg-destructive/10">
            <p className="text-sm text-destructive font-medium">⚠️ Cette adresse n'est pas dans nos zones de livraison.</p>
          </Card>
        )}

        {!isPickup && deliveryZone && deliveryFee !== null && deliveryFee > 0 && deliveryZone.free_delivery_threshold && (
          <Card className="p-3 border-amber-500/50 bg-amber-500/10">
            <p className="text-sm text-amber-700 font-medium">
              💡 Commande minimum de {formatPrice(deliveryZone.free_delivery_threshold)} pour obtenir la livraison GRATUITE dans cette zone.
            </p>
          </Card>
        )}

        {!isPickup && (
          <>
            <Separator />
            {/* Payment Method */}
            <PaymentMethodSelector
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              cashBillAmount={cashBillAmount}
              onCashBillChange={setCashBillAmount}
              total={total}
            />
          </>
        )}

        {isPickup && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <p className="text-sm font-medium">💳 Paiement sur place à la boucherie</p>
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
              <span className="text-muted-foreground">{item.quantity}{isWeightUnit(item.unit_type) ? " kg" : " ×"} {item.name}</span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {!isPickup && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Livraison</span>
              <span>{deliveryFee !== null ? (deliveryFee === 0 ? "Gratuite" : formatPrice(deliveryFee)) : "—"}</span>
            </div>
          )}
          {!isPickup && deliveryZone?.free_delivery_threshold && deliveryFee === 0 && (
            <p className="text-xs text-green-600">🎉 Livraison gratuite à partir de {formatPrice(deliveryZone.free_delivery_threshold)}</p>
          )}
          {isPickup && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Retrait en boucherie</span>
              <span className="text-green-600 font-medium">Gratuit</span>
            </div>
          )}
          {isScheduled && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Programmée pour</span>
              <span className="font-medium text-amber-600">Demain {openingHour}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
            <span>Total</span>
            <span className="text-primary">{formatPrice(total)}</span>
          </div>
        </Card>

        {/* Submit */}
        <Button className="w-full py-6 text-base font-bold" disabled={!canOrder || submitting} onClick={handleSubmit}>
          {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
          {submitting ? "Envoi en cours..." : isScheduled ? "📅 Réserver pour demain" : isPickup ? "Confirmer le retrait" : "Confirmer la commande"}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutPage;
