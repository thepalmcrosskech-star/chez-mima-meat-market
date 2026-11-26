import { PasswordInput } from "@/components/ui/password-input";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { brandLogo as logo } from "@/lib/brand";
import BrandHeader from "@/components/BrandHeader";
import { getAccountAccess } from "@/lib/account-access";
import { loginDestination } from "@/lib/checkout-access";

const LoginPage = () => {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const adminSetup = params.get("admin") === "1";
  const checkoutRequested = params.get("next") === "/checkout";
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Retour de Google / Apple (ou lien de confirmation) : la session arrive, on redirige.
  useEffect(() => {
    const go = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const access = await getAccountAccess();
      if (access) navigate(adminSetup && !access.roles.includes("admin") ? "/admin/setup" : loginDestination(access.roles, params.get("next")), { replace: true });
    };
    go();
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") go(); });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const social = async (provider: "google" | "apple") => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/login" + window.location.search,
    });
    if (result.error) {
      setLoading(false);
      toast({ title: "Erreur", description: "Connexion impossible, réessayez.", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Email envoyé",
          description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe.",
        });
        setMode("login");
      } else if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        const access = await getAccountAccess();
        if (!access) throw new Error("Impossible de vérifier votre connexion.");

        toast({ title: "Connexion réussie", description: "Bienvenue !" });
        
        navigate(adminSetup && !access.roles.includes("admin") ? "/admin/setup" : loginDestination(access.roles, params.get("next")), { replace: true });
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: checkoutRequested ? `${window.location.origin}/checkout` : window.location.origin,
          },
        });
        if (error) throw error;
        if (signUpData.session) {
          const access = await getAccountAccess();
          toast({ title: "Bienvenue chez Mima !", description: "Votre compte est créé." });
          navigate(loginDestination(access?.roles ?? [], params.get("next")), { replace: true });
        } else {
          setSentTo(email);
        }
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex flex-col bg-background">
      <BrandHeader />
      <main className="flex flex-1 items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex justify-center">
          <img
            src={logo}
            alt="Chez Mima"
            className="w-48 h-36 object-contain mx-auto"
          />
        </div>
        {adminSetup && <h1 className="text-xl font-bold text-center">Compte administrateur</h1>}

        {sentTo ? (
          <div className="rounded-lg border border-primary/30 bg-muted p-5 text-center space-y-3">
            <h2 className="text-lg font-bold">Ouvrez votre boîte mail</h2>
            <p className="text-sm text-muted-foreground">
              Nous avons envoyé un lien de confirmation à <strong className="text-foreground">{sentTo}</strong>.
              Touchez ce lien pour activer votre compte, puis revenez ici.
            </p>
            <p className="text-xs text-muted-foreground">Rien reçu ? Regardez dans les « Spam » ou « Promotions ».</p>
            <Button variant="outline" className="w-full" onClick={() => { setSentTo(null); setMode("login"); }}>J'ai confirmé, me connecter</Button>
          </div>
        ) : (<>
        {/* Switcher */}
        <div className="flex rounded-lg bg-muted p-1">
          <Button
            variant={mode === "login" ? "default" : "ghost"}
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-3 text-sm font-bold tracking-widest uppercase transition-all ${
              mode === "login"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Connexion
          </Button>
          <Button
            variant={mode === "register" ? "default" : "ghost"}
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-lg py-3 text-sm font-bold tracking-widest uppercase transition-all ${
              mode === "register"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            S'inscrire
          </Button>
        </div>

        {mode !== "forgot" && (
          <div className="space-y-3">
            <Button type="button" variant="outline" disabled={loading} onClick={() => social("google")}
              className="h-11 w-full gap-2.5 border-[#747775] bg-[#FFFFFF] text-[#1F1F1F] hover:bg-[#FFFFFF]/90 hover:text-[#1F1F1F] font-medium">
              <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
              Continuer avec Google
            </Button>
            <Button type="button" disabled={loading} onClick={() => social("apple")}
              className="h-11 w-full bg-[#000000] text-[#FFFFFF] hover:bg-[#000000]/85 font-medium">
              Continuer avec Apple
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />ou avec votre e-mail<span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                type="text"
                placeholder="Votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder={mode === "register" ? "8 caractères minimum" : undefined}
                className="focus:placeholder:text-transparent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : undefined}
              />
            </div>
          )}

          {mode === "login" && (
            <Button variant="link"
              type="button"
              onClick={() => setMode("forgot")}
              className="text-sm text-primary hover:underline"
            >
              Mot de passe oublié ?
            </Button>
          )}

          <Button
            type="submit"
            className="w-full mt-2 font-bold tracking-wider uppercase"
            disabled={loading}
          >
            {loading
              ? "Chargement..."
              : mode === "login"
              ? "Se connecter"
              : mode === "register"
              ? "Créer mon compte"
              : "Réinitialiser"}
          </Button>

          {mode === "forgot" && (
            <Button variant="link"
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              ← Retour à la connexion
            </Button>
          )}
        </form>
        </>)}
        <Button variant="link" className="w-full" onClick={() => navigate("/")}>Retour au catalogue</Button>
      </div>
      </main>
    </div>
  );
};

export default LoginPage;
