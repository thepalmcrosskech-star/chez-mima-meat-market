import { supabase } from "@/integrations/supabase/client";

export type AccountRole = "admin" | "employee" | "driver" | "user";

export function destinationForRoles(roles: string[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("employee")) return "/staff";
  if (roles.includes("driver")) return "/driver";
  return "/";
}

export async function getAccountAccess() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError) throw roleError;
  return { user, roles: (data ?? []).map(row => row.role) };
}