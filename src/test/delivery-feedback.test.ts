import { describe, expect, it } from "vitest";
import { canGiveDeliveryFeedback, contactPhone, deliveryFeedbackUrl } from "@/lib/delivery-feedback";

describe("post-delivery shop contact", () => {
  it("allows feedback on delivered delivery orders even without an internal driver", () => {
    expect(canGiveDeliveryFeedback("delivered", "delivery")).toBe(true);
    for (const status of ["pending", "confirmed", "preparing", "ready", "delivering", "cancelled"]) {
      expect(canGiveDeliveryFeedback(status, "delivery")).toBe(false);
    }
    expect(canGiveDeliveryFeedback("delivered", "pickup")).toBe(false);
  });
  it("includes the customer's problem and full order reference for shop follow-up", () => {
    const url = deliveryFeedbackUrl("06 12 34 56 78", "order-123", "problem", "Article manquant");
    expect(url).not.toBeNull();
    const parsed = new URL(url ?? "");
    expect(parsed.pathname).toBe("/212612345678");
    expect(parsed.searchParams.get("text")).toContain("order-123");
    expect(parsed.searchParams.get("text")).toContain("Article manquant");
    expect(deliveryFeedbackUrl("0612345678", "order-123", "problem", "  ")).toBeNull();
  });
  it("supports positive feedback without requiring a comment", () => {
    const url = deliveryFeedbackUrl("+212612345678", "order-123", "good", "");
    expect(new URL(url ?? "").searchParams.get("text")).toContain("bien passée");
  });
  it("never opens a contact link without a valid configured phone", () => {
    expect(contactPhone("00212612345678")).toBe("212612345678");
    expect(deliveryFeedbackUrl("", "order-123", "good", "")).toBeNull();
    expect(contactPhone("not configured")).toBe("");
  });
});