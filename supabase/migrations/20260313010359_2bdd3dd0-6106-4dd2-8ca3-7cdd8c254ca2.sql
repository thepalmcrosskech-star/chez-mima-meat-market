
DROP POLICY "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO public
WITH CHECK ((auth.uid() = id) AND (role = 'user'));
