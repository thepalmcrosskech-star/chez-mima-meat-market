// Display order inside a rayon: plain (nature) poultry cuts first, then the rest,
// alphabetically so flavour ranges (e.g. "Cubes de poulet marinés – …") sit side by side.
const NATURE_POULTRY = /^(poulet entier|filet poulet|cuisse de poulet|haut de cuisse|ailes de poulet|pillons poulet|cube de poulet)/i;

export function productDisplayRank(name: string): number {
  return NATURE_POULTRY.test(name.trim()) ? 0 : 1;
}

export function compareProductsForDisplay(a: { name: string }, b: { name: string }): number {
  const r = productDisplayRank(a.name) - productDisplayRank(b.name);
  if (r !== 0) return r;
  return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
}
