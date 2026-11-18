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
          <span className="mt-1 text-[10px] sm:text-[11px] text-sidebar-foreground/65">Notre origine, notre fierté</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 40" role="img" aria-label="Croissant et étoile" className="h-6 w-5 shrink-0 sm:h-7 sm:w-6">
          <defs>
            <mask id={crescentId}>
              <rect width="32" height="40" fill="black" />
              <circle cx="15.5" cy="17" r="8.5" fill="white" />
              <circle cx="20.5" cy="17" r="8.5" fill="black" />
            </mask>
          </defs>
          <path d="M2 1 H30 V30 L16 39 L2 30 Z" className="fill-morocco-green" />
          <rect width="32" height="40" className="fill-trust" mask={`url(#${crescentId})`} />
          <path d="M23 14.4 L22.42 16.2 L20.53 16.2 L22.06 17.31 L21.47 19.1 L23 17.99 L24.53 19.1 L23.94 17.31 L25.47 16.2 L23.58 16.2 Z" className="fill-trust" />
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
