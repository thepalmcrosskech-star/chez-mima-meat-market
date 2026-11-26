import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type StaffOrder = {
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

export type StaffOrderItem = {
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

export type CatalogueProduct = { id: string; name: string; price: number; unit_type: string; category_id: string | null };

/** Staff order list: data loading, live updates (Realtime + 30 s polling) and the new-order sound alert. */
export function useStaffOrders(onOrdersChange: (orders: StaffOrder[]) => void) {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [live, setLive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const onChangeRef = useRef(onOrdersChange);
  onChangeRef.current = onOrdersChange;

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
      onChangeRef.current(nextOrders);
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

  const toggleSound = async () => {
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

  return { orders, loading, live, soundEnabled, toggleSound, fetchOrders };
}
