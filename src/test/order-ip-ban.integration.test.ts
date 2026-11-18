import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.IP_TEST_URL;
const key = process.env.IP_TEST_KEY;
const customerToken = process.env.IP_TEST_CUSTOMER_TOKEN;
const adminToken = process.env.IP_TEST_ADMIN_TOKEN;
const userId = process.env.IP_TEST_USER_ID;
const enabled = Boolean(url && key && customerToken && adminToken && userId);

describe.skipIf(!enabled)("server order IP ban", () => {
  it("rejects direct pickup and delivery calls from a banned IP and permits validation after admin unban", async () => {
    if (!url || !key || !customerToken || !adminToken || !userId) throw new Error("Missing test sessions");
    const client = (token: string) => createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const customer = client(customerToken);
    const admin = client(adminToken);
    const { data: tracked, error: trackingError } = await customer.functions.invoke("ip-manager", { body: { action: "track", user_id: userId } });
    expect(trackingError).toBeNull();
    expect(tracked?.banned).toBe(false);
    // This test only submits empty items: no order can ever be created.
    const order = (mode: string, caller = customer) => caller.rpc("create_customer_order", { _items: [], _delivery_mode: mode });
    const before = await order("pickup");
    expect(before.error?.message).toBe("Invalid order items");
    const { data: ban, error: banError } = await admin.functions.invoke("ip-manager", { body: { action: "ban", user_id: userId, reason: "Temporary order IP security test" } });
    expect(banError).toBeNull();
    expect(ban?.banned).toBeGreaterThan(0);
    try {
      for (const mode of ["pickup", "delivery"]) {
        const result = await order(mode);
        expect(result.error?.code).toBe("42501");
        expect(result.error?.message).toContain("adresse IP est bannie");
      }
      const forged = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${customerToken}`, "x-forwarded-for": "192.0.2.45", "x-real-ip": "192.0.2.46" } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      expect((await order("pickup", forged)).error?.code).toBe("42501");
      const { data: ids, error: readError } = await admin.from("banned_ips").select("id").eq("ip_address", tracked.ip);
      expect(readError).toBeNull();
      expect(ids).toHaveLength(1);
      const banId = ids?.[0]?.id;
      if (!banId) throw new Error("Missing temporary ban");
      await customer.from("banned_ips").delete().eq("id", banId);
      expect((await order("pickup")).error?.code).toBe("42501");
      // Same operation as the administrator's Débannir button.
      const { error: unbanError } = await admin.from("banned_ips").delete().eq("id", banId);
      expect(unbanError).toBeNull();
      expect((await order("pickup")).error?.message).toBe("Invalid order items");
      const { data: remaining } = await admin.from("banned_ips").select("id").eq("id", banId);
      expect(remaining).toEqual([]);
    } finally {
      const { error } = await admin.functions.invoke("ip-manager", { body: { action: "unban", user_id: userId } });
      expect(error).toBeNull();
    }
  }, 60000);
});