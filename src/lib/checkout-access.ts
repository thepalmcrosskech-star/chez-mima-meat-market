import { destinationForRoles } from "@/lib/account-access";

export const checkoutLoginPath = "/login?next=%2Fcheckout";

export function loginDestination(roles: string[], next: string | null): string {
  const destination = destinationForRoles(roles);
  return destination === "/" && next === "/checkout" ? "/checkout" : destination;
}