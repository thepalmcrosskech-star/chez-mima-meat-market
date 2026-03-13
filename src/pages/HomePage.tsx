import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Heart, Bell, Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import QuantityDialog from "@/components/QuantityDialog";
import logo from "@/assets/logo.jpeg";
import BottomNav from "@/components/BottomNav";

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
  const { addItem } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get("cat"));
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);

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
    const [categoriesRes, productsRes] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").eq("is_active", true),
    ]);

    if (categoriesRes.data) {
      setCategories(categoriesRes.data);
      if (!selectedCategory && categoriesRes.data.length > 0) {
        const defaultCat = categoriesRes.data[0].id;
        setSelectedCategory(defaultCat);
        setSearchParams({ cat: defaultCat }, { replace: true });
      }
    }
    if (productsRes.data) setProducts(productsRes.data);
    setLoading(false);
  };

  const handleAddToCart = (product: Product) => {
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

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products;

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
      <header className="sticky top-0 z-50 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Chez Mima" className="w-10 h-10 rounded-full object-cover border-2 border-primary" />
          <h1 className="text-xl font-extrabold tracking-tighter text-foreground gradient-text">
            CHEZ MIMA
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative hover-scale">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border border-background notification-pulse"></span>
          </Button>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="px-4 py-6">
        <Card className="relative w-full h-56 rounded-2xl overflow-hidden group border-0 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-hero"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent"></div>
          <div className="relative h-full flex flex-col justify-center px-6 text-white">
            <div className="bg-primary/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full w-fit mb-4 animate-fade-in">
              OFFRE DU JOUR
            </div>
            <h2 className="text-4xl font-bold leading-tight mb-2 animate-slide-up">
              Côte de<br />
              Bœuf<br />
              Maturée
            </h2>
            <p className="text-white/90 text-lg mb-6 animate-slide-up animation-delay-200">
              Sélection Premium<br />d'exception
            </p>
            <Button className="bg-primary hover:bg-primary/90 text-white w-fit px-8 py-3 font-bold rounded-xl transition-all duration-300 hover-scale">
              Commander
            </Button>
          </div>
          <div className="absolute top-4 right-4 opacity-20">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary via-red-500 to-red-700 animate-pulse"></div>
          </div>
        </Card>
      </section>

      {/* Categories */}
      <section className="px-4 mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
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
      </section>

      {/* Products Section */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-foreground">Nos Meilleurs Produits</h3>
          <Button variant="link" className="text-primary font-semibold" onClick={() => navigate("/search")}>
            Voir tout
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              Aucun produit dans cette catégorie
            </div>
          ) : (
            filteredProducts.map((product, index) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="block"
              >
                <Card
                  className="relative overflow-hidden rounded-2xl border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover-scale group bg-card"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="absolute top-3 right-3 z-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Heart className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                    </Button>
                  </div>

                  <div className="aspect-square bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center relative overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 animate-pulse"></div>
                    )}
                  </div>

                  <div className="p-4">
                    <h4 className="font-bold text-card-foreground mb-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                      {product.description || ""}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
                        <span className="text-sm text-muted-foreground">/{product.unit_type}</span>
                      </div>
                      <Button 
                        size="icon" 
                        className="bg-primary hover:bg-primary/90 rounded-full w-8 h-8 hover-scale"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(product); }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
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
