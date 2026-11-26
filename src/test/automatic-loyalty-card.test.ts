import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("automatic account loyalty card", () => {
  const sql = readFileSync("drizzle/migrations/0027_automatic_loyalty_card.sql", "utf8");
  it("issues one card when the account profile is created", () => {
    expect(sql).toMatch(/AFTER INSERT ON public\.profiles FOR EACH ROW EXECUTE FUNCTION public\.create_profile_loyalty_card\(\)/);
    expect(sql).toMatch(/VALUES\(NEW\.id\) ON CONFLICT\(user_id\) DO NOTHING/);
  });
  it("includes existing accounts without replacing their card", () => {
    expect(sql).toContain("SELECT id FROM public.profiles ON CONFLICT(user_id) DO NOTHING");
  });
});