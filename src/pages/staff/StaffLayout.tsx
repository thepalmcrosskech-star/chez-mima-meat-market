import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Package, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAccountAccess } from "@/lib/account-access";
import { brandLogo as logo } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const navItems = [
  { label: "Commandes", path: "/staff", icon: ShoppingBag },
  { label: "Produits", path: "/staff/products", icon: Package },
];

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const access = await getAccountAccess();
        if (!access) {
          navigate("/login", { replace: true });
          return;
        }
        if (!access.roles.some(role => role === "admin" || role === "employee")) {
          toast({ title: "Accès réservé au personnel", variant: "destructive" });
          navigate("/", { replace: true });
          return;
        }
        setAuthorized(true);
      } finally {
        setLoading(false);
      }
    };
    checkAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      setAuthorized(false);
      setTimeout(checkAccess, 0);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return <div className="min-h-svh bg-background grid place-items-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" /></div>;
  }
  if (!authorized) return null;

  const navigation = (mobile = false) => (
    <nav className={mobile ? "grid grid-cols-2 gap-2 p-3" : "flex-1 space-y-2 p-4"}>
      {navItems.map(item => {
        const active = item.path === "/staff" ? location.pathname === "/staff" : location.pathname.startsWith(item.path);
        return (
          <Button
            key={item.path}
            variant={active ? "default" : "ghost"}
            className={mobile ? "h-14" : `w-full justify-start h-12 ${active ? "" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
            onClick={() => { navigate(item.path); setMenuOpen(false); }}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-svh bg-background md:flex">
      {menuOpen && <button aria-label="Fermer le menu" className="fixed inset-0 z-40 bg-overlay/60 md:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`brand-header fixed md:sticky inset-y-0 left-0 z-50 flex w-72 md:w-60 shrink-0 flex-col border-r border-sidebar-border transition-transform md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b-4 border-primary p-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Chez Mima" className="h-14 w-16 object-contain" />
            <div><p className="font-display text-3xl leading-none">COMPTOIR</p><p className="text-xs text-sidebar-foreground/70">Commandes application</p></div>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(false)}><X /></Button>
        </div>
        {navigation()}
        <div className="hidden md:block border-t border-sidebar-border p-3">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground" onClick={signOut}><LogOut /> Déconnexion</Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="brand-header sticky top-0 z-30 border-b-4 border-primary md:hidden">
          <div className="flex items-center gap-2 px-3 py-3">
            <Button variant="ghost" size="icon" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(true)}><Menu /></Button>
            <div className="min-w-0 flex-1"><p className="font-display text-2xl leading-none">CHEZ MIMA — COMPTOIR</p><p className="text-xs text-sidebar-foreground/70">Espace salarié</p></div>
            <Button variant="ghost" size="icon" aria-label="Se déconnecter" onClick={signOut}><LogOut /></Button>
          </div>
          {navigation(true)}
        </header>
        <main className="p-3 sm:p-5 lg:p-7"><Outlet /></main>
      </div>
    </div>
  );
}
