import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { OriginBadges } from "@/components/OriginPromise";

const halalPennant = (container: HTMLElement) =>
  container.querySelector('svg[aria-label="Croissant et étoile"]');

describe("customer origin banner", () => {
  it("keeps the moroccan pennant and gives the halal pennant a crescent plus a star", () => {
    const { container } = render(<OriginBadges />);
    expect(container.querySelector('svg[aria-label="Drapeau du Maroc"]')).not.toBeNull();

    const halal = halalPennant(container);
    expect(halal).not.toBeNull();

    // The crescent is a light disc with a disc cut out of it, so it can never
    // degrade into a check mark or a full moon.
    const mask = halal!.querySelector("mask");
    expect(mask).not.toBeNull();
    const circles = mask!.querySelectorAll("circle");
    expect(circles.length).toBe(2);
    expect(circles[0].getAttribute("fill")).toBe("white");
    expect(circles[1].getAttribute("fill")).toBe("black");

    const crescent = halal!.querySelector("rect[mask]");
    expect(crescent).not.toBeNull();
    expect(crescent!.getAttribute("mask")).toBe(
      `url(#${mask!.getAttribute("id")})`,
    );

    // Five-pointed star sitting in the crescent's opening.
    const star = halal!.querySelector('path[class*="fill-trust"]');
    expect(star).not.toBeNull();
    expect(star!.getAttribute("d")).toMatch(/^M21.6 10.2 /);
    expect(star!.getAttribute("d").split(" L").length).toBe(10);
  });

  it("never falls back to a check mark on the halal pennant", () => {
    const { container } = render(<OriginBadges />);
    const paths = Array.from(halalPennant(container)!.querySelectorAll("path"));
    expect(paths.some((p) => /L14 22 L23 12/.test(p.getAttribute("d") || ""))).toBe(false);
  });

  it("renders a distinct mask id for every pennant on the page", () => {
    const a = render(<OriginBadges />);
    const b = render(<OriginBadges />);
    const idA = a.container.querySelector("mask")!.getAttribute("id");
    const idB = b.container.querySelector("mask")!.getAttribute("id");
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
  });

  it("keeps both pennants smaller than the brand logo", () => {
    const { container } = render(<OriginBadges />);
    const logoSource = readFileSync("src/components/BrandHeader.tsx", "utf8");
    const logoHeight = Number(logoSource.match(/h-(\d+)/)?.[1]);
    expect(logoHeight).toBeGreaterThan(0);

    for (const svg of container.querySelectorAll("svg")) {
      const cls = svg.getAttribute("class") || "";
      const pennantHeight = Number(cls.match(/(?:^|\s)h-(\d+)/)?.[1]);
      expect(pennantHeight).toBeGreaterThan(0);
      expect(pennantHeight).toBeLessThan(logoHeight);
    }
  });
});
