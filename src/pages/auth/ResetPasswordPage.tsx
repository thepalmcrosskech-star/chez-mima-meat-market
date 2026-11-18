import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BrandHeader from "@/components/BrandHeader";

export default function ResetPasswordPage() {
  const [valid, setValid] = useState(window.location.hash.includes("type=recovery"));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event === "PASSWORD_RECOVERY") setValid(true); });
    return () => subscription.unsubscribe();
  }, []);
  return <div className="min-h-svh flex flex-col bg-background"><BrandHeader /><main className="flex-1 flex items-center justify-center px-5 py-8"><form className="w-full max-w-sm space-y-5" onSubmit={async event => {
    event.preventDefault();
    if (!valid) return;
    if (password !== confirmation) { setError("Les mots de passe sont différents."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    await supabase.auth.signOut(); navigate("/login", { replace: true });
  }}>
    <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
    {!valid ? <p role="alert">Ouvrez le lien reçu par e-mail pour réinitialiser votre mot de passe.</p> : <>
      <Label htmlFor="new-password">Mot de passe</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
      <Label htmlFor="confirm-password">Confirmer le mot de passe</Label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={6} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      <Button className="w-full" disabled={busy} type="submit">Enregistrer</Button>
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </form></main></div>;
}