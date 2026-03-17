import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Plus, Loader2, Sun, Moon, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import QuantityDialog from "@/components/QuantityDialog";
import logo from "@/assets/logo-transparent.png";
import BottomNav from "@/components/BottomNav";
import FavoriteProducts from "@/components/FavoriteProducts";
import { useWishlist, WishlistButton } from "@/components/WishlistButton";
import NotificationBell from "@/components/NotificationBell";
import { usePushSubscription } from "@/hooks/usePushSubscription";

import { Product, Category } from "@/types/product";
import { formatPrice } from "@/lib/format";

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  link_url: string;
  button_text: string;
}

const HomePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toggle: toggleWishlist, isFavorite } = useWishlist();
  const { addItem } = useCart();
  usePushSubscription();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get("cat") ?? "all");
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [themeIcon, setThemeIcon] = useState<string>(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setAuthChecked(true);
      fetchData();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      }
    });

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchData = async () => {
    const [categoriesRes, productsRes, bannersRes, reviewsRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*"),
      supabase.from("banners").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("product_reviews").select("product_id, rating"),
    ]);

    if (categoriesRes.data) {
      setCategories(categoriesRes.data);
    }
    if (productsRes.data) setProducts(productsRes.data);
    if (bannersRes.data) setBanners(bannersRes.data as Banner[]);
    
    // Compute average ratings per product
    if (reviewsRes.data) {
      const ratingsMap: Record<string, { sum: number; count: number }> = {};
      for (const r of reviewsRes.data) {
        if (!ratingsMap[r.product_id]) ratingsMap[r.product_id] = { sum: 0, count: 0 };
        ratingsMap[r.product_id].sum += r.rating;
        ratingsMap[r.product_id].count += 1;
      }
      const avgMap: Record<string, number> = {};
      for (const [pid, val] of Object.entries(ratingsMap)) {
        avgMap[pid] = val.sum / val.count;
      }
      setProductRatings(avgMap);
    }
    
    setLoading(false);
  };

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleAddToCart = (product: Product) => {
    if (!product.is_active) return;
    setSelectedProduct(product);
    setQuantityDialogOpen(true);
  };

  const handleConfirmAdd = (product: Product, quantity: number) => {
    addItem(
      { id: product.id, name: product.name, price: product.price, unit_type: product.unit_type, image_url: product.image_url },
      quantity
    );
    toast({ title: "Ajouté au panier", description: `${quantity} ${product.unit_type === "kg" ? "kg" : "×"} ${product.name}` });
  };

  const filteredProducts = (() => {
    const list = selectedCategory && selectedCategory !== "all"
      ? products.filter((p) => p.category_id === selectedCategory)
      : products;
    return [...list].sort((a, b) => {
      // Active products first, then by rating
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return (productRatings[b.id] || 0) - (productRatings[a.id] || 0);
    });
  })();

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border/50 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Chez Mima" className="h-12 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] dark:drop-shadow-none" />
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground">Boucherie & Charcuterie</span>
            <span className="text-lg font-semibold tracking-wide text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Chez <span className="text-primary">Mima</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            className="hover-scale"
            aria-label="Basculer thème clair/sombre"
            onClick={() => {
              const html = document.documentElement;
              const isDark = html.classList.contains("dark");
              if (isDark) {
                html.classList.remove("dark");
                localStorage.setItem("theme", "light");
              } else {
                html.classList.add("dark");
                localStorage.setItem("theme", "dark");
              }
              // force re-render to swap icon
              setThemeIcon(isDark ? "light" : "dark");
            }}
          >
            {themeIcon === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Hero Banners */}
      {banners.length > 0 && (
        <section className="px-4 py-6">
          <div className="relative">
            <Card className="relative w-full h-56 rounded-2xl overflow-hidden border-0 shadow-2xl">
              {banners[currentBanner]?.image_url && (
                <img
                  src={banners[currentBanner].image_url!}
                  alt={banners[currentBanner].title}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
              <div className="relative h-full flex flex-col justify-center px-6 text-white">
                <h2 className="text-3xl font-bold leading-tight mb-2">
                  {banners[currentBanner]?.title}
                </h2>
                {banners[currentBanner]?.subtitle && (
                  <p className="text-white/90 text-base mb-4">
                    {banners[currentBanner].subtitle}
                  </p>
                )}
                {banners[currentBanner]?.link_url && (
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-fit px-6 py-2 font-bold rounded-xl"
                    onClick={() => {
                      const url = banners[currentBanner].link_url;
                      if (url.startsWith("http")) window.open(url, "_blank");
                      else navigate(url);
                    }}
                  >
                    {banners[currentBanner]?.button_text || "Découvrir"}
                  </Button>
                )}
              </div>
            </Card>

            {/* Dots */}
            {banners.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBanner(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentBanner ? "bg-primary w-6" : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="px-4 mb-6">
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === "all" ? "default" : "secondary"}
              className={`rounded-full px-6 py-2 text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-lg scale-105"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover-scale"
              }`}
              onClick={() => {
                setSelectedCategory("all");
                setSearchParams({}, { replace: true });
              }}
            >
              🏠 Tous
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "secondary"}
                className={`rounded-full px-6 py-2 text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                  selectedCategory === category.id
                    ? "bg-primary text-primary-foreground shadow-lg scale-105"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover-scale"
                }`}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSearchParams({ cat: category.id }, { replace: true });
                }}
              >
                {category.emoji} {category.name}
              </Button>
            ))}
          </div>
          {/* Scroll hint arrow */}
          <div className="absolute right-0 top-0 bottom-2 w-12 flex items-center justify-end pointer-events-none bg-gradient-to-l from-background via-background/80 to-transparent">
            <ChevronRight className="h-7 w-7 text-primary animate-pulse drop-shadow-md" />
          </div>
        </div>
      </section>

      {/* Favorite Products */}
      <FavoriteProducts onAddToCart={handleAddToCart} />

      {/* Products Section */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-foreground">Nos Meilleurs Produits</h3>
          <Button variant="link" className="text-primary font-semibold" onClick={() => navigate("/search")}>
            Voir tout
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 items-stretch">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              Aucun produit dans cette catégorie
            </div>
          ) : (
            filteredProducts.map((product, index) => {
              const unavailable = !product.is_active;
              return (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="block h-full"
              >
                 <Card
                  className={`relative overflow-hidden rounded-2xl border-0 shadow-lg transition-all duration-500 group bg-card h-full flex flex-col ${unavailable ? "" : "hover:shadow-2xl hover-scale"}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {!unavailable && (
                    <div className="absolute top-3 right-3 z-10">
                      <WishlistButton
                        productId={product.id}
                        isFavorite={isFavorite(product.id)}
                        onToggle={toggleWishlist}
                      />
                    </div>
                  )}

                  <div className="aspect-square bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center relative overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className={`w-full h-full object-cover transition-all duration-300 ${unavailable ? "opacity-60 blur-[1px]" : ""}`}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 animate-pulse"></div>
                    )}

                    {unavailable && (
                      <>
                        <div className="absolute inset-0 z-10 bg-black/20" />
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none gap-1">
                          <span className="bg-destructive text-destructive-foreground text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-lg animate-soft-pulse">
                            Épuisé
                          </span>
                          <span className="text-white text-[11px] drop-shadow-md italic" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            Bientôt de retour
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-1 min-h-[110px]">
                    <h4 className="font-bold text-card-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                      {product.name}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                      {product.description || "\u00A0"}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
                        <span className="text-sm text-muted-foreground">/{product.unit_type === "weight" ? "Kg" : "Pièce"}</span>
                      </div>
                      {!unavailable && (
                        <Button 
                          size="icon" 
                          className="bg-primary hover:bg-primary/90 rounded-full w-8 h-8 hover-scale"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(product); }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
              );
            })
          )}
        </div>
      </section>

      <QuantityDialog
        product={selectedProduct}
        open={quantityDialogOpen}
        onOpenChange={setQuantityDialogOpen}
        onConfirm={handleConfirmAdd}
      />

      <BottomNav />
    </div>
  );
};

export default HomePage;
