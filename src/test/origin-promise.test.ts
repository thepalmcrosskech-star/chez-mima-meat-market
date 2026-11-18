import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const COMPONENT = "src/components/OriginPromise.tsx";
// Écrans vus par un client : accueil, fiche produit, connexion, commande.
const CLIENT_SCREENS = [
  "src/pages/HomePage.tsx",
  "src/pages/ProductPage.tsx",
  "src/pages/auth/LoginPage.tsx",
  "src/pages/CheckoutPage.tsx",
];

describe("origine et halal annoncés au client", () => {
  it("affiche les deux mentions dans le composant partagé", () => {
    const source = read(COMPONENT);
    expect(source).toContain("100% Marocain");
    expect(source).toContain("100% Halal");
    expect(source).toContain("préparés au Maroc et 100% halal");
  });

  it.each(CLIENT_SCREENS)("rappelle la promesse sur %s", (file) => {
    const source = read(file);
    expect(source).toContain("OriginPromise");
    expect(source).toMatch(/<Origin(PromiseBar|Badges)\b/);
  });

  it("n'utilise que des couleurs de la charte pour les pastilles", () => {
    const source = read(COMPONENT);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(source).toContain("text-primary");
    expect(source).toContain("text-success");
  });
});
