/** Adresse figée dans une commande au moment de sa création (colonne orders.delivery_address_snapshot). */
export interface AddressSnapshot {
  full_address?: string | null;
  label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instructions?: string | null;
  apartment?: string | null;
  [key: string]: unknown;
}
