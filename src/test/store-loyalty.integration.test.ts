import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.LOYALTY_TEST_URL;
const key = process.env.LOYALTY_TEST_KEY;
const customerToken = process.env.LOYALTY_TEST_CUSTOMER;
const staffToken = process.env.LOYALTY_TEST_STAFF;
const card = process.env.LOYALTY_TEST_CARD;
const enabled = Boolean(url && key && customerToken && staffToken && card);
const client = (token: string | undefined) => {
  if (!url || !key || !token) throw new Error("Missing loyalty test session");
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
};

describe.skipIf(!enabled)("fidélité boutique : protections serveur", () => {
  it("interdit au client la recherche téléphonique du personnel", async () => {
    const { error } = await client(customerToken).rpc("staff_find_loyalty_card", { _query: "0600000000" });
    expect(error?.message).toBe("Accès réservé au personnel");
  });
  it("interdit au client de créditer sa propre carte", async () => {
    const { error } = await client(customerToken).rpc("staff_record_loyalty_sale", { _token: card, _receipt: "TEST-DENIED", _articles_total: 500, _points_used: 0, _request_id: crypto.randomUUID() });
    expect(error?.message).toBe("Accès réservé au personnel");
  });
  it("retrouve la même carte par QR et par numéro marocain complet", async () => {
    const staff = client(staffToken);
    for (const query of [`MIMA:${card}`, "0600000000", "+212 600000000", "00212600000000"]) {
      const { data, error } = await staff.rpc("staff_find_loyalty_card", { _query: query });
      expect(error).toBeNull();
      expect(data?.some((row: { token: string }) => row.token === card)).toBe(true);
    }
  });
  it("refuse la recherche sur un numéro partiel", async () => {
    const { error } = await client(staffToken).rpc("staff_find_loyalty_card", { _query: "0600" });
    expect(error?.message).toContain("numéro mobile complet");
  });
  it("refuse les points hors paquets de 50", async () => {
    const { error } = await client(staffToken).rpc("staff_record_loyalty_sale", { _token: card, _receipt: "TEST-DENIED", _articles_total: 500, _points_used: 10, _request_id: crypto.randomUUID() });
    expect(error?.message).toBe("Les points s'utilisent par paquets de 50");
  });
});