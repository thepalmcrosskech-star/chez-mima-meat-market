import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Banknote, CreditCard, Check, Coins } from "lucide-react";
import { formatPrice } from "@/lib/format";

interface PaymentMethodSelectorProps {
  paymentMethod: "cash" | "card";
  onPaymentMethodChange: (method: "cash" | "card") => void;
  cashBillAmount: number | null;
  onCashBillChange: (amount: number | null) => void;
  total: number;
}

type CashMode = "exact" | "custom" | null;

const PaymentMethodSelector = ({
  paymentMethod,
  onPaymentMethodChange,
  cashBillAmount,
  onCashBillChange,
  total,
}: PaymentMethodSelectorProps) => {
  const [cashMode, setCashMode] = useState<CashMode>(null);
  const [customAmount, setCustomAmount] = useState("");

  const handleCashModeChange = (mode: CashMode) => {
    setCashMode(mode);
    if (mode === "exact") {
      onCashBillChange(null);
      setCustomAmount("");
    } else if (mode === "custom") {
      onCashBillChange(null);
      setCustomAmount("");
    }
  };

  const handleCustomAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    setCustomAmount(cleaned);
    const num = parseInt(cleaned, 10);
    if (num && num >= total) {
      onCashBillChange(num);
    } else {
      onCashBillChange(null);
    }
  };

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

      {/* Cash options */}
      {paymentMethod === "cash" && (
        <Card className="p-4 space-y-3 border-primary/20 bg-primary/5">
          <div>
            <Label className="text-sm font-semibold">
              Avez-vous l'appoint ?
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total à payer : {formatPrice(total)}
            </p>
          </div>

          {/* Option: Exact change */}
          <button
            type="button"
            onClick={() => handleCashModeChange("exact")}
            className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left ${
              cashMode === "exact"
                ? "border-primary bg-primary/10"
                : "border-border bg-background hover:border-primary/50"
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              cashMode === "exact" ? "bg-primary" : "bg-muted"
            }`}>
              {cashMode === "exact" ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Coins className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">Oui, j'ai l'appoint</p>
              <p className="text-xs text-muted-foreground">Je paierai {formatPrice(total)} exactement</p>
            </div>
          </button>

          {/* Option: Specify amount */}
          <button
            type="button"
            onClick={() => handleCashModeChange("custom")}
            className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left ${
              cashMode === "custom"
                ? "border-primary bg-primary/10"
                : "border-border bg-background hover:border-primary/50"
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              cashMode === "custom" ? "bg-primary" : "bg-muted"
            }`}>
              {cashMode === "custom" ? (
                <Check className="h-4 w-4 text-primary-foreground" />
              ) : (
                <Banknote className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">Non, combien allez-vous donner ?</p>
              <p className="text-xs text-muted-foreground">Indiquez le montant exact que vous donnerez au livreur</p>
            </div>
          </button>

          {/* Custom amount input */}
          {cashMode === "custom" && (
            <div className="space-y-2 pl-2">
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 150"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="pr-14 text-lg font-bold"
                  maxLength={5}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">MAD</span>
              </div>
              {customAmount && parseInt(customAmount, 10) < total && (
                <p className="text-xs text-destructive font-medium">
                  ⚠️ Le montant doit être supérieur ou égal à {formatPrice(total)}
                </p>
              )}
              {cashBillAmount && cashBillAmount >= total && (
                <p className="text-xs text-green-600 font-medium">
                  💰 Monnaie à rendre : {formatPrice(cashBillAmount - total)}
                </p>
              )}
            </div>
          )}
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
