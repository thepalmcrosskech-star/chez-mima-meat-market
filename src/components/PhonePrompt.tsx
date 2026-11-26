import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { isPhoneTakenError, normalizeMoroccanPhone, PHONE_TAKEN_MESSAGE } from "@/lib/phone";

const SKIP_KEY = "chezmima-phone-prompt-skipped";
const HIDDEN = /^\/(admin|staff|driver|login|reset-password)/;

/** Demande le téléphone aux clients connectés dont le profil n'en a pas (ex. connexion Google). */
export default function PhonePrompt() {
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) { setOpen(false); return; }
      const uid = session.user.id;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!active || (roles ?? []).some((r: { role: string }) => ["admin", "employee", "driver"].includes(r.role))) return;
      const { data: profile } = await supabase.from("profiles").select("phone").eq("id", uid).maybeSingle();
      if (!active || !profile || profile.phone) return;
      const meta = normalizeMoroccanPhone(String(session.user.user_metadata?.phone ?? ""));
      if (meta) { const { error: e } = await supabase.from("profiles").update({ phone: meta }).eq("id", uid); if (!e) return; }
      setUserId(uid);
      if (HIDDEN.test(location.pathname) || sessionStorage.getItem(SKIP_KEY)) return;
      setOpen(true);
    };
    check().catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") setTimeout(() => check().catch(() => {}), 0); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [location.pathname]);

  const save = async () => {
    const normalized = normalizeMoroccanPhone(phone);
    if (!normalized) { setError("Numéro invalide. Exemple : 06 12 34 56 78"); return; }
    if (!userId) return;
    setSaving(true);
    const { error: err } = await supabase.from("profiles").update({ phone: normalized }).eq("id", userId);
    setSaving(false);
    if (isPhoneTakenError(err)) { setError(PHONE_TAKEN_MESSAGE); return; }
    if (err) { toast({ title: "Erreur", description: "Enregistrement impossible, réessayez.", variant: "destructive" }); return; }
    toast({ title: "Merci !", description: "Votre numéro est enregistré." });
    setOpen(false);
  };

  const skip = () => { sessionStorage.setItem(SKIP_KEY, "1"); setOpen(false); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) skip(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Votre numéro de téléphone</DialogTitle>
          <DialogDescription>Renseignez votre numéro pour retrouver vos points en boutique et suivre vos commandes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="prompt-phone">Téléphone / WhatsApp</Label>
          <Input id="prompt-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="06 12 34 56 78" value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={save} disabled={saving}>Enregistrer</Button>
          <Button variant="ghost" onClick={skip}>Plus tard</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
