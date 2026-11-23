import { destinationForRoles } from "@/lib/account-access";

export const checkoutLoginPath = "/login?next=%2Fcheckout";

/** Customers return to the catalogue page they came from (same-origin paths only). */
export function loginDestination(roles: string[], next: string | null): string {
  const destination = destinationForRoles(roles);
  if (destination !== "/" || !next) return destination;
  const safe = /^\/(?!\/)/.test(next) && !/^\/(admin|staff|driver|login)/.test(next);
  return safe ? next : destination;
}

export function cartLoginPath(currentPath: string): string {
  return `/login?next=${encodeURIComponent(currentPath)}`;
}
