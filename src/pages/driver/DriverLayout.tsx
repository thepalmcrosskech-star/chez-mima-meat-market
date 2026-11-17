import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import DriverBottomNav from "@/components/driver/DriverBottomNav";
import { getAccountAccess } from "@/lib/account-access";
import { brandLogo } from "@/lib/brand";

const DriverLayout = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState("");
  const [driverStatus, setDriverStatus] = useState("offline");

  useEffect(() => {
    checkDriverAccess();
  }, []);

  const checkDriverAccess = async () => {
    const access = await getAccountAccess().catch(() => null);
    if (!access) { navigate("/login"); return; }
    const { user, roles } = access;

    const [profileRes, driverRes] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).single(),
      supabase.from("driver_profiles").select("status").eq("user_id", user.id).single(),
    ]);

    if (profileRes.error || !profileRes.data || (!roles.includes("driver") && !roles.includes("admin"))) {
      navigate("/");
      return;
    }

    setDriverName(profileRes.data.name);
    if (driverRes.data) setDriverStatus(driverRes.data.status);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="client-page detail-page min-h-screen bg-background relative">
      {/* Header */}
      <div className="brand-header sticky top-0 z-40 px-4 py-3 flex items-center justify-between gap-3 border-b-4 border-primary">
        <div className="flex shrink-0 items-center gap-3">
          <img src={brandLogo} alt="Chez Mima" className="h-10 w-14 object-contain" />
          <span className="font-display text-2xl">CHEZ MIMA</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium truncate">{driverName}</span>
          <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${
            driverStatus === "available" ? "bg-success" :
            driverStatus === "busy" ? "bg-primary animate-pulse" : "bg-muted-foreground"
          }`} />
        </div>
      </div>

      {/* Content */}
      <div className="pb-20">
        <Outlet />
      </div>

      <DriverBottomNav />
    </div>
  );
};

export default DriverLayout;
