import { productThumbnail } from "@/lib/productThumbnail";
import { CustomerHeader } from "@/components/OriginPromise";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Trash2, Plus, Minus, Beef } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import BottomNav from "@/components/BottomNav";
import { adjustQuantity, getQuantityRules } from "@/lib/product-units";
import { formatCartQuantity } from "@/lib/cart-display";
import ItemUnavailableChoice from "@/components/ItemUnavailableChoice";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(n) + " MAD";

const CartPage = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, updateUnavailablePolicy, removeItem, subtotal } = useCart();

  return (
    <div className="client-page min-h-screen bg-background">
      <CustomerHeader>
      <div className="brand-header sticky top-0 z-40 px-4 py-4 border-b-4 border-primary">
        <h1 className="text-xl font-bold">Mon Panier</h1>
      </div>
      </CustomerHeader>

      <div className="px-4 py-4">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">Votre panier est vide</h2>
            <p className="text-muted-foreground text-sm mb-6">Ajoutez des produits pour commencer votre commande</p>
            <Button onClick={() => navigate("/")}>Parcourir les produits</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const { minimum, maximum } = getQuantityRules(item.unit_type, item.category_id);
              const displayQty = formatCartQuantity(item.quantity, item.unit_type);
              return (
                <Card key={item.id} className="p-3 sm:p-4 space-y-3">
                  <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg bg-accent/30 flex items-center justify-center overflow-hidden shrink-0">
                    {item.image_url ? (
                      <img src={productThumbnail(item.image_url)} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Beef className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm leading-snug line-clamp-2">{item.name}</h4>
                    <p className="text-primary font-semibold text-sm mt-0.5">{formatPrice(item.price * item.quantity)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="w-9 h-9 rounded-full"
                        aria-label="Diminuer la quantité"
                        onClick={() => updateQuantity(item.id, adjustQuantity(item.unit_type, item.category_id, item.quantity, -1))}
                        disabled={item.quantity <= minimum && (maximum === null || item.quantity <= maximum)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-bold min-w-[52px] text-center tabular-nums">{displayQty}</span>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="w-9 h-9 rounded-full"
                        aria-label="Augmenter la quantité"
                        onClick={() => updateQuantity(item.id, adjustQuantity(item.unit_type, item.category_id, item.quantity, 1))}
                        disabled={maximum !== null && item.quantity >= maximum}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0 self-start"
                    aria-label={`Retirer ${item.name} du panier`}
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  </div>
                  <ItemUnavailableChoice name={item.name} value={item.unavailable_policy} onChange={policy => updateUnavailablePolicy(item.id, policy)} />
                </Card>
              );
            })}

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

            <Button className="w-full py-6 text-base font-bold" onClick={() => navigate("/checkout")}>
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
