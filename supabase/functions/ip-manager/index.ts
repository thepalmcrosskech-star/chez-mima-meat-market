import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get client IP from headers
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown';

    const { action, user_id } = await req.json();

    if (action === 'track') {
      // Track IP for authenticated user
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert user IP
      await supabaseAdmin.from('user_ips').upsert({
        user_id,
        ip_address: ip,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,ip_address' });

      // Check if this IP is banned
      const { data: banned } = await supabaseAdmin
        .from('banned_ips')
        .select('id')
        .eq('ip_address', ip)
        .maybeSingle();

      return new Response(JSON.stringify({ ip, banned: !!banned }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check') {
      // Check if current IP is banned
      const { data: banned } = await supabaseAdmin
        .from('banned_ips')
        .select('id, reason')
        .eq('ip_address', ip)
        .maybeSingle();

      return new Response(JSON.stringify({ ip, banned: !!banned, reason: banned?.reason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'ban') {
      // Ban all IPs associated with a user (admin only)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify admin
      const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: isAdmin } = await supabaseAdmin.rpc('has_admin_role', { user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { target_user_id, reason } = await req.json().catch(() => ({ target_user_id: null, reason: null }));
      const targetUserId = user_id; // reuse from first parse

      // Get all IPs for target user
      const { data: userIps } = await supabaseAdmin
        .from('user_ips')
        .select('ip_address')
        .eq('user_id', targetUserId);

      if (!userIps || userIps.length === 0) {
        return new Response(JSON.stringify({ error: 'No IPs found for this user', banned: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Ban all IPs
      let banned = 0;
      for (const entry of userIps) {
        const { error } = await supabaseAdmin.from('banned_ips').upsert({
          ip_address: entry.ip_address,
          reason: reason || 'Fausse commande',
          banned_by: user.id,
        }, { onConflict: 'ip_address' });
        if (!error) banned++;
      }

      return new Response(JSON.stringify({ banned, ips: userIps.map(e => e.ip_address) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'unban') {
      // Unban IPs for a user
      const authHeader = req.headers.get('Authorization');
      const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader || '' } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: isAdmin } = await supabaseAdmin.rpc('has_admin_role', { user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get IPs and unban
      const { data: userIps } = await supabaseAdmin
        .from('user_ips')
        .select('ip_address')
        .eq('user_id', user_id);

      if (userIps) {
        for (const entry of userIps) {
          await supabaseAdmin.from('banned_ips').delete().eq('ip_address', entry.ip_address);
        }
      }

      return new Response(JSON.stringify({ unbanned: userIps?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('IP tracking error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
