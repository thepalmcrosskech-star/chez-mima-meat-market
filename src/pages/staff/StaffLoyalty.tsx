import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, Search, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { pointsEarned, pointsValue, usablePoints } from "@/lib/loyalty";

type Customer = { token: string; customer_name: string; phone: string | null; balance: number };
export default function StaffLoyalty() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [amount, setAmount] = useState("");
  const [redeem, setRedeem] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState<{ balance: number; earned: number; used: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const request = useRef(crypto.randomUUID());
  const resetSale = () => { setReceipt(""); setAmount(""); setRedeem(false); setConfirmed(false); setDone(null); request.current = crypto.randomUUID(); };
  const find = async (value: string) => {
    setBusy(true); setCustomers([]); setCustomer(null); resetSale();
    const { data, error } = await supabase.rpc("staff_find_loyalty_card", { _query: value.trim() });
    if (error) toast({ title: "Recherche impossible", description: error.message, variant: "destructive" });
    else if (!data?.length) toast({ title: "Aucune carte trouvée", description: "Le client doit activer sa carte dans son profil et renseigner son téléphone." });
    else if (data.length === 1) setCustomer(data[0]);
    else setCustomers(data);
    setBusy(false);
  };
  useEffect(() => {
    if (!camera || !video.current) return;
    let cancelled = false;
    let scanned = false;
    const reader = new BrowserQRCodeReader();
    reader.decodeFromConstraints({ video: { facingMode: "environment" }, audio: false }, video.current, (result, _error, scanner) => {
      if (!result || scanned || cancelled) return;
      const value = result.getText();
      if (!/^MIMA:[0-9a-f-]{36}$/i.test(value)) return;
      scanned = true; scanner.stop(); setCamera(false); setQuery(value); void find(value);
    }).then(scanner => { if (cancelled) scanner.stop(); else controls.current = scanner; }).catch(() => {
      if (!cancelled) { setCamera(false); toast({ title: "Caméra indisponible", description: "Autorisez la caméra ou recherchez le numéro de téléphone.", variant: "destructive" }); }
    });
    return () => { cancelled = true; controls.current?.stop(); controls.current = null; };
  }, [camera]);
  const total = Number(amount.replace(",", "."));
  const valid = Number.isFinite(total) && total > 0 && total <= 100000 && Math.abs(total * 100 - Math.round(total * 100)) < 0.00001;
  const used = customer && redeem && valid ? usablePoints(customer.balance, total) : 0;
  const earned = valid ? pointsEarned(total - pointsValue(used)) : 0;
  const save = async () => {
    if (!customer || !valid || !confirmed || busy || done) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("staff_record_loyalty_sale", { _token: customer.token, _receipt: receipt, _articles_total: total, _points_used: used, _request_id: request.current });
    if (error) toast({ title: "Opération refusée", description: error.message, variant: "destructive" });
    else if (data && typeof data === "object" && !Array.isArray(data) && typeof data.balance === "number" && typeof data.earned === "number" && typeof data.used === "number") {
      setDone({ balance: data.balance, earned: data.earned, used: data.used });
      setCustomer({ ...customer, balance: data.balance });
    }
    setBusy(false);
  };
  return <div className="max-w-2xl mx-auto space-y-6">
    <header><h1 className="text-3xl">Fidélité boutique</h1><p className="text-muted-foreground">2 % · 1 point / 10 DH · 50 points = 10 DH</p></header>
    <form onSubmit={e => { e.preventDefault(); void find(query); }} className="space-y-3">
      <Label htmlFor="loyalty-search">Téléphone du client ou code de la carte</Label>
      <div className="flex gap-2"><Input id="loyalty-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="06… / +212…" className="min-w-0" /><Button type="submit" disabled={busy || !query.trim()} size="icon" aria-label="Rechercher le client"><Search /></Button></div>
      <Button type="button" variant="outline" disabled={busy} onClick={() => setCamera(!camera)}>{camera ? <X /> : <Camera />}{camera ? "Fermer la caméra" : "Scanner la carte QR"}</Button>
    </form>
    {camera && <video ref={video} className="w-full aspect-square max-h-80 object-cover rounded-md bg-muted" muted playsInline aria-label="Caméra de lecture QR" />}
    {customers.length > 1 && <div className="space-y-2"><p>Plusieurs cartes correspondent : sélectionnez le client.</p>{customers.map(c => <Button key={c.token} variant="outline" className="w-full justify-between" onClick={() => { setCustomer(c); setCustomers([]); }}><span className="truncate">{c.customer_name}</span><span>{c.balance} pts</span></Button>)}</div>}
    {customer && <section className="border-t pt-5 space-y-4">
      <div className="flex justify-between gap-4"><div><h2 className="text-2xl">{customer.customer_name}</h2><p className="text-muted-foreground">{customer.phone || "Téléphone non renseigné"}</p></div><strong className="text-xl text-primary shrink-0">{customer.balance} pts</strong></div>
      {done ? <div role="status" className="space-y-3 border border-success/30 bg-success/10 p-4 rounded-md"><CheckCircle2 className="text-success" /><h3 className="text-xl">Ticket enregistré</h3><p>+{done.earned} points gagnés{done.used > 0 ? ` · ${done.used} points utilisés` : ""}</p><p>Nouveau solde : {done.balance} points</p><Button onClick={() => { resetSale(); setCustomer(null); setQuery(""); }}>Client suivant</Button></div> : <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="receipt">Référence unique du ticket boutique</Label><Input id="receipt" value={receipt} onChange={e => setReceipt(e.target.value)} maxLength={80} placeholder="Date + numéro du ticket" required minLength={3} disabled={busy} /></div>
        <div className="space-y-2"><Label htmlFor="articles">Montant des articles après promotions, avant fidélité (DH)</Label><Input id="articles" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="250,00" required disabled={busy} /></div>
        {customer.balance >= 50 && <label className="flex items-start gap-3"><Checkbox checked={redeem} onCheckedChange={v => setRedeem(v === true)} disabled={busy} /><span>Utiliser les points avec l’accord du client{used > 0 ? ` : ${used} points = ${pointsValue(used)} DH` : ""}</span></label>}
        {valid && <div className="bg-muted p-4 rounded-md space-y-1"><p>Remise fidélité : {pointsValue(used).toFixed(2)} DH</p><p className="font-bold">À encaisser : {(total - pointsValue(used)).toFixed(2)} DH</p><p className="text-success">Points gagnés : +{earned}</p></div>}
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} disabled={busy} /><span>Achat boutique réglé, hors commande de l’application ; remise éventuelle appliquée en caisse.</span></label>
        <Button type="submit" className="w-full" disabled={busy || !confirmed || !valid || receipt.trim().length < 3}>{busy ? "Enregistrement…" : "Valider le ticket fidélité"}</Button>
      </form>}
    </section>}
  </div>;
}