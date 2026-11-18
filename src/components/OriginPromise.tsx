import { useId } from "react";

export function OriginBadges({ className = "" }: { className?: string }) {
  const crescentId = `halal-crescent-${useId().replace(/:/g, "")}`;

  return (
    <div className={`flex items-center justify-center gap-x-3 sm:gap-x-6 ${className}`}>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 40" role="img" aria-label="Drapeau du Maroc" className="h-6 w-5 shrink-0 sm:h-7 sm:w-6">
          <path d="M2 1 H30 V30 L16 39 L2 30 Z" className="fill-morocco-red" />
          <path d="M16 7 L21.29 23.28 L7.44 13.22 L24.56 13.22 L10.71 23.28 Z" fill="none" className="stroke-morocco-green" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-xs sm:text-sm font-semibold text-sidebar-foreground/95">100% fait au Maroc</span>
          <span className="mt-1 text-[10px] sm:text-[11px] text-sidebar-foreground/65">Savoir-faire local</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 40" role="img" aria-label="Croissant et étoile" className="h-6 w-5 shrink-0 sm:h-7 sm:w-6">
          <defs>
            <mask id={crescentId}>
              <rect width="32" height="40" fill="black" />
              <circle cx="14" cy="17" r="8" fill="white" />
              <circle cx="17.2" cy="15.6" r="6.6" fill="black" />
            </mask>
          </defs>
          <path d="M2 1 H30 V30 L16 39 L2 30 Z" className="fill-morocco-green" />
          <path d="M2 1 H30" className="stroke-trust" strokeWidth="1.2" opacity="0.6" />
          <rect width="32" height="40" className="fill-trust" mask={`url(#${crescentId})`} />
          <path d="M21 12 L22.18 15.38 L25.76 15.45 L22.9 17.62 L23.94 21.05 L21 19 L18.06 21.05 L19.1 17.62 L16.24 15.45 L19.82 15.38 Z" className="fill-trust" />
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
