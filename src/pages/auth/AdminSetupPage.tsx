import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAccountAccess } from "@/lib/account-access";
import BrandHeader from "@/components/BrandHeader";

export default function AdminSetupPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    getAccountAccess().then(access => {
      if (access?.roles.includes("admin")) { navigate("/admin", { replace: true }); return; }
      setEmail(access?.user.email ?? null);
    }).catch(() => setError("Impossible de vérifier votre compte. Réessayez.")).finally(() => setReady(true));
  }, [navigate]);
  const activate = async () => {
    setBusy(true); setError("");
    try {
      const { error } = await supabase.rpc("claim_first_admin");
      if (error) throw error;
      const access = await getAccountAccess();
      if (!access?.roles.includes("admin")) throw new Error("L’accès n’a pas pu être confirmé.");
      navigate("/admin", { replace: true });
    } catch (err) { setError(typeof err === "object" && err !== null && "message" in err ? String(err.message) : "Activation refusée."); }
    finally { setBusy(false); }
  };
  return <div className="min-h-svh flex flex-col bg-background"><BrandHeader /><main className="flex-1 flex items-center justify-center px-5 py-8">
    <div className="w-full max-w-sm space-y-6">
      <ShieldCheck className="h-10 w-10 text-primary" />
      <h1 className="text-2xl font-bold">Premier administrateur</h1>
      {!ready ? <p role="status">Vérification du compte…</p> : email ? <>
        <p className="text-muted-foreground">Compte connecté : {email}</p>
        <Button className="w-full" disabled={busy} onClick={activate}>{busy ? "Activation…" : "Activer mon accès administrateur"}</Button>
        <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); navigate("/login?admin=1"); }}>Changer de compte</Button>
      </> : <>
        <p className="text-muted-foreground">Créez votre compte avec l’adresse réservée, confirmez l’e-mail reçu, puis connectez-vous.</p>
        <Button asChild className="w-full"><Link to="/login?admin=1">Créer mon compte ou me connecter</Link></Button>
      </>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button asChild variant="link"><Link to="/login">Connexion client</Link></Button>
    </div>
  </main></div>;
}