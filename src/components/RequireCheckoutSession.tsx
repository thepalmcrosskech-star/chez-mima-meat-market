import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkoutLoginPath } from "@/lib/checkout-access";

export default function RequireCheckoutSession({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session));
    });
    supabase.auth.getUser().then(({ data, error }) => {
      if (active) setSignedIn(!error && Boolean(data.user));
    }).catch(() => {
      if (active) setSignedIn(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  if (signedIn === null) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Chargement" /></div>;
  if (!signedIn) return <Navigate to={checkoutLoginPath} replace />;
  return <>{children}</>;
}