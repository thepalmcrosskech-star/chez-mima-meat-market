import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { brandLogo } from "@/lib/brand";

export default function LoyaltyCard() {
  const [token, setToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [card, points] = await Promise.all([
      supabase.from("loyalty_cards").select("token").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_my_loyalty_balance"),
    ]);
    if (!card.error) setToken(card.data?.token ?? null);
    if (!points.error) setBalance(points.data);
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
  return <section className="loyalty-virtual-card w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-border bg-card" aria-label="Ma carte fidélité">
    <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
      <div className="relative h-16 w-28 shrink-0 flex items-center">
        {!logoReady && <span className="font-display text-3xl leading-none text-primary">CHEZ MIMA</span>}
        <img src={brandLogo} alt={logoReady ? "Chez Mima" : ""} className={`absolute inset-0 h-full w-full object-contain ${logoReady ? "visible" : "invisible"}`} onLoad={event => { const image = event.currentTarget; void image.decode().then(() => setLogoReady(true)).catch(() => setLogoReady(false)); }} onError={() => setLogoReady(false)} />
      </div>
      <span className="text-right font-display text-xl leading-tight text-primary">CARTE DE<br />FIDÉLITÉ</span>
    </div>
    <div className="px-6 py-5 text-center">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Mon solde</p>
      <p className="mt-2 flex items-baseline justify-center gap-2 text-primary" aria-live="polite"><strong className="text-5xl leading-none tabular-nums">{balance === null ? "…" : balance}</strong><span className="text-base font-medium">points</span></p>
      <div className="mt-5 flex min-h-52 items-center justify-center">
        {token ? <div className="loyalty-qr p-3 rounded-md"><QRCodeSVG value={`MIMA:${token}`} size={184} level="M" title="Carte fidélité Chez Mima" /></div> : <Button className="w-full whitespace-normal" disabled={busy} onClick={activate}>{busy ? "Activation…" : "Activer ma carte"}</Button>}
      </div>
    </div>
    <div className="bg-primary px-6 py-3 text-center text-primary-foreground"><span className="font-display text-lg">CHEZ MIMA · MARRAKECH</span></div>
  </section>;
}