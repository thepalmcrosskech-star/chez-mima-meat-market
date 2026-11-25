import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The counter tablet and the admin interface must never be hard-reloaded by the
// resume handler, otherwise a preparation in progress or a product edit is lost.
const source = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");

const match = source.match(/const safeToReload =([\s\S]*?);/);
if (!match) throw new Error("Le garde de rechargement est introuvable dans src/main.tsx");

const isSafeToReload = new Function("path", `return (${match[1]});`) as (path: string) => boolean;

describe("rechargement au retour d'inactivité", () => {
  it("ne recharge jamais le comptoir, l'administration, le livreur ni le paiement", () => {
    for (const path of [
      "/staff",
      "/staff/orders",
      "/staff/loyalty",
      "/admin",
      "/admin/products",
      "/driver",
      "/checkout",
    ]) {
      expect(isSafeToReload(path)).toBe(false);
    }
  });

  it("laisse le rechargement automatique aux pages clients", () => {
    for (const path of ["/", "/product/1", "/loyalty", "/addresses", "/profile"]) {
      expect(isSafeToReload(path)).toBe(true);
    }
  });
});
