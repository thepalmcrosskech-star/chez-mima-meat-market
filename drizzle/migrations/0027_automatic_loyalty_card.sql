CREATE OR REPLACE FUNCTION public.create_profile_loyalty_card() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 INSERT INTO public.loyalty_cards(user_id) VALUES(NEW.id) ON CONFLICT(user_id) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_profile_loyalty_card() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profile_auto_loyalty_card AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_profile_loyalty_card();
INSERT INTO public.loyalty_cards(user_id) SELECT id FROM public.profiles ON CONFLICT(user_id) DO NOTHING;