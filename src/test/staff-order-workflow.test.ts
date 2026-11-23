import { describe, expect, it } from "vitest";
import { canCancelAtCounter, nextStaffOrderAction } from "@/lib/staff-order-workflow";

const base = {
  delivery_mode: "delivery",
  receipt_photo_path: null,
  courier_called_at: null,
};

describe("parcours du comptoir", () => {
  it("exige la photo du ticket avant de déclarer la commande prête", () => {
    expect(nextStaffOrderAction({ ...base, status: "preparing" })).toEqual({
      kind: "blocked",
      label: "Photo du ticket requise",
      disabled: true,
    });
    expect(nextStaffOrderAction({ ...base, status: "preparing", receipt_photo_path: "order/ticket.jpg" })).toMatchObject({
      kind: "status",
      status: "ready",
    });
  });

  it("exige l’appel au coursier avant le départ d’une livraison", () => {
    const ready = { ...base, status: "ready", receipt_photo_path: "order/ticket.jpg" };
    expect(nextStaffOrderAction(ready)).toMatchObject({ kind: "courier" });
    expect(nextStaffOrderAction({ ...ready, courier_called_at: "2026-11-23T16:00:00Z" })).toMatchObject({
      kind: "status",
      status: "delivering",
    });
  });

  it("ne demande pas de coursier pour un retrait en boutique", () => {
    expect(nextStaffOrderAction({
      ...base,
      status: "ready",
      delivery_mode: "pickup",
      receipt_photo_path: "order/ticket.jpg",
    })).toMatchObject({ status: "delivered", label: "Commande récupérée" });
  });

  it("ne permet plus d’annuler une commande déjà prête", () => {
    expect(canCancelAtCounter("preparing")).toBe(true);
    expect(canCancelAtCounter("ready")).toBe(false);
  });
});
