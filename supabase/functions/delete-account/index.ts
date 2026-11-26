import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "UNAUTHORIZED" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if ((roles ?? []).some((r: { role: string }) => r.role !== "customer")) return json({ error: "STAFF_ACCOUNT" }, 403);

  // Effacer les données personnelles ; les commandes passées restent pour la comptabilité.
  await admin.from("user_addresses").delete().eq("user_id", user.id);
  await admin.from("profiles").update({ name: "Compte supprimé", phone: null, email: `deleted-${user.id}@deleted.invalid` }).eq("id", user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    // Si l'historique empêche la suppression physique, on bloque définitivement l'accès.
    const { error: banErr } = await admin.auth.admin.updateUserById(user.id, { email: `deleted-${user.id}@deleted.invalid`, ban_duration: "876000h" });
    if (banErr) return json({ error: "DELETE_FAILED" }, 500);
  }
  return json({ ok: true });
});
