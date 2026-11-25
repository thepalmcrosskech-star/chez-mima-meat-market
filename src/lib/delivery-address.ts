export function deliveryAddressDetails(snapshot: Record<string, unknown> | null | undefined) {
  const text = (key: string) => typeof snapshot?.[key] === "string" ? snapshot[key].trim() : "";
  return { address: text("full_address") || text("address") || "Adresse enregistrée", label: text("label"), apartment: text("apartment"), instructions: text("instructions") };
}
export function portalCopyText(o: { id: string; total_price: number; delivery_address_snapshot: Record<string, unknown> | null | undefined; customerName?: string | null; customerPhone?: string | null }) {
  const d = deliveryAddressDetails(o.delivery_address_snapshot);
  const lat = o.delivery_address_snapshot?.latitude, lng = o.delivery_address_snapshot?.longitude;
  return [
    `Commande ${o.id}`,
    `Client : ${o.customerName || "Client"}`,
    o.customerPhone ? `Téléphone : ${o.customerPhone}` : "",
    `Adresse : ${d.address}`,
    d.apartment ? `Étage / Appartement : ${d.apartment}` : "",
    d.instructions ? `Consignes : ${d.instructions}` : "",
    lat != null && lng != null ? `Carte : https://maps.google.com/?q=${lat},${lng}` : "",
    `Montant : ${Number(o.total_price).toFixed(2)} DH`,
  ].filter(Boolean).join("\n");
}
