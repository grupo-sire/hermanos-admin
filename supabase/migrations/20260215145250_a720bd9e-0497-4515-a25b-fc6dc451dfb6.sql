
-- Tabela para registrar cada disparo de campanha
CREATE TABLE public.campanha_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  canal TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' ou 'email'
  status TEXT NOT NULL DEFAULT 'enviado', -- 'enviado', 'falha', 'entregue'
  mensagem TEXT,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campanha_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campanha_envios_select" ON public.campanha_envios FOR SELECT USING (true);
CREATE POLICY "campanha_envios_insert" ON public.campanha_envios FOR INSERT WITH CHECK (true);
CREATE POLICY "campanha_envios_delete" ON public.campanha_envios FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for performance
CREATE INDEX idx_campanha_envios_campanha ON public.campanha_envios(campanha_id);
CREATE INDEX idx_campanha_envios_cliente ON public.campanha_envios(cliente_id);
