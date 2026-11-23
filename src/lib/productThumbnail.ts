import thumbnails from "@/data/product-thumbnails.json";

const map = thumbnails as Record<string, string>;

/** Lighter copy of a catalogue photo for cards and lists; same framing, falls back to the original. */
export function productThumbnail(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return map[url] ?? url;
}
