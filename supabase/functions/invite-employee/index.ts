import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Connexion requise" }, { status: 401, headers: corsHeaders });
    }

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.slice(7));
    const callerId = claimsData?.claims?.sub;
    if (claimsError || typeof callerId !== "string") {
      return Response.json({ error: "Connexion invalide" }, { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await admin.rpc("has_admin_role", { user_id: callerId });
    if (isAdmin !== true) {
      return Response.json({ error: "Accès administrateur requis" }, { status: 403, headers: corsHeaders });
    }

    const payload = await req.json();
    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length < 2 || name.length > 120) {
      return Response.json({ error: "Nom ou e-mail invalide" }, { status: 400, headers: corsHeaders });
    }

    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing) {
      return Response.json({ error: "Ce compte existe déjà : choisissez le rôle Salarié dans la liste." }, { status: 409, headers: corsHeaders });
    }

    const origin = req.headers.get("origin");
    const redirectTo = origin && /^https?:\/\//.test(origin)
      ? `${origin}/reset-password?next=/staff`
      : undefined;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo,
    });
    if (inviteError || !invited.user) {
      return Response.json({ error: inviteError?.message || "Invitation impossible" }, { status: 400, headers: corsHeaders });
    }

    const { error: roleError } = await admin.from("profiles").update({ name, role: "employee" }).eq("id", invited.user.id);
    if (roleError) {
      return Response.json({ error: "Invitation créée, mais le rôle n’a pas pu être attribué. Choisissez Salarié dans la liste." }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invitation impossible" }, { status: 500, headers: corsHeaders });
  }
});
