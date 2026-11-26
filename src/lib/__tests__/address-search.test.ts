import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchAddress, resetAddressSearch, MAX_SEARCHES_PER_SESSION } from "../address-search";

const ok = () => vi.fn(async () => new Response(JSON.stringify([{ display_name: "Guéliz", lat: "31.63", lon: "-8.01" }])));
beforeEach(() => resetAddressSearch());

describe("searchAddress", () => {
  it("refuses queries shorter than 3 characters without calling the service", async () => {
    const f = ok();
    await expect(searchAddress("ab", undefined, () => 0, f)).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it("allows at most one request per second", async () => {
    const f = ok();
    await searchAddress("gueliz", undefined, () => 10_000, f);
    await expect(searchAddress("hivernage", undefined, () => 10_500, f)).rejects.toThrow(/Patientez/);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("serves a repeated search from cache", async () => {
    const f = ok();
    await searchAddress("Gueliz", undefined, () => 10_000, f);
    const r = await searchAddress(" gueliz ", undefined, () => 10_100, f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r[0].latitude).toBe(31.63);
  });
  it("stops after the per-session cap", async () => {
    const f = ok();
    for (let i = 0; i < MAX_SEARCHES_PER_SESSION; i++) await searchAddress(`rue ${i}`, undefined, () => 10_000 + i * 2000, f);
    await expect(searchAddress("encore", undefined, () => 999_999, f)).rejects.toThrow(/Trop/);
  });
});
