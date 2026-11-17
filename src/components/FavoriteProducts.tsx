import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, Plus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/product";
import { formatPrice } from "@/lib/format";

interface FavoriteProductsProps {
  onAddToCart: (product: Product) => void;
}

interface FavoriteProduct extends Product {
  order_count: number;
}

const FavoriteProducts = ({ onAddToCart }: FavoriteProductsProps) => {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get products ordered by this user, grouped by product_id with count
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, order_id, orders!inner(user_id)")
      .eq("orders.user_id", user.id);

    if (!orderItems || orderItems.length === 0) {
      setLoading(false);
      return;
    }

    // Count occurrences per product_id
    const countMap: Record<string, number> = {};
    for (const item of orderItems) {
      if (item.product_id) {
        countMap[item.product_id] = (countMap[item.product_id] || 0) + 1;
      }
    }

    // Get top 6 most ordered product IDs
    const sorted = Object.entries(countMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    if (sorted.length === 0) {
      setLoading(false);
      return;
    }

    const productIds = sorted.map(([id]) => id);
    const countLookup = Object.fromEntries(sorted);

    const { data: products } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds)
      .eq("is_active", true);

    if (products) {
      const enriched: FavoriteProduct[] = products
        .map((p) => ({ ...p, order_count: countLookup[p.id] || 0 }))
        .sort((a, b) => b.order_count - a.order_count);
      setFavorites(enriched);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <section className="px-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-primary fill-primary" />
          <h3 className="text-xl font-bold text-foreground">Vos Favoris</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (favorites.length === 0) return null;

  return (
    <section className="px-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="h-5 w-5 text-primary fill-primary" />
        <h3 className="text-xl font-bold text-foreground">Vos Favoris</h3>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {favorites.map((product) => (
          <Link
            key={product.id}
            to={`/product/${product.id}`}
            className="block flex-shrink-0 w-40"
          >
            <Card className="relative overflow-hidden rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover-scale group bg-card h-full flex flex-col">
              {/* Order count badge */}
              <div className="absolute top-2 left-2 z-10">
                <span className="flex items-center gap-1 bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
                  <RefreshCw className="h-3 w-3" />
                  {product.order_count}×
                </span>
              </div>

              <div className="aspect-square bg-gradient-to-br from-muted/20 to-muted/40 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 animate-pulse" />
                )}
              </div>

              <div className="p-3 flex flex-col flex-1">
                <h4 className="font-bold text-card-foreground text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                  {product.name}
                </h4>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-sm font-bold text-primary">{formatPrice(product.price)}</span>
                  <Button
                    size="icon"
                    className="bg-primary hover:bg-primary/90 rounded-full w-7 h-7 hover-scale"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAddToCart(product);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default FavoriteProducts;
