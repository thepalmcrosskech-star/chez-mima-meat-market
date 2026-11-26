// Private server-to-server endpoint for the "Chez Mima Gestion" till.
// Authenticated by HMAC-SHA256 of the raw body with POS_LOYALTY_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const secret = Deno.env.get("POS_LOYALTY_SECRET");
  if (!secret) return json({ error: "Liaison non configurée" }, 503);

  const raw = await req.text();
  if (raw.length > 10_000) return json({ error: "Requête trop volumineuse" }, 413);
  const sig = (req.headers.get("x-pos-signature") ?? "").toLowerCase().replace(/^sha256=/, "");
  const ts = req.headers.get("x-pos-timestamp") ?? "";
  const tsNum = Number(ts);
  if (!/^\d{10,13}$/.test(ts)) return json({ error: "Signature invalide" }, 401);
  const tsMs = ts.length > 10 ? tsNum : tsNum * 1000;
  if (Math.abs(Date.now() - tsMs) > 5 * 60_000) return json({ error: "Requête expirée" }, 401);

  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  // Signed payload = timestamp + "." + raw body, so a timestamp cannot be swapped on a captured request.
  const expected = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`)));
  if (!safeEqual(sig, expected)) return json({ error: "Signature invalide" }, 401);

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json({ error: "JSON invalide" }, 400); }
  if (!body || typeof body !== "object") return json({ error: "JSON invalide" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const run = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) return json({ error: error.message }, 422);
    return json(data);
  };

  switch (body.action) {
    case "find": {
      if (typeof body.query !== "string" || body.query.length > 60) return json({ error: "Recherche invalide" }, 400);
      const { data, error } = await db.rpc("pos_find_loyalty_card", { _query: body.query });
      if (error) return json({ error: error.message }, 422);
      return json({ results: data ?? [] });
    }
    case "check_spend":
      if (!isUuid(body.token) || !isInt(body.points_used) || !isNum(body.articles_total)) return json({ error: "Paramètres invalides" }, 400);
      return run("pos_check_spend", { _token: body.token, _points_used: body.points_used, _articles_total: body.articles_total });
    case "record_sale":
      if (!isUuid(body.token) || !isUuid(body.sale_id) || typeof body.receipt_reference !== "string" ||
        !isNum(body.articles_total) || !isInt(body.points_used)) return json({ error: "Paramètres invalides" }, 400);
      return run("pos_record_sale", {
        _token: body.token, _receipt: body.receipt_reference, _sale_id: body.sale_id,
        _articles_total: body.articles_total, _points_used: body.points_used,
        _staff_label: typeof body.staff_label === "string" ? body.staff_label.slice(0, 80) : null,
      });
    case "reverse_sale":
      if (!isUuid(body.sale_id) || !isUuid(body.refund_id) || !isNum(body.articles_refunded)) return json({ error: "Paramètres invalides" }, 400);
      return run("pos_reverse_sale", { _sale_id: body.sale_id, _refund_id: body.refund_id, _articles_refunded: body.articles_refunded });
    default:
      return json({ error: "Action inconnue" }, 400);
  }
});
