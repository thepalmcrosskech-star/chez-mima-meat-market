import { forwardRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus } from "lucide-react";

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

const WEIGHT_OPTIONS = [
  { label: "250g", value: 0.25 },
  { label: "500g", value: 0.5 },
  { label: "750g", value: 0.75 },
  { label: "1kg", value: 1 },
];

const QuantityDialog = forwardRef<HTMLDivElement, QuantityDialogProps>(
  ({ product, open, onOpenChange, onConfirm }, ref) => {
    const [quantity, setQuantity] = useState(0.25);
    const [pieceQty, setPieceQty] = useState(1);

    const handleOpen = (isOpen: boolean) => {
      if (isOpen) {
        setQuantity(0.25);
        setPieceQty(1);
      }
      onOpenChange(isOpen);
    };

    if (!product) return null;

    const isWeight = product.unit_type === "weight" || product.unit_type === "kg";
    const currentQty = isWeight ? quantity : pieceQty;

    return (
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent ref={ref} className="max-w-sm mx-auto">
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
                  {formatPrice(product.price)}/{isWeight ? "kg" : "pièce"}
                </p>
              </div>
            </div>

            {/* Quantity selector */}
            {isWeight ? (
              <div className="grid grid-cols-4 gap-2 w-full">
                {WEIGHT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={quantity === opt.value ? "default" : "secondary"}
                    className="py-6 text-base font-bold rounded-xl"
                    onClick={() => setQuantity(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-12 h-12 rounded-full text-lg"
                  onClick={() => setPieceQty((q) => Math.max(1, q - 1))}
                  disabled={pieceQty <= 1}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <span className="text-2xl font-bold min-w-[80px] text-center">{pieceQty}</span>
                <Button
                  variant="secondary"
                  size="icon"
                  className="w-12 h-12 rounded-full text-lg"
                  onClick={() => setPieceQty((q) => q + 1)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Total */}
            <p className="text-muted-foreground text-sm">
              Total: <span className="font-bold text-foreground">{formatPrice(product.price * currentQty)}</span>
            </p>

            {/* Confirm */}
            <Button
              className="w-full py-6 text-base font-bold gap-2"
              onClick={() => {
                onConfirm(product, currentQty);
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
  },
);

QuantityDialog.displayName = "QuantityDialog";

export default QuantityDialog;
