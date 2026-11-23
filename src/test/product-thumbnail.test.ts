import { describe, it, expect } from "vitest";
import { productThumbnail } from "@/lib/productThumbnail";
import thumbnails from "@/data/product-thumbnails.json";

describe("productThumbnail", () => {
  it("uses the lighter copy for a known catalogue photo", () => {
    const [original, thumb] = Object.entries(thumbnails as Record<string, string>)[0];
    expect(productThumbnail(original)).toBe(thumb);
  });
  it("keeps the original photo when no lighter copy exists", () => {
    expect(productThumbnail("/__l5e/assets-v1/x/new.webp")).toBe("/__l5e/assets-v1/x/new.webp");
  });
});
