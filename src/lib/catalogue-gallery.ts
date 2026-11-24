import herbes from "@/assets/catalogue/brochettes-fines-herbes.webp.asset.json";
import arizona from "@/assets/catalogue/brochettes-arizona.webp.asset.json";
import poivres from "@/assets/catalogue/brochettes-trois-poivres.webp.asset.json";
import ail from "@/assets/catalogue/brochettes-ail-ours.webp.asset.json";
import provencal from "@/assets/catalogue/brochettes-provencal-light.webp.asset.json";
import poivrons from "@/assets/catalogue/brochettes-trois-poivrons-light.webp.asset.json";
import maitre from "@/assets/catalogue/brochettes-maitre-hotel-light.webp.asset.json";
import thym from "@/assets/catalogue/brochettes-thym-citron-light.webp.asset.json";
import texmex from "@/assets/catalogue/brochettes-tex-mex-light.webp.asset.json";

// Additional views of the existing product, not separate purchasable variants.
export function catalogueGallery(productId: string, primaryUrl: string | null) {
  if (productId === "20450307-1fcb-41ef-ab9d-968f726b16a8") {
    return [
      { url: herbes.url, label: "Cubes de poulet marinés – fines herbes" },
      { url: arizona.url, label: "Cubes de poulet marinés – Arizona" },
      { url: poivres.url, label: "Cubes de poulet marinés – trois poivres" },
      { url: ail.url, label: "Cubes de poulet marinés – ail des ours" },
      { url: provencal.url, label: "Cubes de poulet marinés – provençal" },
      { url: poivrons.url, label: "Cubes de poulet marinés – trois poivrons" },
      { url: maitre.url, label: "Cubes de poulet marinés – maître d’hôtel" },
      { url: thym.url, label: "Cubes de poulet marinés – thym citron" },
      { url: texmex.url, label: "Cubes de poulet marinés – Tex-Mex" },
    ];
  }
  return primaryUrl ? [{ url: primaryUrl, label: "Photo du produit" }] : [];
}