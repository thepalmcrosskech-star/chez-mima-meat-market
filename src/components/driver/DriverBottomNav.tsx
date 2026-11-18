import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Package, User } from "lucide-react";

const navItems = [
  { label: "Accueil", icon: Home, path: "/driver" },
  { label: "Livraisons", icon: Package, path: "/driver/history" },
  { label: "Profil", icon: User, path: "/driver/profile" },
];

const DriverBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="bottom-navigation fixed bottom-0 left-0 right-0 z-50 border-t border-border px-2 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant="ghost"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center p-2 h-auto rounded-xl gap-1 transition-colors ${
                active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={item.label}
            >
              <item.icon className={`${active ? "h-6 w-6" : "h-5 w-5"} transition-all`} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
};

export default DriverBottomNav;
