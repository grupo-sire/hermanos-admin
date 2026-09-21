
-- Add config field for whether clients can choose the professional
ALTER TABLE public.empresa_config 
ADD COLUMN IF NOT EXISTS permitir_escolha_profissional boolean DEFAULT true;
