export const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price) + " MAD";

export const statusOptions = [
  { value: "pending", label: "En attente", color: "bg-warning/10 text-warning" },
  { value: "confirmed", label: "Confirmée", color: "bg-primary/10 text-primary" },
  { value: "preparing", label: "En préparation", color: "bg-warning/10 text-warning" },
  { value: "ready", label: "Prête", color: "bg-success/10 text-success" },
  { value: "delivering", label: "En livraison", color: "bg-primary/10 text-primary" },
  { value: "delivered", label: "Livrée", color: "bg-success/10 text-success" },
  { value: "cancelled", label: "Annulée", color: "bg-destructive/10 text-destructive" },
];

export const getStatusInfo = (s: string) =>
  statusOptions.find((o) => o.value === s) || { value: s, label: s, color: "bg-muted text-muted-foreground" };
