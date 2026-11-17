import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { destinationForRoles } from "@/lib/account-access";
describe("account separation", () => {
  it("sends administrators to the back office", () => expect(destinationForRoles(["admin"])).toBe("/admin"));
  it("keeps clients out of the back office", () => expect(destinationForRoles(["user"])).toBe("/"));
  it("sends drivers to their separate app", () => expect(destinationForRoles(["driver"])).toBe("/driver"));
});