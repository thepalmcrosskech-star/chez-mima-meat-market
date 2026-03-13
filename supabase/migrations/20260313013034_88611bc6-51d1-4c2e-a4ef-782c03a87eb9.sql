CREATE TRIGGER enforce_user_role_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_role_on_insert();