import { describe, it, expect } from "vitest";
import { portalCopyText } from "./delivery-address";
describe("portalCopyText", () => {
  it("contient référence complète, téléphone, adresse et montant", () => {
    const t = portalCopyText({ id: "abc-123", total_price: 85, customerName: "Sara", customerPhone: "0600", delivery_address_snapshot: { full_address: "16 rue des écoles", latitude: 31.5, longitude: -8 } });
    expect(t).toContain("Commande abc-123");
    expect(t).toContain("Téléphone : 0600");
    expect(t).toContain("Adresse : 16 rue des écoles");
    expect(t).toContain("Montant : 85.00 DH");
  });
});
