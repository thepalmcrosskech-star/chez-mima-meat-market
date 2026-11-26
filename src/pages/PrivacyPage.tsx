import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-semibold text-lg">{title}</h2>
    <div className="text-sm text-muted-foreground space-y-2">{children}</div>
  </section>
);

const PrivacyPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 px-2"><ArrowLeft className="h-4 w-4" />Retour</Button>
        <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground">Boucherie Chez Mima, Marrakech — dernière mise à jour : novembre 2026.</p>
        <Section title="Données collectées">
          <p>Pour créer votre compte et livrer vos commandes, nous collectons : votre nom, votre adresse e-mail, votre numéro de téléphone / WhatsApp, vos adresses de livraison (avec leur position sur la carte), vos commandes et votre solde de points de fidélité.</p>
          <p>Si vous vous connectez avec Google ou Apple, nous recevons uniquement votre nom et votre adresse e-mail.</p>
        </Section>
        <Section title="Position et appareil photo">
          <p>Votre position n'est utilisée que lorsque vous la demandez, pour placer votre adresse de livraison sur la carte. Elle n'est pas suivie en arrière-plan.</p>
          <p>L'appareil photo n'est utilisé qu'à votre demande (QR code de fidélité, photo des tickets par le personnel).</p>
        </Section>
        <Section title="Utilisation">
          <p>Vos données servent uniquement à préparer et livrer vos commandes, vous contacter au sujet d'une commande, gérer votre carte de fidélité et vous envoyer les notifications que vous avez acceptées. Nous ne vendons pas vos données et ne faisons pas de publicité ciblée.</p>
        </Section>
        <Section title="Partage">
          <p>Votre nom, votre téléphone et votre adresse sont communiqués au coursier (Glovo) uniquement pour livrer votre commande. Nos données sont hébergées chez notre prestataire technique.</p>
          <p>Notre hébergeur place un seul cookie strictement nécessaire, qui garantit que chaque page vient de la même version du site ; il ne contient aucune information sur vous et expire sous 7 jours.</p>
        </Section>
        <Section title="Supprimer votre compte">
          <p>Vous pouvez supprimer votre compte à tout moment depuis l'application : Profil → « Supprimer mon compte ». Vos informations personnelles et adresses sont effacées ; les factures des commandes passées sont conservées de façon anonyme pour nos obligations comptables.</p>
        </Section>
        <Section title="Contact">
          <p>Pour toute question : +212 7 07 46 26 30 (appel ou WhatsApp).</p>
        </Section>
      </div>
    </div>
  );
};

export default PrivacyPage;
