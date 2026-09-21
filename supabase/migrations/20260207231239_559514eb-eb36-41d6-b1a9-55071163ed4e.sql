-- Add onboarding and theme columns to empresa_config
ALTER TABLE public.empresa_config 
  ADD COLUMN IF NOT EXISTS tipo_estabelecimento text DEFAULT 'barbearia',
  ADD COLUMN IF NOT EXISTS cor_primaria text DEFAULT '350 65% 33%',
  ADD COLUMN IF NOT EXISTS cor_nome text DEFAULT 'Vinho',
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean DEFAULT false;

-- Mark existing configs as onboarding complete (existing users already set up)
UPDATE public.empresa_config SET onboarding_completo = true WHERE onboarding_completo = false;