import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Explicit signed-in fixtures only; tokens never belong in the repository.
const url = process.env.ACCESS_TEST_URL;
const key = process.env.ACCESS_TEST_KEY;
const token = process.env.ACCESS_TEST_TOKEN;
const userId = process.env.ACCESS_TEST_USER_ID;
const enabled = Boolean(url && key && token && userId);

describe.skipIf(!enabled)("live administrator protection", () => {
  const client = () => {
    if (!url || !key || !token) throw new Error("Missing test session");
    return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  };
  it("rejects first-admin activation with an unreserved email", async () => {
    const { error } = await client().rpc("claim_first_admin");
    expect(error).not.toBeNull();
  });
  it("prevents removing the last administrator", async () => {
    const { error } = await client().rpc("set_profile_role_as_admin", { _target_user_id: userId, _new_role: "user" });
    expect(error?.message).toContain("dernier administrateur");
  });
  it("rejects role changes through the profile table", async () => {
    const { error } = await client().from("profiles").update({ role: "driver" }).eq("id", userId);
    expect(error).not.toBeNull();
  });
});