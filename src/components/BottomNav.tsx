import { forwardRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, QrCode, ShoppingCart, User, ClipboardList } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const navItems = [
  { label: "Accueil", icon: Home, path: "/" },
  { label: "Ma carte", icon: QrCode, path: "/loyalty" },
  { label: "Panier", icon: ShoppingCart, path: "/cart", badge: true },
  { label: "Commandes", icon: ClipboardList, path: "/orders" },
  { label: "Profil", icon: User, path: "/profile" },
];

const BottomNav = forwardRef<HTMLElement>((_, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { totalItems } = useCart();

  return (
    <nav ref={ref} className="bottom-navigation fixed bottom-0 left-0 right-0 z-50 border-t border-border px-2 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 p-2 h-14 w-16 relative transition-colors ${
                active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={item.label}
            >
              <div className="relative">
                <item.icon className={`${active ? "h-6 w-6" : "h-5 w-5"} transition-all`} strokeWidth={active ? 2.5 : 2} />
                {item.badge && totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
