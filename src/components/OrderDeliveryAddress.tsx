import { MapPin } from "lucide-react";
import { deliveryAddressDetails } from "@/lib/delivery-address";

export default function OrderDeliveryAddress({ snapshot }: { snapshot: Record<string, unknown> | null | undefined }) {
  const details = deliveryAddressDetails(snapshot);
  return (
    <section aria-label="Adresse et consignes de livraison" className="flex gap-3 rounded-lg bg-muted p-3 text-sm">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 space-y-2 break-words">
        <div><p className="font-semibold">Adresse de livraison{details.label ? ` · ${details.label}` : ""}</p><p className="whitespace-pre-wrap">{details.address}</p></div>
        {details.apartment && <div><p className="font-semibold">Étage / Appartement</p><p className="whitespace-pre-wrap">{details.apartment}</p></div>}
        {details.instructions && <div><p className="font-semibold">Consignes pour le coursier</p><p className="whitespace-pre-wrap">{details.instructions}</p></div>}
      </div>
    </section>
  );
}