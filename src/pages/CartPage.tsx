import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import BottomNav from "@/components/BottomNav";

// For now, static cart — will be connected to state management later
const CartPage = () => {
  const [cartItems, setCartItems] = useState<any[]>([]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md px-4 py-4 border-b border-border/50">
        <h1 className="text-xl font-bold">Mon Panier</h1>
      </div>

      <div className="px-4 py-4">
        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">Votre panier est vide</h2>
            <p className="text-muted-foreground text-sm mb-6">Ajoutez des produits pour commencer votre commande</p>
            <Button onClick={() => window.location.href = "/"}>Parcourir les produits</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {cartItems.map((item, i) => (
              <Card key={i} className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-accent/30 flex items-center justify-center overflow-hidden shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate">{item.name}</h4>
                  <p className="text-primary font-semibold text-sm">{formatPrice(item.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon" className="w-7 h-7 rounded-full">
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                  <Button variant="secondary" size="icon" className="w-7 h-7 rounded-full">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}

            <Card className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Livraison</span>
                <span className="text-muted-foreground">Calculée à la commande</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                <span>Total</span>
                <span className="text-primary">{formatPrice(subtotal)}</span>
              </div>
            </Card>

            <Button className="w-full py-6 text-base font-bold">
              Passer la commande
            </Button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default CartPage;
