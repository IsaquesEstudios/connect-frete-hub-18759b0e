DROP POLICY IF EXISTS profiles_select_access ON public.profiles;
CREATE POLICY profiles_select_access ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR private.is_staff(auth.uid())
  OR type IN ('admin','colaborador')
);