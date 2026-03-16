import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIpBanCheck() {
  const [banned, setBanned] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkBan = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setChecked(true);
          return;
        }

        // Track IP and check ban in one call
        const { data, error } = await supabase.functions.invoke('ip-manager', {
          body: { action: 'track', user_id: session.user.id },
        });

        if (data?.banned) {
          setBanned(true);
          setReason(data.reason || 'Accès bloqué');
          // Sign out the banned user
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error('IP ban check failed:', err);
      } finally {
        setChecked(true);
      }
    };

    checkBan();
  }, []);

  return { banned, reason, checked };
}
