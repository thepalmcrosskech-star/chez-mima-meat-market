import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";

it("offers delivery from 500 MAD in every active delivery zone without changing paid Glovo rates", async () => {
  const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: zones, error } = await client.from("delivery_zones")
    .select("min_radius_km, radius_km, delivery_fee, free_delivery_threshold")
    .eq("is_active", true).order("radius_km");
  expect(error).toBeNull();
  expect(zones).toEqual([
    { min_radius_km: 0, radius_km: 4, delivery_fee: 21.6, free_delivery_threshold: 500 },
    { min_radius_km: 4, radius_km: 6, delivery_fee: 23.4, free_delivery_threshold: 500 },
    { min_radius_km: 6, radius_km: 8, delivery_fee: 26.4, free_delivery_threshold: 500 },
    { min_radius_km: 8, radius_km: 10, delivery_fee: 30, free_delivery_threshold: 500 },
  ]);
});