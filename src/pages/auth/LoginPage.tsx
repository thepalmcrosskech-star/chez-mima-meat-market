import { useState } from "react";
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
          toast({
            title: "Inscription réussie",
            description: "Vérifiez votre email pour confirmer votre compte.",
          });
        }
      }
    } catch (error: any) {
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
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder="6 caractères minimum"
                className="focus:placeholder:text-transparent"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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
        <Button variant="link" className="w-full" onClick={() => navigate("/")}>Retour au catalogue</Button>
      </div>
      </main>
    </div>
  );
};

export default LoginPage;
