import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { pointsValue } from "@/lib/loyalty";

export default function LoyaltyCard() {
  const [token, setToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ id: string; created_at: string; receipt_reference: string; points_earned: number; points_used: number }[]>([]);
  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [card, points, sales] = await Promise.all([
      supabase.from("loyalty_cards").select("token").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_my_loyalty_balance"),
      supabase.from("store_loyalty_transactions").select("id,created_at,receipt_reference,points_earned,points_used").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    if (!card.error) setToken(card.data?.token ?? null);
    if (!points.error) setBalance(points.data);
    if (!sales.error) setHistory(sales.data ?? []);
  };
  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  const activate = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("activate_my_loyalty_card");
    if (error) toast({ title: "Carte indisponible", description: error.message, variant: "destructive" });
    else { setToken(data); void refresh(); }
    setBusy(false);
  };
  return <section className="rounded-lg border border-primary/30 bg-card overflow-hidden" aria-label="Ma carte fidélité">
    <div className="bg-primary text-primary-foreground px-5 py-4 flex justify-between items-center gap-3">
      <h2 className="text-2xl">Ma carte Chez Mima</h2><strong className="text-2xl shrink-0">2 %</strong>
    </div>
    <div className="p-5 space-y-4">
      <div className="text-center"><p className="text-3xl font-bold text-primary">{balance === null ? "…" : balance} points</p>
        {balance !== null && <p className="text-sm text-muted-foreground">Valeur cumulée : {pointsValue(balance).toFixed(2)} DH · 50 points = 10 DH</p>}
      </div>
      {token ? <div className="flex justify-center"><div className="loyalty-qr p-4 rounded-md"><QRCodeSVG value={`MIMA:${token}`} size={208} level="M" title="Carte fidélité Chez Mima" /></div></div> : <Button className="w-full" disabled={busy} onClick={activate}>{busy ? "Activation…" : "Activer ma carte boutique"}</Button>}
      <p className="text-sm text-muted-foreground text-center">1 point par tranche de 10 DH d’articles réglés. Solde commun en boutique et pour vos commandes.</p>
      {history.length > 0 && <div className="border-t pt-3 space-y-2"><h3 className="text-lg">Derniers passages en boutique</h3>{history.map(sale => <div key={sale.id} className="flex justify-between gap-3 text-sm"><span>{new Date(sale.created_at).toLocaleDateString("fr-FR")} · {sale.receipt_reference}</span><span className="shrink-0 text-success">+{sale.points_earned}{sale.points_used > 0 ? ` / −${sale.points_used}` : ""} pts</span></div>)}</div>}
    </div>
  </section>;
}