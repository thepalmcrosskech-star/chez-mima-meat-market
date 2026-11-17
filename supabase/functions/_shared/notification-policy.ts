export function orderStatusNotification(order: { id: string; status: string; delivery_mode: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    confirmed: { title: "Commande confirmée ✅", body: "Votre commande a été confirmée et sera bientôt préparée." },
    preparing: { title: "En préparation 🍖", body: "Votre commande est en cours de préparation." },
    ready: { title: "Commande prête ! 🎉", body: order.delivery_mode === "pickup" ? "Votre commande est prête. Vous pouvez venir la récupérer en boucherie." : "Votre commande est prête. Un livreur est recherché." },
    delivering: { title: "En livraison 🚚", body: "Votre commande est en route !" },
    delivered: { title: "Commande livrée ✅", body: "Votre commande a été livrée. Bon appétit !" },
    cancelled: { title: "Commande annulée ❌", body: "Votre commande a été annulée." },
  };
  const message = messages[order.status];
  return message ? { ...message, data: { order_id: order.id } } : null;
}

export function canNotifyOrderOwner(callerId: string | null, isAdmin: boolean, ownerId: string, targetId: string) {
  return Boolean(callerId && isAdmin && ownerId === targetId);
}

export function canTrackOwnIp(callerId: string | null, action: unknown, targetId: unknown) {
  return Boolean(callerId && action === "track" && targetId === callerId);
}