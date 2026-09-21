
-- Allow authenticated users to INSERT into empresa_config during onboarding
-- (only if no config exists yet for the system)
CREATE POLICY "Authenticated users can insert empresa_config"
ON public.empresa_config
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.empresa_config)
);

-- Also allow authenticated users to UPDATE empresa_config 
-- (needed for logo upload, theme changes etc.)
CREATE POLICY "Authenticated users can update empresa_config"
ON public.empresa_config
FOR UPDATE
TO authenticated
USING (true);
