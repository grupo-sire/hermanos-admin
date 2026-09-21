
-- Tabela para armazenar métricas de anúncios (Meta, Google, Instagram)
CREATE TABLE public.ads_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plataforma text NOT NULL, -- 'meta', 'google', 'instagram'
  conta_id text, -- ID da conta de anúncios
  conta_nome text, -- Nome da conta
  campanha_id_externo text, -- ID da campanha na plataforma
  campanha_nome text, -- Nome da campanha na plataforma
  data_referencia date NOT NULL, -- Data da métrica
  impressoes integer DEFAULT 0,
  cliques integer DEFAULT 0,
  alcance integer DEFAULT 0,
  conversoes integer DEFAULT 0,
  gasto numeric(10,2) DEFAULT 0,
  cpc numeric(10,4) DEFAULT 0, -- Custo por clique
  cpm numeric(10,4) DEFAULT 0, -- Custo por mil impressões
  ctr numeric(6,4) DEFAULT 0, -- Click-through rate
  roas numeric(10,4) DEFAULT 0, -- Return on ad spend
  receita numeric(10,2) DEFAULT 0,
  dados_extras jsonb DEFAULT '{}'::jsonb, -- Dados adicionais flexíveis
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para consultas comuns
CREATE INDEX idx_ads_metrics_plataforma ON public.ads_metrics (plataforma);
CREATE INDEX idx_ads_metrics_data ON public.ads_metrics (data_referencia DESC);
CREATE INDEX idx_ads_metrics_plataforma_data ON public.ads_metrics (plataforma, data_referencia DESC);

-- Unique constraint para evitar duplicatas de métricas do mesmo dia/campanha
CREATE UNIQUE INDEX idx_ads_metrics_unique ON public.ads_metrics (plataforma, campanha_id_externo, data_referencia)
  WHERE campanha_id_externo IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ads_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer autenticado pode ler, admin/manager podem gerenciar
CREATE POLICY "ads_metrics_select" ON public.ads_metrics
  FOR SELECT USING (true);

CREATE POLICY "ads_metrics_insert" ON public.ads_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ads_metrics_update" ON public.ads_metrics
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "ads_metrics_delete" ON public.ads_metrics
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_ads_metrics_updated_at
  BEFORE UPDATE ON public.ads_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
