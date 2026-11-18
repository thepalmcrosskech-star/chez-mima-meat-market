export function OriginBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-x-3 sm:gap-x-6 ${className}`}>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 40" role="img" aria-label="Drapeau du Maroc" className="h-10 w-8 shrink-0">
          <path d="M2 1 H30 V30 L16 39 L2 30 Z" className="fill-morocco-red" />
          <path d="M16 7 L21.29 23.28 L7.44 13.22 L24.56 13.22 L10.71 23.28 Z" fill="none" className="stroke-morocco-green" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-xs sm:text-sm font-semibold text-sidebar-foreground/95">100% fait au Maroc</span>
          <span className="mt-1 text-[10px] sm:text-[11px] text-sidebar-foreground/65">Notre origine, notre fierté</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 40" aria-hidden="true" className="h-10 w-8 shrink-0">
          <path d="M2 1 H30 V30 L16 39 L2 30 Z" className="fill-morocco-green" />
          <path d="M9 17 L14 22 L23 12" fill="none" className="stroke-trust" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-xs sm:text-sm font-semibold text-trust">100% Halal</span>
          <span className="mt-1 text-[10px] sm:text-[11px] text-sidebar-foreground/65">Tous nos produits</span>
        </span>
      </div>
    </div>
  );
}

export function OriginPromiseBar({ className = "" }: { className?: string }) {
  return (
    <section
      className={`flex items-center justify-center px-3 pb-3 ${className}`}
      aria-label="Origine et engagement halal de nos produits"
    >
      <OriginBadges />
    </section>
  );
}

export function CustomerHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="customer-header brand-header sticky top-0 z-40 border-b-2 border-primary">
      {children}
      <OriginPromiseBar />
    </div>
  );
}
