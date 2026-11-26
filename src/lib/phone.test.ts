import { describe, it, expect } from "vitest";
import { normalizeMoroccanPhone } from "./phone";
describe("normalizeMoroccanPhone", () => {
  it("accepte 06 / 07 / +212", () => {
    expect(normalizeMoroccanPhone("06 12 34 56 78")).toBe("+212612345678");
    expect(normalizeMoroccanPhone("+212707462630")).toBe("+212707462630");
    expect(normalizeMoroccanPhone("00212 7 07 46 26 30")).toBe("+212707462630");
  });
  it("refuse un numéro incomplet", () => {
    expect(normalizeMoroccanPhone("0612")).toBeNull();
    expect(normalizeMoroccanPhone("")).toBeNull();
  });
});
