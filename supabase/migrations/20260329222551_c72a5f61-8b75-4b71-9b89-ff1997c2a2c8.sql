-- Remove overly permissive public SELECT policy on banned_ips
DROP POLICY IF EXISTS "Anyone can check banned IPs" ON public.banned_ips;

-- Add admin-only SELECT policy (admin ALL policy already covers this, but explicit is safer)
CREATE POLICY "Only admins can read banned IPs"
ON public.banned_ips
FOR SELECT
TO authenticated
USING (has_admin_role(auth.uid()));