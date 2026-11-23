import { describe, expect, it } from "vitest";
import { canAdjustItems, canCancelAtCounter, nextStaffOrderAction } from "@/lib/staff-order-workflow";

const base = {
  delivery_mode: "delivery",
  payment_method: "cash",
  receipt_photo_path: null,
  courier_called_at: null,
  availability_checked_at: null,
  payment_confirmed_at: null,
};
const checked = { availability_checked_at: "2026-11-23T16:00:00Z" };
const ticket = { receipt_photo_path: "order/ticket.jpg" };

describe("parcours du comptoir", () => {
  it("fait accepter la commande avant la préparation", () => {
    expect(nextStaffOrderAction({ ...base, status: "pending" })).toMatchObject({ status: "confirmed", label: "Accepter la commande" });
  });

  it("fait vérifier les articles avant le ticket, puis exige la photo", () => {
    expect(nextStaffOrderAction({ ...base, status: "preparing" })).toMatchObject({ kind: "availability" });
    expect(nextStaffOrderAction({ ...base, ...checked, status: "preparing" })).toMatchObject({ kind: "blocked" });
    expect(nextStaffOrderAction({ ...base, ...checked, ...ticket, status: "preparing" })).toMatchObject({ status: "ready" });
  });

  it("n’autorise les modifications d’articles qu’avant la vérification", () => {
    expect(canAdjustItems({ ...base, status: "preparing" })).toBe(true);
    expect(canAdjustItems({ ...base, ...checked, status: "preparing" })).toBe(false);
  });

  it("exige l’appel puis les espèces avant la remise au coursier", () => {
    const ready = { ...base, ...checked, ...ticket, status: "ready" };
    expect(nextStaffOrderAction(ready)).toMatchObject({ kind: "courier" });
    const called = { ...ready, courier_called_at: "2026-11-23T16:10:00Z" };
    expect(nextStaffOrderAction(called)).toMatchObject({ kind: "payment", label: "Espèces reçues du coursier" });
    expect(nextStaffOrderAction({ ...called, payment_confirmed_at: "2026-11-23T16:20:00Z" })).toMatchObject({ status: "delivering" });
  });

  it("ne clôture la livraison qu’à la confirmation du coursier", () => {
    expect(nextStaffOrderAction({ ...base, status: "delivering" })).toMatchObject({ status: "delivered", label: "Livraison confirmée par le coursier" });
  });

  it("exige le règlement sur place avant de clôturer un retrait", () => {
    const pickup = { ...base, ...checked, ...ticket, status: "ready", delivery_mode: "pickup", payment_method: "on_site" };
    expect(nextStaffOrderAction(pickup)).toMatchObject({ kind: "payment", label: "Règlement reçu sur place" });
    expect(nextStaffOrderAction({ ...pickup, payment_confirmed_at: "2026-11-23T16:20:00Z" })).toMatchObject({ status: "delivered", label: "Commande récupérée" });
  });

  it("ne permet plus d’annuler une commande déjà prête", () => {
    expect(canCancelAtCounter("preparing")).toBe(true);
    expect(canCancelAtCounter("ready")).toBe(false);
  });
});

import { isWeightWithinTolerance, unavailablePolicies } from "@/lib/staff-order-workflow";

describe("weight tolerance and customer choices", () => {
  it("accepts 270 g for 250 g ordered and refuses 280 g", () => {
    expect(isWeightWithinTolerance(0.25, 0.27)).toBe(true);
    expect(isWeightWithinTolerance(0.25, 0.225)).toBe(true);
    expect(isWeightWithinTolerance(0.25, 0.28)).toBe(false);
    expect(isWeightWithinTolerance(0.25, 0.22)).toBe(false);
  });
  it("offers only replace or cancel the item", () => {
    expect(unavailablePolicies.map((p) => p.value)).toEqual(["replace", "remove_item"]);
  });
});
