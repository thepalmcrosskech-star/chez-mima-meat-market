import { describe, expect, it } from "vitest";
import { getOrderConfirmationEmail } from "@/lib/email";

describe("e-mail de confirmation", () => {
  it("échappe les champs texte du client", () => {
    const html = getOrderConfirmationEmail({
      customerName: '<script>x</script>', orderId: "abcdef12-0000-0000-0000-000000000000",
      items: [{ name: '<img src=x onerror=1>', quantity: 2, price: 45 }], total: 90, deliveryAddress: "Rue & <b>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Rue &amp; &lt;b&gt;");
    expect(html).toContain("#ABCDEF12");
    expect(html).toContain("90.00 MAD");
  });
});
