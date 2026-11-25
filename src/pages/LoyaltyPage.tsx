import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CustomerHeader } from "@/components/OriginPromise";
import BottomNav from "@/components/BottomNav";
import LoyaltyCard from "@/components/LoyaltyCard";

export default function LoyaltyPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session));
    });
    supabase.auth.getUser().then(({ data, error }) => { if (active) setSignedIn(!error && Boolean(data.user)); }).catch(() => { if (active) setSignedIn(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (signedIn === null) return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="animate-spin text-primary" aria-label="Chargement" /></div>;
  if (!signedIn) return <Navigate to="/login?next=%2Floyalty" replace />;
  return <div className="client-page min-h-screen bg-background">
    <CustomerHeader><div className="px-4 py-5 text-center"><h1 className="font-display text-3xl text-sidebar-foreground">Ma carte de fidélité</h1></div></CustomerHeader>
    <main className="px-4 py-6 sm:py-10"><LoyaltyCard /></main>
    <BottomNav />
  </div>;
}