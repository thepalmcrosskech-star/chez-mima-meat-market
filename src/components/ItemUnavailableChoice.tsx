import { ArrowLeftRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itemUnavailablePolicy, type ItemUnavailablePolicy } from "@/lib/item-unavailable-policy";

export default function ItemUnavailableChoice({ name, value, onChange }: {
  name: string;
  value?: ItemUnavailablePolicy;
  onChange: (value: ItemUnavailablePolicy) => void;
}) {
  const selected = itemUnavailablePolicy(value);
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-xs font-semibold text-muted-foreground">Si non disponible</legend>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Si ${name} est indisponible`}>
        <Button type="button" size="sm" className="gap-1.5 px-2" role="radio" aria-checked={selected === "replace"}
          variant={selected === "replace" ? "default" : "outline"} onClick={() => onChange("replace")}>
          <ArrowLeftRight className="h-4 w-4 shrink-0" /> Remplacer
        </Button>
        <Button type="button" size="sm" className="gap-1.5 px-2" role="radio" aria-checked={selected === "remove_item"}
          variant={selected === "remove_item" ? "default" : "outline"} onClick={() => onChange("remove_item")}>
          <RotateCcw className="h-4 w-4 shrink-0" /> Rembourser
        </Button>
      </div>
      {selected === "remove_item" && <p className="text-xs text-muted-foreground">Article retiré et non facturé ; remboursé seulement s’il est déjà payé.</p>}
    </fieldset>
  );
}