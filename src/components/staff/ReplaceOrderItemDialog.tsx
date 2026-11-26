import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { getWeightOptions, isWeightUnit } from "@/lib/product-units";
import { unavailablePolicyLabel } from "@/lib/staff-order-workflow";
import type { CatalogueProduct, StaffOrderItem } from "@/hooks/useStaffOrders";

interface Props {
  item: StaffOrderItem | null;
  orderItems: StaffOrderItem[];
  orderPolicy: string | undefined;
  saving: boolean;
  onClose: () => void;
  onConfirm: (choice: { productId: string; quantityValue: number; clientAgreed: boolean }) => void;
}

export default function ReplaceOrderItemDialog({ item: replacing, orderItems: items, orderPolicy, saving, onClose, onConfirm }: Props) {
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceProduct, setReplaceProduct] = useState<CatalogueProduct | null>(null);
  const [replaceQuantity, setReplaceQuantity] = useState(1);
  const [clientAgreed, setClientAgreed] = useState(false);

  useEffect(() => {
    if (!replacing) return;
    setReplaceSearch("");
    setReplaceProduct(null);
    setClientAgreed(false);
    if (catalogue.length === 0) {
      void supabase.from("products").select("id, name, price, unit_type, category_id").eq("is_active", true).order("name")
        .then(({ data }) => setCatalogue((data ?? []) as CatalogueProduct[]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when a new article is opened
  }, [replacing]);

  const chooseReplacement = (product: CatalogueProduct) => {
    setReplaceProduct(product);
    setClientAgreed(false);
    if (!replacing) return;
    if (isWeightUnit(product.unit_type)) {
      const options = getWeightOptions(product.category_id).map(option => option.value);
      const same = options.find(value => value === Number(replacing.quantity_value));
      setReplaceQuantity(same ?? options[0]);
    } else {
      setReplaceQuantity(Math.max(1, Math.round(Number(replacing.quantity_value))));
    }
  };

  const confirmReplace = () => {
    if (!replacing || !replaceProduct) return;
    onConfirm({ productId: replaceProduct.id, quantityValue: replaceQuantity, clientAgreed });
  };

  const replacementPrice = replaceProduct ? Math.round(replaceProduct.price * replaceQuantity * 100) / 100 : null;
  const priceChanges = replacing && replacementPrice !== null && replacementPrice !== Math.round(Number(replacing.line_total) * 100) / 100;
  const replaceMatches = catalogue
    .filter(product => product.id !== replacing?.product_id && !items.some(item => item.product_id === product.id && item.item_status !== "removed"))
    .filter(product => !replaceSearch.trim() || product.name.toLowerCase().includes(replaceSearch.trim().toLowerCase()))
    .slice(0, 30);

  return (
      <Dialog open={Boolean(replacing)} onOpenChange={open => { if (!open) onClose(); }}>
        <DialogContent className="max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl">Remplacer « {replacing?.product_name} »</DialogTitle>
            <DialogDescription>Choisissez un article similaire disponible.</DialogDescription>
          </DialogHeader>
          {(replacing?.unavailable_policy ?? orderPolicy) !== "replace" && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-semibold text-warning">Le client a demandé : {unavailablePolicyLabel(replacing?.unavailable_policy ?? orderPolicy ?? "call")}. Appelez-le avant de remplacer.</p>
          )}
          <Input value={replaceSearch} onChange={event => setReplaceSearch(event.target.value)} placeholder="Rechercher un produit…" className="h-12" />
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
            {replaceMatches.map(product => (
              <Button key={product.id} variant={replaceProduct?.id === product.id ? "default" : "ghost"} className="h-auto w-full justify-between whitespace-normal py-2 text-left" onClick={() => chooseReplacement(product)}>
                <span>{product.name}</span>
                <span className="shrink-0 text-xs">{formatPrice(product.price)}/{isWeightUnit(product.unit_type) ? "kg" : "pièce"}</span>
              </Button>
            ))}
            {replaceMatches.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Aucun produit trouvé</p>}
          </div>
          {replaceProduct && (
            <div className="space-y-3">
              {isWeightUnit(replaceProduct.unit_type) ? (
                <div className="grid grid-cols-4 gap-2">
                  {getWeightOptions(replaceProduct.category_id).map(option => (
                    <Button key={option.value} variant={replaceQuantity === option.value ? "default" : "secondary"} onClick={() => { setReplaceQuantity(option.value); setClientAgreed(false); }}>{option.label}</Button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <Button variant="secondary" disabled={replaceQuantity <= 1} onClick={() => { setReplaceQuantity(q => Math.max(1, q - 1)); setClientAgreed(false); }}>−</Button>
                  <span className="min-w-12 text-center text-lg font-bold">{replaceQuantity}</span>
                  <Button variant="secondary" onClick={() => { setReplaceQuantity(q => q + 1); setClientAgreed(false); }}>+</Button>
                </div>
              )}
              <p className="text-sm">Ancien prix : <strong>{formatPrice(Number(replacing?.line_total ?? 0))}</strong> · Nouveau prix : <strong className="text-primary">{formatPrice(replacementPrice ?? 0)}</strong></p>
              {priceChanges && (
                <label className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-semibold">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={clientAgreed} onChange={event => setClientAgreed(event.target.checked)} />
                  Le prix change : j’ai appelé le client et il accepte ce remplacement.
                </label>
              )}
            </div>
          )}
          <Button size="lg" className="h-14 w-full" disabled={!replaceProduct || saving || (!!priceChanges && !clientAgreed)} onClick={confirmReplace}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}Confirmer le remplacement
          </Button>
        </DialogContent>
      </Dialog>
  );
}
