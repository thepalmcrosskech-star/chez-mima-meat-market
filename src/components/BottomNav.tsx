import { forwardRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Search, ShoppingCart, User, ClipboardList } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const navItems = [
  { label: "Accueil", icon: Home, path: "/" },
  { label: "Recherche", icon: Search, path: "/search" },
  { label: "Panier", icon: ShoppingCart, path: "/cart", badge: true },
  { label: "Commandes", icon: ClipboardList, path: "/orders" },
  { label: "Profil", icon: User, path: "/profile" },
];

const BottomNav = forwardRef<HTMLElement>((_, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { totalItems } = useCart();

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-background via-background/95 to-background/90 backdrop-blur-xl border-t border-border/50 px-2 py-2 safe-area-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 h-auto relative ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge && totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
              {active && <div className="absolute -bottom-2 w-5 h-0.5 bg-primary rounded-full" />}
            </Button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
