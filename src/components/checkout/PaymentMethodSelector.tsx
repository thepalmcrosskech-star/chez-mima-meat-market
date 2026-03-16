import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Banknote, CreditCard, Check } from "lucide-react";
import { formatPrice } from "@/lib/format";

interface PaymentMethodSelectorProps {
  paymentMethod: "cash" | "card";
  onPaymentMethodChange: (method: "cash" | "card") => void;
  cashBillAmount: number | null;
  onCashBillChange: (amount: number | null) => void;
  total: number;
}

const BILL_OPTIONS = [20, 50, 100, 200];

const PaymentMethodSelector = ({
  paymentMethod,
  onPaymentMethodChange,
  cashBillAmount,
  onCashBillChange,
  total,
}: PaymentMethodSelectorProps) => {
  return (
    <div className="space-y-3">
      <h3 className="font-bold flex items-center gap-2">
        <Banknote className="h-4 w-4 text-primary" /> Mode de paiement
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <Card
          className={`p-4 cursor-pointer transition-all text-center ${
            paymentMethod === "cash"
              ? "border-primary ring-2 ring-primary/20"
              : "hover:border-primary/50"
          }`}
          onClick={() => onPaymentMethodChange("cash")}
        >
          <Banknote
            className={`h-6 w-6 mx-auto mb-2 ${
              paymentMethod === "cash" ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <p className="text-sm font-semibold">Espèces</p>
          <p className="text-xs text-muted-foreground">Paiement à la livraison</p>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all text-center relative ${
            paymentMethod === "card"
              ? "border-primary ring-2 ring-primary/20"
              : "hover:border-primary/50 opacity-50"
          }`}
          onClick={() => onPaymentMethodChange("card")}
        >
          <CreditCard
            className={`h-6 w-6 mx-auto mb-2 ${
              paymentMethod === "card" ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <p className="text-sm font-semibold">Carte bancaire</p>
          <p className="text-xs text-muted-foreground">Paiement en ligne</p>
          <span className="absolute top-1 right-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
            Bientôt
          </span>
        </Card>
      </div>

      {/* Cash bill selector */}
      {paymentMethod === "cash" && (
        <Card className="p-4 space-y-3 border-primary/20 bg-primary/5">
          <div>
            <Label className="text-sm font-semibold">
              Avec quel billet allez-vous payer ?
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pour préparer votre monnaie ({formatPrice(total)} à payer)
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {BILL_OPTIONS.map((bill) => {
              const isSelected = cashBillAmount === bill;
              const isDisabled = bill < total;
              return (
                <button
                  key={bill}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onCashBillChange(isSelected ? null : bill)}
                  className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                    isDisabled
                      ? "border-muted bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                      : isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-background text-foreground hover:border-primary/50"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <span className="text-lg font-bold">{bill}</span>
                  <span className="block text-[10px] text-muted-foreground">MAD</span>
                </button>
              );
            })}
          </div>

          {cashBillAmount && cashBillAmount >= total && (
            <p className="text-xs text-green-600 font-medium">
              💰 Monnaie à rendre : {formatPrice(cashBillAmount - total)}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Pas de monnaie exacte ? Laissez vide, le livreur s'en chargera.
          </p>
        </Card>
      )}

      {/* Card not available yet */}
      {paymentMethod === "card" && (
        <Card className="p-4 border-amber-500/30 bg-amber-50">
          <p className="text-sm text-amber-700 font-medium">
            🏗️ Le paiement par carte bancaire (CMI) sera disponible très prochainement.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            En attendant, vous pouvez payer en espèces à la livraison.
          </p>
        </Card>
      )}
    </div>
  );
};

export default PaymentMethodSelector;
