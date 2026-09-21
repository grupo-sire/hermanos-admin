-- Migration: Create public.candidatos_barbeiros table for recruitment & talent pool
CREATE TABLE IF NOT EXISTS public.candidatos_barbeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  whatsapp_phone TEXT NOT NULL,
  nome TEXT NOT NULL,
  unidades_interesse TEXT[] DEFAULT '{}',
  tempo_experiencia TEXT,
  instagram_portfolio TEXT,
  disponibilidade_inicio TEXT,
  status TEXT DEFAULT 'novo',
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_candidatos_empresa ON public.candidatos_barbeiros(empresa_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_phone ON public.candidatos_barbeiros(whatsapp_phone);

-- RLS policies
ALTER TABLE public.candidatos_barbeiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para autenticados" ON public.candidatos_barbeiros;
CREATE POLICY "Permitir leitura para autenticados" ON public.candidatos_barbeiros FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir operacoes para autenticados" ON public.candidatos_barbeiros;
CREATE POLICY "Permitir operacoes para autenticados" ON public.candidatos_barbeiros FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir operacoes para anon" ON public.candidatos_barbeiros;
CREATE POLICY "Permitir operacoes para anon" ON public.candidatos_barbeiros FOR ALL TO anon USING (true);
