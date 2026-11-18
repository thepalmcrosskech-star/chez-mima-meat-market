import { ShieldCheck } from "lucide-react";

export function OriginBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-x-3 sm:gap-x-5 ${className}`}>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 40 40" role="img" aria-label="Drapeau du Maroc" className="h-9 w-9 shrink-0 rounded-full ring-1 ring-sidebar-foreground/20">
          <circle cx="20" cy="20" r="20" className="fill-morocco-red" />
          <path d="M20 9 L26.47 28.9 L9.54 16.6 L30.46 16.6 L13.53 28.9 Z" fill="none" className="stroke-morocco-green" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-xs sm:text-sm font-semibold">100% fait au Maroc</span>
          <span className="mt-0.5 text-[11px] opacity-65">Notre origine, notre fierté</span>
        </span>
      </div>
      <span className="h-7 w-px bg-current opacity-15" aria-hidden="true" />
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 shrink-0 opacity-75" strokeWidth={1.5} aria-hidden="true" />
        <span className="flex flex-col text-left leading-tight">
          <span className="text-xs sm:text-sm font-semibold">100% Halal</span>
          <span className="mt-0.5 text-[11px] opacity-65">Tous nos produits</span>
        </span>
      </div>
    </div>
  );
}

export function OriginPromiseBar({ className = "" }: { className?: string }) {
  return (
    <section
      className={`brand-header flex h-16 items-center justify-center border-b border-sidebar-foreground/10 px-3 ${className}`}
      aria-label="Origine et engagement halal de nos produits"
    >
      <OriginBadges />
    </section>
  );
}

export function CustomerHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="customer-header sticky top-0 z-40">
      {children}
      <OriginPromiseBar />
    </div>
  );
}
