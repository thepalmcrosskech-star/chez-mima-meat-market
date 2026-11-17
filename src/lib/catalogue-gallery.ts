import fraise from "@/assets/catalogue/freez-fraise.jpg.asset.json";
import citron from "@/assets/catalogue/freez-citron-menthe.jpg.asset.json";
import lemonade from "@/assets/catalogue/freez-lemonade-mix.jpg.asset.json";
import berry from "@/assets/catalogue/freez-berry-mix.jpg.asset.json";
import ananas from "@/assets/catalogue/freez-ananas-coco.jpg.asset.json";
import herbes from "@/assets/catalogue/brochettes-fines-herbes.webp.asset.json";
import arizona from "@/assets/catalogue/brochettes-arizona.webp.asset.json";
import poivres from "@/assets/catalogue/brochettes-trois-poivres.webp.asset.json";
import ail from "@/assets/catalogue/brochettes-ail-ours.webp.asset.json";
import provencal from "@/assets/catalogue/brochettes-provencal.png.asset.json";
import poivrons from "@/assets/catalogue/brochettes-trois-poivrons.png.asset.json";
import maitre from "@/assets/catalogue/brochettes-maitre-hotel.png.asset.json";
import thym from "@/assets/catalogue/brochettes-thym-citron.png.asset.json";
import texmex from "@/assets/catalogue/brochettes-tex-mex.png.asset.json";

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
  if (productId === "a2e3dacd-90a8-4f8d-b283-ffeaa57d83e6") {
    return [
      { url: fraise.url, label: "Freez fraise" },
      { url: citron.url, label: "Freez citron menthe" },
      { url: lemonade.url, label: "Freez lemonade mix" },
      { url: berry.url, label: "Freez fruits rouges" },
      { url: ananas.url, label: "Freez ananas coco" },
    ];
  }
  return primaryUrl ? [{ url: primaryUrl, label: "Photo du produit" }] : [];
}