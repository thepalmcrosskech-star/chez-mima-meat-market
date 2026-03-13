
-- Attach handle_new_user trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Attach enforce_user_role_on_insert trigger to profiles
CREATE OR REPLACE TRIGGER enforce_user_role_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_on_insert();
