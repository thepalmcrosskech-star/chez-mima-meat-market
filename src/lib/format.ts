export const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price) + " MAD";

export const statusOptions = [
  { value: "pending", label: "En attente", color: "bg-amber-500/20 text-amber-400" },
  { value: "confirmed", label: "Confirmée", color: "bg-blue-500/20 text-blue-400" },
  { value: "preparing", label: "En préparation", color: "bg-purple-500/20 text-purple-400" },
  { value: "delivering", label: "En livraison", color: "bg-cyan-500/20 text-cyan-400" },
  { value: "delivered", label: "Livrée", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "cancelled", label: "Annulée", color: "bg-red-500/20 text-red-400" },
];

export const getStatusInfo = (s: string) =>
  statusOptions.find((o) => o.value === s) || { value: s, label: s, color: "bg-muted text-muted-foreground" };
