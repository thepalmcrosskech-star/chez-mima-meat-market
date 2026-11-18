import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { OriginBadges } from "@/components/OriginPromise";

const mark = (container: HTMLElement, label: string) =>
  container.querySelector(`svg[aria-label="${label}"]`);

const rings = (svg: Element) => Array.from(svg.querySelectorAll("circle"));

describe("customer origin banner", () => {
  it("draws both marks as matching round seals", () => {
    const { container } = render(<OriginBadges />);
    const morocco = mark(container, "Drapeau du Maroc");
    const halal = mark(container, "Halal");
    expect(morocco).not.toBeNull();
    expect(halal).not.toBeNull();

    for (const svg of [morocco, halal]) {
      const circles = rings(svg!);
      expect(circles.length).toBe(2);
      // Solid disc + thin inner ring, flat with no gradient.
      expect(circles[0].getAttribute("class")).toContain("fill-");
      expect(circles[1].getAttribute("fill")).toBe("none");
      expect(circles[1].getAttribute("class")).toContain("stroke-trust");
      expect(svg!.querySelector("linearGradient")).toBeNull();
    }
  });

  it("keeps the moroccan seal red with the green star", () => {
    const { container } = render(<OriginBadges />);
    const morocco = mark(container, "Drapeau du Maroc");
    if (!morocco) throw new Error("Moroccan seal missing");
    expect(rings(morocco)[0].getAttribute("class")).toContain("fill-morocco-red");
    const star = morocco.querySelector("path");
    expect(star).not.toBeNull();
    if (!star) throw new Error("Moroccan star missing");
    expect(star.getAttribute("class")).toContain("stroke-morocco-green");
    expect(star.getAttribute("d")).toContain("Z");
  });

  it("writes the halal word in arabic inside the seal", () => {
    const { container } = render(<OriginBadges />);
    const halal = mark(container, "Halal")!;
    expect(rings(halal)[0].getAttribute("class")).toContain("fill-morocco-green");

    const word = halal.querySelector('text[lang="ar"]');
    expect(word).not.toBeNull();
    expect(word!.textContent).toBe("حلال");
    expect(word!.getAttribute("text-anchor")).toBe("middle");
    expect((word as SVGTextElement).style.fontFamily).toContain("Amiri");

    const latin = halal.querySelector('text[lang="ar"] ~ text');
    expect(latin!.textContent).toBe("HALAL");
  });

  it("drops the crescent, the star cut-out and the check mark", () => {
    const { container } = render(<OriginBadges />);
    const halal = mark(container, "Halal")!;
    expect(halal.querySelector("mask")).toBeNull();
    expect(halal.querySelectorAll("path").length).toBe(0);
  });

  it("gives both seals the same size so they look like a pair", () => {
    const { container } = render(<OriginBadges />);
    const sizes = Array.from(container.querySelectorAll("svg")).map((svg) =>
      (svg.getAttribute("class") || "").replace(/shrink-0/g, "").trim(),
    );
    expect(sizes.length).toBe(2);
    expect(sizes[0]).toBe(sizes[1]);
  });

  it("keeps both seals smaller than the brand logo", () => {
    const { container } = render(<OriginBadges />);
    const logoSource = readFileSync("src/components/BrandHeader.tsx", "utf8");
    const logoHeight = Number(logoSource.match(/h-(\d+)/)?.[1]);
    expect(logoHeight).toBeGreaterThan(0);

    for (const svg of container.querySelectorAll("svg")) {
      const cls = svg.getAttribute("class") || "";
      const markHeight = Number(cls.match(/(?:^|\s)h-(\d+)/)?.[1]);
      expect(markHeight).toBeGreaterThan(0);
      expect(markHeight).toBeLessThan(logoHeight);
    }
  });
});
