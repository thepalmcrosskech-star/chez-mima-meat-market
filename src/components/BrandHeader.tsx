import { brandLogo } from "@/lib/brand";

export default function BrandHeader() {
  return (
    <header className="brand-header border-b-4 border-primary px-5 py-4">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <img src={brandLogo} alt="Chez Mima" className="h-14 w-20 object-contain" />
        <div>
          <p className="font-display text-3xl leading-none">Chez Mima</p>
          <p className="mt-1 text-sm text-sidebar-foreground/80">Boucherie · Marrakech</p>
        </div>
      </div>
    </header>
  );
}