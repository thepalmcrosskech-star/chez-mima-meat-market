export type StaffWorkflowOrder = {
  status: string;
  delivery_mode: string;
  payment_method: string;
  receipt_photo_path: string | null;
  courier_called_at: string | null;
  availability_checked_at: string | null;
  payment_confirmed_at: string | null;
};

export type StaffOrderAction =
  | { kind: "status"; status: string; label: string; disabled?: false }
  | { kind: "availability"; label: string; disabled?: false }
  | { kind: "courier"; label: string; disabled?: false }
  | { kind: "payment"; label: string; disabled?: false }
  | { kind: "blocked"; label: string; disabled: true };

export const unavailablePolicies = [
  { value: "call", label: "M’appeler pour choisir", short: "Appeler le client" },
  { value: "replace", label: "Remplacer par un article similaire", short: "Remplacer par un similaire" },
  { value: "remove_item", label: "Annuler l’article indisponible", short: "Retirer l’article" },
] as const;

export const unavailablePolicyLabel = (value: string) =>
  unavailablePolicies.find((policy) => policy.value === value)?.short ?? "Appeler le client";

const needsPaymentConfirmation = (order: StaffWorkflowOrder) => order.payment_method !== "card";

/** The next permitted counter action. The server enforces the same sequence. */
export function nextStaffOrderAction(order: StaffWorkflowOrder): StaffOrderAction | null {
  switch (order.status) {
    case "pending":
      return { kind: "status", status: "confirmed", label: "Accepter la commande" };
    case "confirmed":
      return { kind: "status", status: "preparing", label: "Commencer la préparation" };
    case "preparing":
      if (!order.availability_checked_at) return { kind: "availability", label: "Articles vérifiés, passer en caisse" };
      return order.receipt_photo_path
        ? { kind: "status", status: "ready", label: "Commande prête" }
        : { kind: "blocked", label: "Photo du ticket requise", disabled: true };
    case "ready":
      if (order.delivery_mode === "pickup") {
        if (needsPaymentConfirmation(order) && !order.payment_confirmed_at) {
          return { kind: "payment", label: "Règlement reçu sur place" };
        }
        return { kind: "status", status: "delivered", label: "Commande récupérée" };
      }
      if (!order.courier_called_at) return { kind: "courier", label: "J’ai appelé le coursier" };
      if (order.payment_method === "cash" && !order.payment_confirmed_at) {
        return { kind: "payment", label: "Espèces reçues du coursier" };
      }
      return { kind: "status", status: "delivering", label: "Remettre au coursier" };
    case "delivering":
      return { kind: "status", status: "delivered", label: "Livraison confirmée par le coursier" };
    default:
      return null;
  }
}

export function canCancelAtCounter(status: string): boolean {
  return ["pending", "confirmed", "preparing"].includes(status);
}

export function canAdjustItems(order: StaffWorkflowOrder): boolean {
  return order.status === "preparing" && !order.availability_checked_at && !order.receipt_photo_path;
}

export type StaffStep = { label: string; done: boolean };

export function staffOrderSteps(order: StaffWorkflowOrder): StaffStep[] {
  const reached = (statuses: string[]) => statuses.includes(order.status);
  const after = ["confirmed", "preparing", "ready", "delivering", "delivered"];
  const steps: StaffStep[] = [
    { label: "Acceptée", done: reached(after) },
    { label: "Articles vérifiés", done: Boolean(order.availability_checked_at) },
    { label: "Ticket", done: Boolean(order.receipt_photo_path) },
  ];
  if (order.delivery_mode === "pickup") {
    steps.push({ label: "Règlement", done: Boolean(order.payment_confirmed_at) || (order.payment_method === "card" && order.status === "delivered") });
  } else {
    steps.push({ label: "Coursier appelé", done: Boolean(order.courier_called_at) });
    if (order.payment_method === "cash") steps.push({ label: "Espèces reçues", done: Boolean(order.payment_confirmed_at) });
    steps.push({ label: "Remise", done: reached(["delivering", "delivered"]) });
  }
  steps.push({ label: "Clôturée", done: order.status === "delivered" });
  return steps;
}
