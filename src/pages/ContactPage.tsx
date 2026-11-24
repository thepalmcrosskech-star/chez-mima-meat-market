import { CustomerHeader } from "@/components/OriginPromise";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Phone, MessageCircle, Mail, MapPin, Clock, Building2 } from "lucide-react";

const ContactPage = () => (
  <div className="client-page min-h-screen bg-background pb-24">
    <CustomerHeader>
      <div className="brand-header sticky top-0 z-40 px-4 py-4 border-b-4 border-primary">
        <h1 className="text-xl font-bold">Assistance & Contact</h1>
      </div>
    </CustomerHeader>
    <div className="px-4 py-4 space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Service client</h2>
        <a href="tel:+212707462630" className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" />+212 707 46 26 30</a>
        <a href="https://wa.me/212707462630" className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-primary" />WhatsApp : +212 707 46 26 30</a>
        <a href="mailto:contact@chezmima.app" className="flex items-center gap-3"><Mail className="h-5 w-5 text-primary" />contact@chezmima.app</a>
      </Card>
      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Boucherie Chez Mima</h2>
        <p className="flex items-start gap-3"><MapPin className="h-5 w-5 text-primary shrink-0" />16 rue des écoles, Bouaakaz, Mhamid, Marrakech</p>
        <p className="flex items-start gap-3"><Clock className="h-5 w-5 text-primary shrink-0" />Tous les jours de 10 h à 20 h 30 — pause le vendredi de 13 h à 14 h 30</p>
      </Card>
      <Card className="p-4 space-y-2">
        <h2 className="font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Mentions légales</h2>
        <p className="text-sm text-muted-foreground">L'enseigne Chez Mima est exploitée en gérance libre par la société <strong className="text-foreground">Viandas</strong>, éditrice de cette application.</p>
        <p className="text-sm text-muted-foreground">Siège social : N 3 Immeuble Palmier, 104 Lotissement Iguider 2, Rouidate, Marrakech</p>
        <p className="text-sm text-muted-foreground">Contact : contact@chezmima.app</p>
      </Card>
    </div>
    <BottomNav />
  </div>
);
export default ContactPage;
