export type DeliveryFeedback = "good" | "problem";

export function canGiveDeliveryFeedback(status: string, deliveryMode: string) {
  return status === "delivered" && deliveryMode === "delivery";
}

export function contactPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00212")) return digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) return `212${digits.slice(1)}`;
  return digits.length >= 9 && digits.length <= 15 ? digits : "";
}

export function deliveryFeedbackUrl(phone: string, orderId: string, feedback: DeliveryFeedback, comment: string) {
  const number = contactPhone(phone);
  if (!number || (feedback === "problem" && !comment.trim())) return null;
  const message = [
    `Bonjour Chez Mima, concernant ma commande ${orderId} :`,
    feedback === "good" ? "La livraison s’est bien passée, merci !" : "J’ai rencontré un problème avec ma livraison.",
    comment.trim(),
  ].filter(Boolean).join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}