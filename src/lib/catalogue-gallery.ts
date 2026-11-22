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
      { url: herbes.url, label: "Brochettes fines herbes" },
      { url: arizona.url, label: "Brochettes poulet Arizona" },
      { url: poivres.url, label: "Brochettes trois poivres" },
      { url: ail.url, label: "Brochettes ail des ours" },
      { url: provencal.url, label: "Brochettes provençal" },
      { url: poivrons.url, label: "Brochettes trois poivrons" },
      { url: maitre.url, label: "Brochettes maître d’hôtel" },
      { url: thym.url, label: "Brochettes thym citron" },
      { url: texmex.url, label: "Brochettes poulet Tex-Mex" },
    ];
  }
  return primaryUrl ? [{ url: primaryUrl, label: "Photo du produit" }] : [];
}