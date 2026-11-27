import { describe, expect, it } from "vitest";
import { getOrderConfirmationEmail } from "@/lib/email";

describe("e-mail de confirmation", () => {
  it("échappe les champs texte du client", () => {
    const html = getOrderConfirmationEmail({
      customerName: '<script>x</script>', orderId: "abcdef12-0000-0000-0000-000000000000",
      items: [{ name: '<img src=x onerror=1>', quantity: "2 x", price: 45 }], total: 90, deliveryAddress: "Rue & <b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Rue &amp; &lt;b&gt;");
    expect(html).toContain("#ABCDEF12");
    expect(html).toContain("90.00 MAD");
  });

  it("affiche les quantités telles qu'elles sont enregistrées", () => {
    const html = getOrderConfirmationEmail({
      customerName: "Nora", orderId: "abcdef12-0000-0000-0000-000000000000",
      items: [
        { name: "Filet Poulet", quantity: "0.5 kg", price: 42.5 },
        { name: "Freez citron menthe", quantity: "1 x", price: 25 },
      ],
      total: 67.5, deliveryAddress: "Residence Noor 6, Marrakech",
    });
    expect(html).toContain("0.5 kg");
    expect(html).toContain("1 x");
    expect(html).not.toContain("NaN");
  });
});
