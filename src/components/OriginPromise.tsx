export function OriginBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-x-3 sm:gap-x-6 ${className}`}>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 100 100" role="img" aria-label="Drapeau du Maroc" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">
          <circle cx="50" cy="50" r="49" className="fill-morocco-red" />
          <circle cx="50" cy="50" r="42" fill="none" className="stroke-trust" strokeWidth="1.6" opacity="0.5" />
          <path
            d="M50 22 L66.46 72.65 L23.37 41.35 L76.63 41.35 L33.54 72.65 Z"
            fill="none"
            className="stroke-morocco-green"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <span className="flex flex-col text-left leading-tight">
          <span className="text-xs sm:text-sm font-semibold text-sidebar-foreground/95">100% fait au Maroc</span>
          <span className="mt-1 text-[10px] sm:text-[11px] text-sidebar-foreground/65">Savoir-faire local</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 100 100" role="img" aria-label="Halal" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">
          <circle cx="50" cy="50" r="49" className="fill-morocco-green" />
          <circle cx="50" cy="50" r="42" fill="none" className="stroke-trust" strokeWidth="1.6" opacity="0.5" />
          <text
            x="50"
            y="55"
            lang="ar"
            textAnchor="middle"
            className="fill-trust"
            style={{ fontFamily: "'Amiri', 'Geeza Pro', 'Noto Naskh Arabic', serif", fontSize: 36, fontWeight: 700 }}
          >
            حلال
          </text>
          <text
            x="50"
            y="78"
            textAnchor="middle"
            className="fill-trust"
            opacity="0.8"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 13, letterSpacing: 2, fontWeight: 700 }}
          >
            HALAL
          </text>
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
