import { CustomerHeader } from "@/components/OriginPromise";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLink } from "@/components/AppLink";
import { Plus, Loader2, Sun, Moon, ChevronRight, Beef } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import QuantityDialog from "@/components/QuantityDialog";
import { brandLogo as logo } from "@/lib/brand";
import BottomNav from "@/components/BottomNav";
import { useWishlist, WishlistButton } from "@/components/WishlistButton";
import NotificationBell from "@/components/NotificationBell";
import { usePushSubscription } from "@/hooks/usePushSubscription";

import { Product, Category } from "@/types/product";
import { isWeightUnit } from "@/lib/product-units";
import { formatPrice } from "@/lib/format";
import { groupByFamily, familyMinPrice } from "@/lib/product-families";
import { getTopSellingProducts } from "@/lib/top-selling-products";

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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [themeIcon, setThemeIcon] = useState<string>(localStorage.getItem("theme") || "light");
  const pageRef = useRef<HTMLDivElement>(null);
  const categoryBarRef = useRef<HTMLElement>(null);
  const categoryRowRef = useRef<HTMLDivElement>(null);
  const [categoryHint, setCategoryHint] = useState(false);
  const updateCategoryHint = useCallback(() => {
    const row = categoryRowRef.current;
    if (!row) return;
    setCategoryHint(row.scrollLeft + row.clientWidth < row.scrollWidth - 8);
  }, []);
  useEffect(() => {
    updateCategoryHint();
    window.addEventListener("resize", updateCategoryHint);
    return () => window.removeEventListener("resize", updateCategoryHint);
  }, [categories, updateCategoryHint]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [categoryBarStuck, setCategoryBarStuck] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // The category bar sticks right under the sticky banner: measure that banner.
  useEffect(() => {
    const banner = pageRef.current?.querySelector(".customer-header") as HTMLElement | null;
    if (!banner) return;
    const measure = () => setHeaderHeight(banner.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const bar = categoryBarRef.current;
    if (!bar) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setCategoryBarStuck(bar.getBoundingClientRect().top <= headerHeight + 1);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [headerHeight]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, productsRes, bannersRes, reviewsRes] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("*"),
        supabase.from("banners").select("*").eq("is_active", true).order("sort_order"),
        supabase.rpc("get_public_product_ratings"),
      ]);

      const hadErrors = [categoriesRes, productsRes, bannersRes, reviewsRes].some(({ error }) => error);
      setCategories(categoriesRes.data ?? []);
      const visibleCats = new Set((categoriesRes.data ?? []).map((c) => c.id));
      setProducts((productsRes.data ?? []).filter((p) => !p.category_id || visibleCats.has(p.category_id)));
      setBanners((bannersRes.data ?? []) as Banner[]);

      const ratingsMap: Record<string, { sum: number; count: number }> = {};
      for (const review of reviewsRes.data ?? []) {
        if (!ratingsMap[review.product_id]) ratingsMap[review.product_id] = { sum: 0, count: 0 };
        ratingsMap[review.product_id].sum += review.rating;
        ratingsMap[review.product_id].count += 1;
      }

      const avgMap: Record<string, number> = {};
      for (const [productId, value] of Object.entries(ratingsMap)) {
        avgMap[productId] = value.sum / value.count;
      }
      setProductRatings(avgMap);

      if (hadErrors) {
        toast({
          title: "Chargement incomplet",
          description: "Certaines informations ne sont pas disponibles. Réessayez dans un instant.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Impossible de charger la boutique",
        description: "Vérifiez votre connexion puis réessayez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
    toast({ title: "Ajouté au panier", description: `${quantity} ${isWeightUnit(product.unit_type) ? "kg" : "×"} ${product.name}` });
  };

  const filteredProducts = (() => {
    if (!selectedCategory || selectedCategory === "all") {
      return getTopSellingProducts(products);
    }

    return products
      .filter((product) => product.category_id === selectedCategory)
      .sort((a, b) => {
        // Active products first, then by rating
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return (productRatings[b.id] || 0) - (productRatings[a.id] || 0);
      });
  })();

  return (
    <div ref={pageRef} className="client-page min-h-screen bg-background">
      {/* Header */}
      <CustomerHeader>
      <header className="brand-header sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b-4 border-primary">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Chez Mima" className="h-12 w-16 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-medium uppercase text-sidebar-foreground/80">Boucherie & Charcuterie</span>
            <span className="font-display text-2xl text-sidebar-foreground">
              Chez Mima
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
      </CustomerHeader>

      {/* Hero Banners */}
      {banners.length > 0 && (
        <section className="px-4 py-6">
          <div className="relative">
            <Card className="relative w-full h-56 rounded-2xl overflow-hidden border-0 shadow-2xl">
              {banners[currentBanner]?.image_url && (
                <img
                  src={banners[currentBanner].image_url ?? undefined}
                  alt={banners[currentBanner].title}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-overlay/70 via-overlay/30 to-transparent" />
              <div className="relative h-full flex flex-col justify-center px-6 text-primary-foreground">
                <h2 className="text-3xl font-bold leading-tight mb-2">
                  {banners[currentBanner]?.title}
                </h2>
                {banners[currentBanner]?.subtitle && (
                  <p className="text-primary-foreground/90 text-base mb-4">
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
      <section
        ref={categoryBarRef}
        className={`px-4 mt-5 mb-6 sticky z-30 bg-background transition-shadow duration-200 ${
          categoryBarStuck ? "shadow-[0_6px_14px_-8px_hsl(var(--foreground)/.35)]" : ""
        }`}
        style={{ top: headerHeight }}
      >
        <div className="relative">
          <div ref={categoryRowRef} onScroll={updateCategoryHint} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
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
          {/* Scroll hint arrow, only while more rayons are hidden to the right */}
          {categoryHint && <div className="absolute right-0 top-0 bottom-2 w-12 flex items-center justify-end pointer-events-none bg-gradient-to-l from-background via-background/80 to-transparent">
            <ChevronRight className="h-7 w-7 text-primary animate-pulse drop-shadow-md" />
          </div>}
        </div>
      </section>

      {/* Products Section */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-normal text-foreground">
            {!selectedCategory || selectedCategory === "all" ? "Nos meilleures ventes" : "Nos produits"}
          </h3>
          <Button variant="link" className="text-primary font-semibold" onClick={() => navigate("/search")}>
            Voir tout
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-stretch">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              Aucun produit dans cette catégorie
            </div>
          ) : (
            groupByFamily(filteredProducts).map((entry, index) => {
              const product = entry.kind === "family" ? entry.lead : entry.product;
              const isFamily = entry.kind === "family";
              const unavailable = isFamily ? entry.products.every((p) => !p.is_active) : !product.is_active;
              const title = isFamily ? entry.family : product.name;
              const subtitle = isFamily ? `${entry.products.length} goûts au choix` : product.description;
              const price = isFamily ? familyMinPrice(entry.products) : product.price;
              return (
              <AppLink
                key={isFamily ? `family-${entry.family}` : product.id}
                to={`/product/${product.id}`}
                className="block h-full"
                ariaLabel={title}
              >
                 <Card
                  className={`relative overflow-hidden rounded-lg border shadow-sm transition-colors group bg-card h-full flex flex-col ${unavailable ? "" : "hover:border-primary/50"}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {!unavailable && !isFamily && (
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
                        alt={title}
                        className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${unavailable ? "opacity-60 blur-[1px]" : ""}`}
                        loading="lazy"
                      />
                    ) : (
                      <Beef className="h-14 w-14 text-muted-foreground/40" aria-hidden="true" />
                    )}

                    {unavailable && (
                      <>
                        <div className="absolute inset-0 z-10 bg-overlay/20" />
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none gap-1">
                          <span className="bg-destructive text-destructive-foreground text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-lg animate-soft-pulse">
                            Épuisé
                          </span>
                          <span className="text-primary-foreground text-[11px] drop-shadow-md italic" style={{ fontFamily: "'Bebas Neue', Barlow, sans-serif" }}>
                            Bientôt de retour
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-3 flex flex-col flex-1 min-h-[130px]">
                    <h4 className="font-semibold text-sm text-card-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2 min-h-10">
                      {title}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                      {subtitle || "\u00A0"}
                    </p>
                    
                    <div className="flex flex-wrap gap-1 items-center justify-between mt-auto">
                      <div>
                        {isFamily && <span className="text-xs text-muted-foreground">dès </span>}
                        <span className="text-lg font-bold text-primary">{formatPrice(price)}</span>
                        <span className="text-sm text-muted-foreground">/{product.unit_type === "weight" ? "kg" : "pièce"}</span>
                      </div>
                      {!unavailable && (
                        <Button 
                          size="icon" 
                          className="bg-primary hover:bg-primary/90 rounded-full w-8 h-8 hover-scale"
                          aria-label={isFamily ? `Choisir un goût ${title}` : `Ajouter ${title}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (isFamily) navigate(`/product/${product.id}`); else handleAddToCart(product); }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </AppLink>
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
