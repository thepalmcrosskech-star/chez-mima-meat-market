import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactPhone, deliveryFeedbackUrl, type DeliveryFeedback as FeedbackChoice } from "@/lib/delivery-feedback";

export default function DeliveryFeedback({ orderId }: { orderId: string }) {
  const [choice, setChoice] = useState<FeedbackChoice | null>(null);
  const [comment, setComment] = useState("");
  const [contacts, setContacts] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("app_settings").select("key,value").in("key", ["store_phone", "whatsapp_number"])
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { setFailed(true); return; }
        const settings = Object.fromEntries((data || []).map(row => [row.key, typeof row.value === "string" ? row.value : ""]));
        setContacts({ phone: contactPhone(settings.store_phone || ""), whatsapp: contactPhone(settings.whatsapp_number || "") });
      });
    return () => { active = false; };
  }, []);

  const url = choice && contacts?.whatsapp ? deliveryFeedbackUrl(contacts.whatsapp, orderId, choice, comment) : null;

  return (
    <section className="space-y-4 border-b border-border pb-5" aria-labelledby="delivery-feedback-title">
      <div>
        <h2 id="delivery-feedback-title" className="text-lg font-bold">Comment s’est passée votre livraison ?</h2>
        <p className="text-sm text-muted-foreground mt-1">Commande n° {orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Votre livraison">
        <Button variant={choice === "good" ? "default" : "outline"} aria-pressed={choice === "good"} onClick={() => setChoice("good")} className="gap-2 h-auto min-h-11 whitespace-normal text-left">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Tout s’est bien passé
        </Button>
        <Button variant={choice === "problem" ? "default" : "outline"} aria-pressed={choice === "problem"} onClick={() => setChoice("problem")} className="gap-2 h-auto min-h-11 whitespace-normal text-left">
          <AlertCircle className="h-4 w-4 shrink-0" /> Un problème
        </Button>
      </div>
      {choice && (
        <div className="space-y-2">
          <Label htmlFor="delivery-feedback-comment">{choice === "problem" ? "Que s’est-il passé ?" : "Votre commentaire (facultatif)"}</Label>
          <Textarea id="delivery-feedback-comment" value={comment} onChange={event => setComment(event.target.value)} rows={3} maxLength={2000} placeholder={choice === "problem" ? "Article manquant, retard, état de la commande…" : "Votre retour"} />
          {contacts?.whatsapp && <Button disabled={!url} className="gap-2 w-full h-auto min-h-11 whitespace-normal" onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}><MessageCircle className="h-4 w-4 shrink-0" /> Continuer sur WhatsApp</Button>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {contacts?.phone && <Button variant="outline" className="gap-2 min-h-11" onClick={() => { window.location.href = `tel:+${contacts.phone}`; }}><Phone className="h-4 w-4" /> Appeler Chez Mima</Button>}
        {!choice && contacts?.whatsapp && <Button variant="outline" className="gap-2 min-h-11" onClick={() => { const message = encodeURIComponent(`Bonjour Chez Mima, je vous contacte au sujet de ma commande ${orderId}.`); window.open(`https://wa.me/${contacts.whatsapp}?text=${message}`, "_blank", "noopener,noreferrer"); }}><MessageCircle className="h-4 w-4" /> Contacter sur WhatsApp</Button>}
      </div>
      {failed && <p role="alert" className="text-sm text-destructive">Les coordonnées ne sont pas disponibles. Veuillez rouvrir votre commande.</p>}
      {contacts && !contacts.phone && !contacts.whatsapp && <p className="text-sm text-muted-foreground">Les coordonnées de la boutique ne sont pas encore disponibles.</p>}
    </section>
  );
}