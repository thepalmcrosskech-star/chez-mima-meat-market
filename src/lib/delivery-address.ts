export function deliveryAddressDetails(snapshot: Record<string, unknown> | null | undefined) {
  const text = (key: string) => typeof snapshot?.[key] === "string" ? snapshot[key].trim() : "";
  return { address: text("full_address") || text("address") || "Adresse enregistrée", label: text("label"), apartment: text("apartment"), instructions: text("instructions") };
}