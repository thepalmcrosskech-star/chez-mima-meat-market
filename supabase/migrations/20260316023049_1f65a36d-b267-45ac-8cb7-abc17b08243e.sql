
-- Track user IPs
CREATE TABLE public.user_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  ip_address text NOT NULL,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, ip_address)
);

ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_ips"
  ON public.user_ips FOR ALL
  TO authenticated
  USING (public.has_admin_role(auth.uid()));

-- Banned IPs
CREATE TABLE public.banned_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  reason text DEFAULT 'Fausse commande',
  banned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage banned_ips"
  ON public.banned_ips FOR ALL
  TO authenticated
  USING (public.has_admin_role(auth.uid()));

-- Allow edge functions (service role) to read banned_ips for checking
CREATE POLICY "Anyone can check banned IPs"
  ON public.banned_ips FOR SELECT
  TO anon, authenticated
  USING (true);
