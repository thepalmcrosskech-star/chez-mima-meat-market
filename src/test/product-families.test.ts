import { describe, expect, it } from "vitest";
import { groupByFamily } from "@/lib/product-families";
import type { Product } from "@/types/product";

const p = (id: string, family: string | null, is_active = true): Product => ({
  id, name: id, description: null, price: 25, unit_type: "piece", image_url: null, category_id: "c", is_active, family,
});

describe("groupByFamily", () => {
  it("shows flavours of the same family as one catalogue card", () => {
    const entries = groupByFamily([p("fraise", "Freez"), p("coca", null), p("citron", "Freez")]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: "family", family: "Freez" });
    if (entries[0].kind === "family") expect(entries[0].products.map((x) => x.id)).toEqual(["fraise", "citron"]);
  });

  it("uses an available flavour as the card photo when the first one is unavailable", () => {
    const [entry] = groupByFamily([p("fraise", "Freez", false), p("citron", "Freez")]);
    expect(entry.kind === "family" && entry.lead.id).toBe("citron");
  });
});
