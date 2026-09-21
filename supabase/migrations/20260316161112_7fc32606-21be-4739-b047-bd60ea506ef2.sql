-- Allow anonymous users to read basic empresa info by slug (for branded login pages)
CREATE POLICY "empresas_select_public_by_slug"
ON public.empresas
FOR SELECT
TO anon
USING (status = 'active' AND slug IS NOT NULL);
