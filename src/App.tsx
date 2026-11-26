import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { useIpBanCheck } from "@/hooks/useIpBanCheck";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import LoyaltyPage from "./pages/LoyaltyPage";
import AddressesPage from "./pages/AddressesPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/LoginPage";
import AdminSetupPage from "./pages/auth/AdminSetupPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import { getAccountAccess, destinationForRoles } from "@/lib/account-access";
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminDeliveryZones = lazy(() => import("./pages/admin/AdminDeliveryZones"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
import ContactPage from "./pages/ContactPage";
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminBannedIPs = lazy(() => import("./pages/admin/AdminBannedIPs"));
const DriverLayout = lazy(() => import("./pages/driver/DriverLayout"));
const DriverDashboard = lazy(() => import("./pages/driver/DriverDashboard"));
const DriverActiveDelivery = lazy(() => import("./pages/driver/DriverActiveDelivery"));
const DriverHistory = lazy(() => import("./pages/driver/DriverHistory"));
const DriverProfilePage = lazy(() => import("./pages/driver/DriverProfilePage"));
import ProductPage from "./pages/ProductPage";
import CheckoutPage from "./pages/CheckoutPage";
import RequireCheckoutSession from "./components/RequireCheckoutSession";
import OrderTrackingPage from "./pages/OrderTrackingPage";
const StaffLayout = lazy(() => import("./pages/staff/StaffLayout"));
const StaffOrders = lazy(() => import("./pages/staff/StaffOrders"));
const StaffLoyalty = lazy(() => import("./pages/staff/StaffLoyalty"));
import ErrorBoundary from "./components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
const queryClient = new QueryClient();

const BannedScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center px-6">
    <div className="text-center max-w-md space-y-4">
      <div className="text-6xl">🚫</div>
      <h1 className="text-2xl font-bold text-foreground">Accès bloqué</h1>
      <p className="text-muted-foreground">
        Votre accès à Chez Mima a été suspendu suite à un comportement inapproprié.
        Si vous pensez qu'il s'agit d'une erreur, veuillez nous contacter.
      </p>
    </div>
  </div>
);

// Redirect drivers/admins away from client routes on session restore
const RoleRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const clientRoutes = ["/", "/search", "/cart", "/orders", "/checkout", "/profile", "/loyalty", "/addresses"];
    const isClientRoute = clientRoutes.includes(location.pathname) || location.pathname.startsWith("/product/");

    if (!isClientRoute) return;

    const checkRole = async () => {
      const access = await getAccountAccess().catch(() => null);
      if (!access) return;
      const destination = destinationForRoles(access.roles);
      if (destination !== "/") navigate(destination, { replace: true });
    };

    checkRole();
  }, [location.pathname]);

  return null;
};

const AppContent = () => {
  const { banned, checked } = useIpBanCheck();
  if (banned) return <BannedScreen />;

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RoleRedirect />
        <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Chargement" /></div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/index" element={<Navigate to="/" replace />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/order-tracking/:id" element={<OrderTrackingPage />} />
          <Route path="/checkout" element={<RequireCheckoutSession><CheckoutPage /></RequireCheckoutSession>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/addresses" element={<AddressesPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin/setup" element={<AdminSetupPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="loyalty" element={<StaffLoyalty />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="drivers" element={<AdminDrivers />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="zones" element={<AdminDeliveryZones />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="banned-ips" element={<AdminBannedIPs />} />
          </Route>
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffOrders />} />
            <Route path="loyalty" element={<StaffLoyalty />} />
            <Route path="products" element={<AdminProducts />} />
          </Route>
          <Route path="/driver" element={<DriverLayout />}>
            <Route index element={<DriverDashboard />} />
            <Route path="delivery/:orderId" element={<DriverActiveDelivery />} />
            <Route path="history" element={<DriverHistory />} />
            <Route path="profile" element={<DriverProfilePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
