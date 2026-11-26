/** Normalise un numéro marocain saisi librement ; renvoie null s'il n'est pas valide. */
export function normalizeMoroccanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^00/, "+");
  let local: string;
  if (digits.startsWith("+212")) local = digits.slice(4);
  else if (digits.startsWith("212") && digits.length === 12) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;
  if (!/^[5-7]\d{8}$/.test(local)) return null;
  return `+212${local}`;
}

export const PHONE_TAKEN_MESSAGE = "Ce numéro est déjà utilisé par un autre compte. Connectez-vous avec ce compte ou contactez la boutique.";
export function isPhoneTakenError(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes("PHONE_ALREADY_USED"));
}
