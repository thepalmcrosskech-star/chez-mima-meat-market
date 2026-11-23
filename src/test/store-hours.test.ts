import { describe, it, expect } from "vitest";
import { defaultWeeklyHours, isOpenAt, nextOpening } from "@/lib/store-hours";

// 2026-11-27 est un vendredi ; Maroc = UTC+1
const at = (iso: string) => new Date(iso);

describe("horaires par jour", () => {
  const w = defaultWeeklyHours("10:00", "20:30");
  it("ouvert un lundi à 12 h", () => expect(isOpenAt(w, at("2026-11-23T11:00:00Z"))).toBe(true));
  it("fermé après 20 h 30", () => expect(isOpenAt(w, at("2026-11-23T19:45:00Z"))).toBe(false));
  it("pause du vendredi 13 h–14 h 30", () => {
    expect(isOpenAt(w, at("2026-11-27T12:30:00Z"))).toBe(false);
    expect(nextOpening(w, at("2026-11-27T12:30:00Z"))?.toISOString()).toBe("2026-11-27T13:30:00.000Z");
  });
  it("jour fermé : reprise le jour ouvert suivant", () => {
    const c = defaultWeeklyHours(); c[1].closed = true; // mardi fermé
    expect(isOpenAt(c, at("2026-11-24T11:00:00Z"))).toBe(false);
    expect(nextOpening(c, at("2026-11-23T20:00:00Z"))?.toISOString()).toBe("2026-11-25T09:00:00.000Z");
  });
});
