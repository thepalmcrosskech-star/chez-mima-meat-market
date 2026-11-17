import fraise from "@/assets/catalogue/freez-fraise.jpg.asset.json";
import citron from "@/assets/catalogue/freez-citron-menthe.jpg.asset.json";
import lemonade from "@/assets/catalogue/freez-lemonade-mix.jpg.asset.json";
import berry from "@/assets/catalogue/freez-berry-mix.jpg.asset.json";
import ananas from "@/assets/catalogue/freez-ananas-coco.jpg.asset.json";

// Additional views of the existing product, not separate purchasable variants.
export function catalogueGallery(productId: string, primaryUrl: string | null) {
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