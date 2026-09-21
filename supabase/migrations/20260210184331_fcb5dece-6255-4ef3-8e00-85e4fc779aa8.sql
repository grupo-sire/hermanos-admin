-- Add commission fields to barbeiros table
ALTER TABLE public.barbeiros
ADD COLUMN comissao_percentual NUMERIC DEFAULT 0,
ADD COLUMN comissao_servico BOOLEAN DEFAULT true,
ADD COLUMN comissao_produto BOOLEAN DEFAULT true;