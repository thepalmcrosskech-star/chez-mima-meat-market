import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.jpeg";
import { getAccountAccess } from "@/lib/account-access";
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Truck, Users, MapPin, Settings, LogOut, Menu, X, ChevronRight, Image, Shield,
} from "lucide-react";

const navItems = [
  { label: "Tableau de bord", icon: LayoutDashboard, path: "/admin" },
  { label: "Commandes", icon: ShoppingBag, path: "/admin/orders" },
  { label: "Produits", icon: Package, path: "/admin/products" },
  { label: "Catégories", icon: Tags, path: "/admin/categories" },
  { label: "Bannières", icon: Image, path: "/admin/banners" },
  { label: "Livreurs", icon: Truck, path: "/admin/drivers" },
  { label: "Utilisateurs", icon: Users, path: "/admin/users" },
  { label: "Zones de livraison", icon: MapPin, path: "/admin/zones" },
  { label: "IP Bannies", icon: Shield, path: "/admin/banned-ips" },
  { label: "Paramètres", icon: Settings, path: "/admin/settings" },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkAdmin();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setAuthorized(false); setLoading(true);
      setTimeout(checkAdmin, 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async () => {
    try {
      const access = await getAccountAccess();
      if (!access) { navigate("/login"); return; }
      if (!access.roles.includes("admin")) {
        toast({ title: "Accès refusé", description: "Vous n'êtes pas administrateur", variant: "destructive" });
        navigate("/");
        return;
      }
      setAuthorized(true);
    } catch {
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Chez Mima" className="w-14 h-9 rounded-md object-contain bg-background/40 ring-1 ring-border p-1" />
            <span className="font-bold text-lg gradient-text">ADMIN</span>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive(item.path)
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {isActive(item.path) && <ChevronRight className="h-4 w-4 ml-auto" />}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-bold gradient-text">CHEZ MIMA — Admin</span>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
