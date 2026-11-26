import { describe, expect, it } from "vitest";
import { canAdjustItems, nextStaffOrderAction, type StaffWorkflowOrder } from "../staff-order-workflow";

const order = (delivery_mode: string, patch: Partial<StaffWorkflowOrder> = {}): StaffWorkflowOrder => ({
  status: "preparing", delivery_mode, payment_method: "cash", receipt_photo_path: null,
  courier_called_at: null, availability_checked_at: null, payment_confirmed_at: null, ...patch,
});
const checked = { availability_checked_at: "2026-11-26T12:00:00Z" };
const ticket = { receipt_photo_path: "order/ticket.jpg" };

describe.each(["pickup", "delivery"])("préparation %s", mode => {
  it("exige acceptation puis préparation", () => {
    expect(nextStaffOrderAction(order(mode, { status: "pending" }))).toMatchObject({ kind: "status", status: "confirmed" });
    expect(nextStaffOrderAction(order(mode, { status: "confirmed" }))).toMatchObject({ kind: "status", status: "preparing" });
  });
  it("interdit de passer prête avant la vérification, même avec une photo", () => {
    expect(nextStaffOrderAction(order(mode))).toMatchObject({ kind: "availability" });
    expect(nextStaffOrderAction(order(mode, ticket))).toMatchObject({ kind: "availability" });
  });
  it("bloque avant la photo du ticket puis permet de déclarer prête", () => {
    expect(nextStaffOrderAction(order(mode, checked))).toMatchObject({ kind: "blocked", disabled: true });
    expect(nextStaffOrderAction(order(mode, { ...checked, ...ticket }))).toMatchObject({ kind: "status", status: "ready" });
  });
  it("autorise les modifications seulement pendant la préparation avant vérification et photo", () => {
    expect(canAdjustItems(order(mode))).toBe(true);
    expect(canAdjustItems(order(mode, checked))).toBe(false);
    expect(canAdjustItems(order(mode, ticket))).toBe(false);
    for (const status of ["pending", "confirmed", "ready", "delivering", "delivered", "cancelled"]) {
      expect(canAdjustItems(order(mode, { status })), status).toBe(false);
    }
  });
  it.each(["delivered", "cancelled"])("ne propose aucune action sur une commande %s", status => {
    expect(nextStaffOrderAction(order(mode, { status }))).toBeNull();
  });
});

describe("retrait boutique", () => {
  it("exige le règlement sur place avant la récupération", () => {
    const ready = order("pickup", { ...checked, ...ticket, status: "ready" });
    expect(nextStaffOrderAction(ready)).toMatchObject({ kind: "payment" });
    expect(nextStaffOrderAction({ ...ready, payment_confirmed_at: "2026-11-26T12:05:00Z" })).toMatchObject({ kind: "status", status: "delivered" });
  });
});

describe("livraison Glovo", () => {
  it.each(["cash", "card"])("%s : appel, remise et livraison sans encaissement du coursier", payment_method => {
    const ready = order("delivery", { ...checked, ...ticket, status: "ready", payment_method });
    expect(ready.payment_confirmed_at).toBeNull();
    expect(nextStaffOrderAction(ready)).toMatchObject({ kind: "courier" });
    expect(nextStaffOrderAction({ ...ready, courier_called_at: "2026-11-26T12:05:00Z" })).toMatchObject({ kind: "status", status: "delivering" });
    expect(nextStaffOrderAction({ ...ready, status: "delivering" })).toMatchObject({ kind: "status", status: "delivered" });
  });
});