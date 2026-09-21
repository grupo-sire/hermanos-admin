-- Tabela de configurações da empresa
CREATE TABLE public.empresa_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj TEXT,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    logo_url TEXT,
    instagram TEXT,
    facebook TEXT,
    whatsapp TEXT,
    horario_funcionamento TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view empresa_config"
ON public.empresa_config FOR SELECT
USING (true);

CREATE POLICY "Admins can manage empresa_config"
ON public.empresa_config FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Tabela de cupons promocionais
CREATE TABLE public.cupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL DEFAULT 'percentual', -- 'percentual' ou 'valor_fixo'
    valor NUMERIC NOT NULL,
    minimo_compra NUMERIC DEFAULT 0,
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT now(),
    data_fim TIMESTAMP WITH TIME ZONE,
    max_usos INTEGER,
    usos_atual INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cupons"
ON public.cupons FOR SELECT
USING (true);

CREATE POLICY "Admins can manage cupons"
ON public.cupons FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Tabela de planos de fidelidade
CREATE TABLE public.planos_fidelidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    pontos_por_real NUMERIC NOT NULL DEFAULT 1,
    pontos_para_resgate INTEGER NOT NULL DEFAULT 100,
    valor_resgate NUMERIC NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planos_fidelidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view planos_fidelidade"
ON public.planos_fidelidade FOR SELECT
USING (true);

CREATE POLICY "Admins can manage planos_fidelidade"
ON public.planos_fidelidade FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Tabela de pontos dos clientes
CREATE TABLE public.cliente_pontos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    pontos INTEGER NOT NULL DEFAULT 0,
    total_acumulado INTEGER NOT NULL DEFAULT 0,
    total_resgatado INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(cliente_id)
);

ALTER TABLE public.cliente_pontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cliente_pontos"
ON public.cliente_pontos FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage cliente_pontos"
ON public.cliente_pontos FOR ALL
USING (true);

-- Tabela de campanhas de marketing
CREATE TABLE public.campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'lembrete', 'aniversario', 'cashback', 'promocao'
    mensagem TEXT,
    desconto_percentual NUMERIC,
    cashback_percentual NUMERIC,
    dias_antecedencia INTEGER DEFAULT 7, -- para aniversário
    dias_inatividade INTEGER DEFAULT 30, -- para lembrete
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campanhas"
ON public.campanhas FOR SELECT
USING (true);

CREATE POLICY "Admins can manage campanhas"
ON public.campanhas FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Tabela de comandas (vinculadas aos agendamentos)
CREATE TABLE public.comandas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    barbeiro_id UUID REFERENCES public.barbeiros(id) ON DELETE SET NULL,
    unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'aberta', -- 'aberta', 'fechada', 'cancelada'
    subtotal NUMERIC NOT NULL DEFAULT 0,
    desconto NUMERIC NOT NULL DEFAULT 0,
    cupom_id UUID REFERENCES public.cupons(id) ON DELETE SET NULL,
    total NUMERIC NOT NULL DEFAULT 0,
    forma_pagamento TEXT, -- 'dinheiro', 'pix', 'credito', 'debito'
    observacoes TEXT,
    fechada_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view comandas"
ON public.comandas FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage comandas"
ON public.comandas FOR ALL
USING (true);

-- Tabela de itens da comanda
CREATE TABLE public.comanda_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comanda_id UUID REFERENCES public.comandas(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL, -- 'servico' ou 'produto'
    servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    nome TEXT NOT NULL, -- guardar o nome para histórico
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view comanda_itens"
ON public.comanda_itens FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage comanda_itens"
ON public.comanda_itens FOR ALL
USING (true);

-- Tabela de CRM - histórico de interações
CREATE TABLE public.crm_interacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL, -- 'ligacao', 'whatsapp', 'email', 'visita', 'outro'
    descricao TEXT,
    data_interacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    responsavel_id UUID REFERENCES public.barbeiros(id) ON DELETE SET NULL,
    proxima_acao TEXT,
    data_proxima_acao TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'concluido', 'cancelado'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view crm_interacoes"
ON public.crm_interacoes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage crm_interacoes"
ON public.crm_interacoes FOR ALL
USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_empresa_config_updated_at
BEFORE UPDATE ON public.empresa_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cupons_updated_at
BEFORE UPDATE ON public.cupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planos_fidelidade_updated_at
BEFORE UPDATE ON public.planos_fidelidade
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cliente_pontos_updated_at
BEFORE UPDATE ON public.cliente_pontos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campanhas_updated_at
BEFORE UPDATE ON public.campanhas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comandas_updated_at
BEFORE UPDATE ON public.comandas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();