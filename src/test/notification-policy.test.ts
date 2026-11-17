import { describe, expect, it } from "vitest";
import { canNotifyOrderOwner, canTrackOwnIp, orderStatusNotification } from "../../supabase/functions/_shared/notification-policy";

describe("notification authorization", () => {
  it("limits an administrator to the actual order owner", () => {
    expect(canNotifyOrderOwner("admin", true, "customer", "customer")).toBe(true);
    expect(canNotifyOrderOwner("admin", true, "customer", "someone-else")).toBe(false);
  });
  it("rejects customer and unauthenticated push requests", () => {
    expect(canNotifyOrderOwner("customer", false, "customer", "customer")).toBe(false);
    expect(canNotifyOrderOwner(null, true, "customer", "customer")).toBe(false);
  });
  it("derives the status and destination from the stored order, not custom input", () => {
    expect(orderStatusNotification({ id: "order-1", status: "delivering", delivery_mode: "delivery" })?.data).toEqual({ order_id: "order-1" });
    expect(orderStatusNotification({ id: "order-1", status: "invented", delivery_mode: "delivery" })).toBeNull();
  });
});

describe("IP privacy", () => {
  it("rejects unauthenticated IP checks", () => {
    expect(canTrackOwnIp(null, "check", "customer")).toBe(false);
    expect(canTrackOwnIp(null, "track", "customer")).toBe(false);
  });
  it("only permits tracking the signed-in account", () => {
    expect(canTrackOwnIp("customer", "track", "customer")).toBe(true);
    expect(canTrackOwnIp("customer", "track", "other")).toBe(false);
    expect(canTrackOwnIp("customer", "check", "customer")).toBe(false);
  });
});