import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Cloudflare overwrites cf-connecting-ip with the real visitor address, while a
// visitor can put anything in x-forwarded-for / x-real-ip. The recorded address
// must therefore come from cf-connecting-ip first, otherwise a banned customer
// could keep ordering under a made-up address.
const source = readFileSync(
  join(process.cwd(), "supabase/functions/ip-manager/index.ts"),
  "utf8",
);

const match = source.match(/const ip =([\s\S]*?);/);
if (!match) throw new Error("La lecture de l'adresse IP est introuvable dans ip-manager");

const readIp = new Function("req", `return (${match[1]});`) as (req: unknown) => string;

const withHeaders = (headers: Record<string, string>) => ({
  headers: { get: (name: string) => headers[name] ?? null },
});

describe("priorité des en-têtes IP dans ip-manager", () => {
  it("garde l'adresse réelle de Cloudflare devant une adresse falsifiée", () => {
    expect(
      readIp(
        withHeaders({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "192.0.2.45, 10.0.0.1",
          "x-real-ip": "192.0.2.46",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("nettoie les espaces de l'adresse retenue", () => {
    expect(readIp(withHeaders({ "cf-connecting-ip": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("repli sur x-forwarded-for puis x-real-ip quand Cloudflare n'a rien transmis", () => {
    expect(
      readIp(withHeaders({ "x-forwarded-for": "192.0.2.45, 10.0.0.1", "x-real-ip": "192.0.2.46" })),
    ).toBe("192.0.2.45");
    expect(readIp(withHeaders({ "x-real-ip": "192.0.2.46" }))).toBe("192.0.2.46");
  });

  it("ne devine aucune adresse quand aucun en-tête n'est présent", () => {
    expect(readIp(withHeaders({}))).toBe("unknown");
  });
});
