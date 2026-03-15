import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Heart, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import QuantityDialog from "@/components/QuantityDialog";
import BottomNav from "@/components/BottomNav";

import { Product, Category } from "@/types/product";
import { formatPrice } from "@/lib/format";

const SearchPage = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("categories").select("id, name, emoji").order("sort_order"),
    ]);
    if (p.data) setProducts(p.data);
    if (c.data) setCategories(c.data);
    setLoading(false);
  };

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

  const filtered = products.filter((p) => {
    const matchQuery = !query || p.name.toLowerCase().includes(query.toLowerCase()) || (p.description || "").toLowerCase().includes(query.toLowerCase());
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    return matchQuery && matchCat;
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-4 border-b border-border/50">
        <h1 className="text-xl font-bold mb-3">Rechercher</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 bg-accent/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 scrollbar-hide">
          <Button
            variant={!selectedCategory ? "default" : "secondary"}
            size="sm"
            className="rounded-full whitespace-nowrap text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            Tout
          </Button>
          {categories.map((c) => (
            <Button
              key={c.id}
              variant={selectedCategory === c.id ? "default" : "secondary"}
              size="sm"
              className="rounded-full whitespace-nowrap text-xs"
              onClick={() => setSelectedCategory(c.id)}
            >
              {c.emoji} {c.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucun résultat trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`} className="block">
                <Card className="overflow-hidden border-0 shadow-lg group bg-card relative">
                  <div className="absolute top-2 right-2 z-10">
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm" onClick={(e) => e.preventDefault()}>
                      <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="aspect-square bg-accent/30 flex items-center justify-center relative overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary/20 animate-pulse" />
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-sm mb-1">{product.name}</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-primary">{formatPrice(product.price)}</span>
                        <span className="text-xs text-muted-foreground">/{product.unit_type === "weight" ? "Kg" : "Pièce"}</span>
                      </div>
                      <Button
                        size="icon"
                        className="rounded-full w-7 h-7"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(product); }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

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

export default SearchPage;
