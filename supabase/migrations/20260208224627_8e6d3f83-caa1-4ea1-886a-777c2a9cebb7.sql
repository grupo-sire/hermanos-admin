
-- Add unidade_id to user_roles to associate non-admin users with a specific unit
ALTER TABLE public.user_roles
ADD COLUMN unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_user_roles_unidade_id ON public.user_roles(unidade_id);
