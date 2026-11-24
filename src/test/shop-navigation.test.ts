import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shopNavigationPath } from "@/lib/shop-navigation";

describe("shop navigation remains within Android app", () => {
  it.each([
    "/search?cat=volaille#products",
    "https://boucheriechezmima.com/search?cat=volaille#products",
    "https://www.boucheriechezmima.com/search?cat=volaille#products",
    "https://chez-mima-meat-market.lovable.app/search?cat=volaille#products",
    "https://chezmima.lovable.app/search?cat=volaille#products",
  ])("keeps %s in the current shop", (url) => {
    expect(shopNavigationPath(url, "https://boucheriechezmima.com")).toBe("/search?cat=volaille#products");
  });

  it("keeps preview links on their preview origin", () => {
    expect(shopNavigationPath("https://boucheriechezmima.com/cart", "http://localhost:8080")).toBe("/cart");
  });

  it.each(["https://wa.me/212707462630", "https://www.google.com/maps/dir/", "tel:+212707462630", "https://boucheriechezmima.com.example.org/cart"])("does not treat external destination %s as a shop page", (url) => {
    expect(shopNavigationPath(url, "https://boucheriechezmima.com")).toBeNull();
  });

  it("addresses future driver emails to the verified primary domain", () => {
    const source = readFileSync("supabase/functions/assign-driver/index.ts", "utf8");
    const destination = source.match(/<a href="([^"]+)"/);
    expect(destination?.[1]).toBe("https://boucheriechezmima.com/driver");
  });
});