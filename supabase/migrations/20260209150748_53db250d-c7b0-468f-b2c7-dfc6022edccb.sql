
-- Tabela de estágios do funil CRM
CREATE TABLE public.crm_funil_estagios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  cor text NOT NULL DEFAULT '#6366f1',
  descricao text,
  automatico boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_funil_estagios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_funil_estagios_select" ON public.crm_funil_estagios FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_funil_estagios_insert" ON public.crm_funil_estagios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "crm_funil_estagios_update" ON public.crm_funil_estagios FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "crm_funil_estagios_delete" ON public.crm_funil_estagios FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Vincular clientes ao funil
CREATE TABLE public.crm_funil_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  estagio_id uuid NOT NULL REFERENCES public.crm_funil_estagios(id) ON DELETE CASCADE,
  notas text,
  valor_estimado numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id)
);

ALTER TABLE public.crm_funil_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_funil_clientes_select" ON public.crm_funil_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_funil_clientes_insert" ON public.crm_funil_clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_funil_clientes_update" ON public.crm_funil_clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "crm_funil_clientes_delete" ON public.crm_funil_clientes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE INDEX idx_crm_funil_clientes_estagio ON public.crm_funil_clientes(estagio_id);
CREATE INDEX idx_crm_funil_clientes_cliente ON public.crm_funil_clientes(cliente_id);

-- Trigger para updated_at
CREATE TRIGGER update_crm_funil_clientes_updated_at
BEFORE UPDATE ON public.crm_funil_clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir estágios padrão
INSERT INTO public.crm_funil_estagios (nome, ordem, cor, descricao, automatico) VALUES
  ('Lead', 1, '#8b5cf6', 'Contato inicial, ainda não agendou', false),
  ('Contato', 2, '#3b82f6', 'Já foi contatado, aguardando retorno', false),
  ('Agendou', 3, '#f59e0b', 'Realizou um agendamento', true),
  ('Cliente', 4, '#10b981', 'Já visitou o estabelecimento', true),
  ('Inativo', 5, '#ef4444', 'Sem visita há mais de 30 dias', true);

-- Tabela para configuração da Evolution API
CREATE TABLE public.evolution_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  api_url text NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  qr_code text,
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evolution_config_select" ON public.evolution_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "evolution_config_insert" ON public.evolution_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "evolution_config_update" ON public.evolution_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "evolution_config_delete" ON public.evolution_config FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Tabela para mensagens do WhatsApp
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  mensagem text NOT NULL,
  direcao text NOT NULL DEFAULT 'recebida',
  tipo text NOT NULL DEFAULT 'text',
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_mensagens_select" ON public.whatsapp_mensagens FOR SELECT TO authenticated USING (true);
CREATE POLICY "whatsapp_mensagens_insert" ON public.whatsapp_mensagens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "whatsapp_mensagens_update" ON public.whatsapp_mensagens FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_whatsapp_mensagens_cliente ON public.whatsapp_mensagens(cliente_id);
CREATE INDEX idx_whatsapp_mensagens_telefone ON public.whatsapp_mensagens(telefone);

-- Tabela para fluxos de chatbot
CREATE TABLE public.chatbot_fluxos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  gatilho text NOT NULL,
  resposta text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_fluxos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_fluxos_select" ON public.chatbot_fluxos FOR SELECT TO authenticated USING (true);
CREATE POLICY "chatbot_fluxos_insert" ON public.chatbot_fluxos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "chatbot_fluxos_update" ON public.chatbot_fluxos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "chatbot_fluxos_delete" ON public.chatbot_fluxos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
