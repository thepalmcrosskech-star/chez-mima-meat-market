import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";

it("uses +212707462630 for both shop calls and WhatsApp", async () => {
  const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("app_settings").select("key,value").in("key", ["store_phone", "whatsapp_number"]).order("key");
  expect(error).toBeNull();
  expect(data).toEqual([
    { key: "store_phone", value: "+212707462630" },
    { key: "whatsapp_number", value: "+212707462630" },
  ]);
});