export type StaffWorkflowOrder = {
  status: string;
  delivery_mode: string;
  receipt_photo_path: string | null;
  courier_called_at: string | null;
};

export type StaffOrderAction =
  | { kind: "status"; status: string; label: string; disabled?: false }
  | { kind: "courier"; label: string; disabled?: false }
  | { kind: "blocked"; label: string; disabled: true };

/** The next permitted counter action. The server enforces the same sequence. */
export function nextStaffOrderAction(order: StaffWorkflowOrder): StaffOrderAction | null {
  switch (order.status) {
    case "pending":
      return { kind: "status", status: "confirmed", label: "Confirmer la commande" };
    case "confirmed":
      return { kind: "status", status: "preparing", label: "Commencer la préparation" };
    case "preparing":
      return order.receipt_photo_path
        ? { kind: "status", status: "ready", label: "Commande prête" }
        : { kind: "blocked", label: "Photo du ticket requise", disabled: true };
    case "ready":
      if (order.delivery_mode === "pickup") {
        return { kind: "status", status: "delivered", label: "Commande récupérée" };
      }
      return order.courier_called_at
        ? { kind: "status", status: "delivering", label: "Remettre au livreur" }
        : { kind: "courier", label: "J’ai appelé le livreur" };
    case "delivering":
      return { kind: "status", status: "delivered", label: "Commande livrée" };
    default:
      return null;
  }
}

export function canCancelAtCounter(status: string): boolean {
  return ["pending", "confirmed", "preparing"].includes(status);
}
