import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingCart } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  unit_type: string;
  image_url: string | null;
}

interface QuantityDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (product: Product, quantity: number) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(price) + " MAD";

const QuantityDialog = ({ product, open, onOpenChange, onConfirm }: QuantityDialogProps) => {
  const [quantity, setQuantity] = useState(1);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setQuantity(1);
    onOpenChange(isOpen);
  };

  if (!product) return null;

  const isKg = product.unit_type === "kg";
  const step = isKg ? 0.25 : 1;
  const min = isKg ? 0.25 : 1;
  const displayQty = isKg ? `${quantity} kg` : `${quantity}`;

  const decrease = () => setQuantity((q) => Math.max(min, +(q - step).toFixed(2)));
  const increase = () => setQuantity((q) => +(q + step).toFixed(2));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Ajouter au panier</DialogTitle>
          <DialogDescription className="text-center">Choisissez la quantité</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Product info */}
          <div className="flex items-center gap-3 w-full">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-accent/30 shrink-0">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary/20" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate">{product.name}</h4>
              <p className="text-primary font-semibold text-sm">
                {formatPrice(product.price)}/{product.unit_type}
              </p>
            </div>
          </div>

          {/* Quantity selector */}
          <div className="flex items-center gap-6">
            <Button
              variant="secondary"
              size="icon"
              className="w-12 h-12 rounded-full text-lg"
              onClick={decrease}
              disabled={quantity <= min}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <span className="text-2xl font-bold min-w-[80px] text-center">{displayQty}</span>
            <Button
              variant="secondary"
              size="icon"
              className="w-12 h-12 rounded-full text-lg"
              onClick={increase}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Total */}
          <p className="text-muted-foreground text-sm">
            Total: <span className="font-bold text-foreground">{formatPrice(product.price * quantity)}</span>
          </p>

          {/* Confirm */}
          <Button
            className="w-full py-6 text-base font-bold gap-2"
            onClick={() => {
              onConfirm(product, quantity);
              onOpenChange(false);
            }}
          >
            <ShoppingCart className="h-5 w-5" />
            Ajouter au panier
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuantityDialog;
