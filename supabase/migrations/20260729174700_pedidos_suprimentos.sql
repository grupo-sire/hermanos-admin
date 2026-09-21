-- Migration Atualizada: Estoque Central, Transferência em Trânsito e Auditoria de Divergência
CREATE TABLE IF NOT EXISTS public.pedidos_suprimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
  solicitante_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- pendente, em_transito, divergencia_pendente, entregue_concluido, cancelado
  observacao_filial TEXT,
  observacao_matriz TEXT,
  observacao_recebimento TEXT,
  resolucao_matriz TEXT,
  despachado_em TIMESTAMPTZ,
  recebido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedidos_suprimentos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES public.pedidos_suprimentos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  qtd_solicitada INT NOT NULL DEFAULT 1,
  qtd_enviada INT DEFAULT 0,
  qtd_recebida INT DEFAULT 0,
  status_item VARCHAR(50) DEFAULT 'pendente',
  motivo_falta TEXT,
  motivo_divergencia TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir alteração das colunas caso as tabelas já existam
ALTER TABLE public.pedidos_suprimentos ADD COLUMN IF NOT EXISTS despachado_em TIMESTAMPTZ;
ALTER TABLE public.pedidos_suprimentos ADD COLUMN IF NOT EXISTS recebido_em TIMESTAMPTZ;
ALTER TABLE public.pedidos_suprimentos ADD COLUMN IF NOT EXISTS observacao_recebimento TEXT;
ALTER TABLE public.pedidos_suprimentos ADD COLUMN IF NOT EXISTS resolucao_matriz TEXT;

ALTER TABLE public.pedidos_suprimentos_itens ADD COLUMN IF NOT EXISTS qtd_recebida INT DEFAULT 0;
ALTER TABLE public.pedidos_suprimentos_itens ADD COLUMN IF NOT EXISTS motivo_divergencia TEXT;
