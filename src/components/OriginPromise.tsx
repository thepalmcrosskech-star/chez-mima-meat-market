import { Flag, ShieldCheck } from "lucide-react";

/**
 * Rassiure le client dès le premier écran : nos produits sont préparés au
 * Maroc et 100 % halal. Le style de la boutique peut laisser un doute, ces
 * mentions doivent donc rester visibles.
 */
export function OriginBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        100% Marocain
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        100% Halal
      </span>
    </div>
  );
}

/** Bandeau complet : pastilles + phrase d'explication. */
export function OriginPromiseBar({ className = "" }: { className?: string }) {
  return (
    <section
      className={`brand-header border-b border-sidebar-border px-4 py-2.5 ${className}`}
      aria-label="Origine et certification de nos produits"
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <OriginBadges />
        <p className="text-center text-xs leading-snug text-sidebar-foreground/80">
          100% de nos produits sont préparés au Maroc et 100% halal.
        </p>
      </div>
    </section>
  );
}
