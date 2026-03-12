import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Product {
  id: string;
  name: string;
  price: number;
  unit_type: string;
  image_url: string | null;
  category_id?: string | null;
}

interface QuantityDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (product: Product, quantity: number) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(price) + " MAD";

const CHARCUTERIE_CATEGORY_ID = "f6741cb2-ac67-47bb-900d-8d54fb05d1e6";

const WEIGHT_OPTIONS_DEFAULT = [
  { label: "250g", value: 0.25 },
  { label: "500g", value: 0.5 },
  { label: "750g", value: 0.75 },
  { label: "1kg", value: 1 },
];

const WEIGHT_OPTIONS_CHARCUTERIE = [
  { label: "100g", value: 0.1 },
  { label: "200g", value: 0.2 },
  { label: "300g", value: 0.3 },
  { label: "500g", value: 0.5 },
];

const QuantityContent = ({
  product,
  onConfirm,
  onClose,
}: {
  product: Product;
  onConfirm: (product: Product, quantity: number) => void;
  onClose: () => void;
}) => {
  const isWeight = product.unit_type === "weight" || product.unit_type === "kg";
  const isCharcuterie = product.category_id === CHARCUTERIE_CATEGORY_ID;
  const WEIGHT_OPTIONS = isCharcuterie ? WEIGHT_OPTIONS_CHARCUTERIE : WEIGHT_OPTIONS_DEFAULT;
  const [quantity, setQuantity] = useState(isCharcuterie ? 0.1 : 0.25);
  const [pieceQty, setPieceQty] = useState(1);
  const currentQty = isWeight ? quantity : pieceQty;

  return (
    <div className="flex flex-col items-center gap-4 py-4 px-2">
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
          onClose();
        }}
      >
        <ShoppingCart className="h-5 w-5" />
        Ajouter au panier
      </Button>
    </div>
  );
};

const QuantityDialog = ({ product, open, onOpenChange, onConfirm }: QuantityDialogProps) => {
  const isMobile = useIsMobile();

  if (!product) return null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">Ajouter au panier</DrawerTitle>
            <DrawerDescription className="text-center">Choisissez la quantité</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <QuantityContent
              product={product}
              onConfirm={onConfirm}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Ajouter au panier</DialogTitle>
          <DialogDescription className="text-center">Choisissez la quantité</DialogDescription>
        </DialogHeader>
        <QuantityContent
          product={product}
          onConfirm={onConfirm}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default QuantityDialog;
