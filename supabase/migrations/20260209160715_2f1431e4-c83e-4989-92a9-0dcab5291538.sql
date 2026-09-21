
-- Tabela para rastrear conversas agrupadas por telefone
CREATE TABLE public.whatsapp_conversas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id),
  nome_contato TEXT,
  ultima_mensagem TEXT,
  ultima_mensagem_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  nao_lidas INTEGER NOT NULL DEFAULT 0,
  atendimento_humano BOOLEAN NOT NULL DEFAULT false,
  estagio_funil_id UUID REFERENCES public.crm_funil_estagios(id),
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_conversas_select" ON public.whatsapp_conversas FOR SELECT USING (true);
CREATE POLICY "whatsapp_conversas_insert" ON public.whatsapp_conversas FOR INSERT WITH CHECK (true);
CREATE POLICY "whatsapp_conversas_update" ON public.whatsapp_conversas FOR UPDATE USING (true);
CREATE POLICY "whatsapp_conversas_delete" ON public.whatsapp_conversas FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela para flows do chatbot (JSON do React Flow)
CREATE TABLE public.chatbot_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  flow_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_flows_select" ON public.chatbot_flows FOR SELECT USING (true);
CREATE POLICY "chatbot_flows_insert" ON public.chatbot_flows FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "chatbot_flows_update" ON public.chatbot_flows FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "chatbot_flows_delete" ON public.chatbot_flows FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_conversas_updated_at BEFORE UPDATE ON public.whatsapp_conversas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chatbot_flows_updated_at BEFORE UPDATE ON public.chatbot_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime para mensagens e conversas
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
